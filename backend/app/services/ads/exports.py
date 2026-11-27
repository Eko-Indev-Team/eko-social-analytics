"""Excel downloads of lead-form leads (port of AdMarketer ``/dashboard/download-all`` and ``/dashboard/download/<ad_id>``).
Same columns, order, styling, text-formatted Lead ID / Phone columns and file names. Contains PII: routes require
``ads:leads``."""

from __future__ import annotations

import io
import re

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from sqlalchemy.orm import Session

from app.core.errors import ApiError, NotFoundError

from app.services.qualification import STATUS_LABELS

from . import records

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
PINNED = ("Full name", "Phone number")


class NoLeadsError(ApiError):
    status_code = 404
    code = "no_leads"


def _qualified_text(lead: dict) -> str:
    if lead.get("submitted_pincode") is None:
        return "No pincode found"
    if lead.get("pincode_qualified") is None:
        return f"Could not check ({lead['submitted_pincode']})"
    if lead.get("pincode_qualified"):
        return f"Qualified ({lead['submitted_pincode']})"
    return f"Not qualified ({lead['submitted_pincode']})"


QUAL_HEADERS = ["Qualification", "Why not SBI", "Education", "Can invest", "ESAF response"]
_REASON_TEXT = {"pincode_mismatch": "pincode not served", "pincode_unknown": "pincode unknown",
                "education_below_12th": "education below 12th", "education_unknown": "education unknown",
                "cannot_invest": "cannot invest", "investment_unknown": "investment unknown"}


def _yn(value: bool | None) -> str:
    return "Yes" if value is True else "No" if value is False else "Unknown"


def _qual_cells(lead: dict) -> list[str]:
    """The 2026-11-18 qualification columns (status label, failed/unknown SBI criteria, inputs)."""
    return [
        STATUS_LABELS.get(lead.get("qualification_status") or "", ""),
        ", ".join(_REASON_TEXT.get(r, r) for r in lead.get("sbi_reasons") or []),
        lead.get("education_level") or (lead.get("education_answer") or "Unknown"),
        _yn(lead.get("can_invest")),
        {"yes": "Yes", "no": "No"}.get(lead.get("esaf_response") or "", "Not pitched"),
    ]


def _other_labels(leads: list[dict]) -> list[str]:
    labels: list[str] = []
    for lead in leads:
        for label in lead.get("answers", {}):
            if label not in PINNED and label not in labels:
                labels.append(label)
    return labels


def _style_and_save(ws, headers: list[str], text_cols: tuple[int, ...], widths: list[int], wb: Workbook) -> bytes:
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.font = Font(name="Arial")
            cell.alignment = Alignment(wrap_text=True, vertical="top")
    # Lead ID / phone as text: Excel would turn long digit strings into scientific notation.
    for col in text_cols:
        for cell in ws.iter_rows(min_row=2, min_col=col, max_col=col):
            cell[0].number_format = "@"
    ws.auto_filter.ref = ws.dimensions
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _header(ws, headers: list[str]) -> None:
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(name="Arial", bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="1B4F9C")
        cell.alignment = Alignment(vertical="center")
    ws.freeze_panes = "A2"


def _safe_cell(value: object) -> object:
    """Neutralise spreadsheet formulas in lead-typed text (CSV/Excel injection)."""
    if isinstance(value, str) and value[:1] in ("=", "+", "-", "@") and not re.fullmatch(r"[+-]?\d[\d\s]*", value):
        return "'" + value
    return value


def all_leads_workbook(db: Session, *, from_date: str = "", to_date: str = "", lead_filter: str = "") -> tuple[bytes, str]:
    from_date, to_date, lead_filter = (from_date or "").strip(), (to_date or "").strip(), (lead_filter or "").strip()
    for value in (from_date, to_date):
        if value and not _DATE.match(value):
            raise ApiError("Dates must look like YYYY-MM-DD.")
    leads: list[dict] = []
    for a in records.load_ad_records(db):
        for lead in a["leads_data"]:
            leads.append({**lead, "_ad_name": a["ad_name"] or a["campaign_name"], "_account_name": a["account_name"]})
    leads.sort(key=lambda lead: lead.get("created_time") or "", reverse=True)
    if not leads:
        raise NoLeadsError("No leads stored yet -- sync the ads and try again.")
    if lead_filter == "qualified":
        leads = [lead for lead in leads if lead.get("qualified")]
    elif lead_filter == "pincode":
        leads = [lead for lead in leads if lead.get("pincode_qualified")]
    elif lead_filter in STATUS_LABELS:
        leads = [lead for lead in leads if lead.get("qualification_status") == lead_filter]
    if from_date or to_date:
        def in_range(lead: dict) -> bool:
            day = (lead.get("created_time") or "")[:10]
            return bool(day) and not (from_date and day < from_date) and not (to_date and day > to_date)
        leads = [lead for lead in leads if in_range(lead)]
    if not leads:
        if lead_filter:
            raise NoLeadsError(f"No leads match the '{lead_filter}' filter for this date range.")
        raise NoLeadsError(f"No leads found between {from_date or 'the start'} and {to_date or 'now'}.")

    other = _other_labels(leads)
    wb = Workbook()
    ws = wb.active
    ws.title = "All Leads"
    headers = ["Ad", "Account", "Submitted", "Lead ID", "Qualified", "Pincode qualified", *QUAL_HEADERS, *other, "Phone number", "Full name"]
    _header(ws, headers)
    for lead in leads:
        answers = lead.get("answers", {})
        ws.append([_safe_cell(v) for v in [
            lead.get("_ad_name", ""), lead.get("_account_name", ""), (lead.get("created_time") or "")[:16].replace("T", " "),
            lead.get("id", ""), "Qualified" if lead.get("qualified") else "Not qualified", _qualified_text(lead), *_qual_cells(lead),
            *[answers.get(label, "") for label in other], answers.get("Phone number", ""), answers.get("Full name", ""),
        ]])
    content = _style_and_save(ws, headers, (4, len(headers) - 1), [26, 16, 16, 18, 14, 20, 24, 28, 18, 12, 14] + [28] * len(other) + [16, 20], wb)

    first = {"qualified": "Qualified", "pincode": "Pincode_Matched"}.get(lead_filter) or (lead_filter.title() if lead_filter else "All")
    parts = [first, "Facebook_Form_Leads"]
    if from_date or to_date:
        parts.append(f"{from_date or 'start'}_to_{to_date or 'now'}")
    return content, "_".join(parts) + ".xlsx"


def ad_leads_workbook(db: Session, ad_id: str) -> tuple[bytes, str]:
    ad = records.load_ad_record(db, ad_id)
    if ad is None:
        raise NotFoundError("Ad", ad_id)
    if not ad.get("leads_data"):
        raise NoLeadsError("No leads stored for this ad -- sync the ads and try again.")
    leads = ad["leads_data"]
    other = _other_labels(leads)
    wb = Workbook()
    ws = wb.active
    ws.title = "Leads"
    headers = ["Submitted", "Lead ID", "Qualified", "Pincode qualified", *QUAL_HEADERS, *other, "Phone number", "Full name"]
    _header(ws, headers)
    for lead in leads:
        answers = lead.get("answers", {})
        ws.append([_safe_cell(v) for v in [
            (lead.get("created_time") or "")[:16].replace("T", " "), lead.get("id", ""),
            "Qualified" if lead.get("qualified") else "Not qualified", _qualified_text(lead), *_qual_cells(lead),
            *[answers.get(label, "") for label in other], answers.get("Phone number", ""), answers.get("Full name", ""),
        ]])
    content = _style_and_save(ws, headers, (2, len(headers) - 1), [16, 18, 14, 20, 24, 28, 18, 12, 14] + [28] * len(other) + [16, 20], wb)
    safe_name = "".join(c if c.isalnum() or c in " _-" else "_" for c in (ad.get("ad_name") or ad["campaign_id"]))[:60]
    return content, f"{safe_name}_leads.xlsx"
