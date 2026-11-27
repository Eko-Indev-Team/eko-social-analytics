"""Lead qualification (product-owner rules of 2026-11-18; replaces AdMarketer's pincode + investment + franchise rule).

Used by both Ads leads (Meta lead forms) and SocialBoard's own leads. Pure functions, no I/O.

Inputs are True / False / None (unknown):
* ``pincode_match`` — the lead's pincode is in the SBI service pincodes;
* ``education_ok``  — highest education ≥ 12th / Intermediate (``parse_education``);
* ``can_invest``    — answered yes to the investment question;
* ``esaf_response`` — "yes" / "no" / None (ESAF zero-investment BC model not pitched yet).

Outcome (with the update of 2026-11-18 — education >= 12th is required for ESAF too):
1. ``sbi_strong``: pincode_match, education_ok and can_invest all True.
2. education_ok False → ``not_qualified`` (fails SBI and ESAF; ESAF is not pitched).
3. pincode_match or can_invest False → ESAF track: esaf yes + education True → ``esaf_strong``; esaf yes + education
   unknown → ``needs_info``; esaf no → ``not_qualified``; not pitched → ``esaf_pitch``.
4. Otherwise (nothing False, something unknown): esaf yes + education True → ``esaf_strong``, else ``needs_info``.
"""

from __future__ import annotations

import re
from typing import Literal

Status = Literal["sbi_strong", "esaf_strong", "esaf_pitch", "needs_info", "not_qualified"]
STATUSES: tuple[str, ...] = ("sbi_strong", "esaf_strong", "esaf_pitch", "needs_info", "not_qualified")
QUALIFIED_STATUSES = frozenset({"sbi_strong", "esaf_strong"})
STATUS_LABELS = {
    "sbi_strong": "Strongly qualified · SBI",
    "esaf_strong": "Strongly qualified · ESAF",
    "esaf_pitch": "Pitch ESAF",
    "needs_info": "Check details",
    "not_qualified": "Not qualified",
}
REASONS = {
    "pincode": ("pincode_mismatch", "pincode_unknown"),
    "education": ("education_below_12th", "education_unknown"),
    "invest": ("cannot_invest", "investment_unknown"),
}

YES_VALUES = ("yes", "y", "हाँ", "हां", "ha", "haan", "han")
NO_VALUES = ("no", "n", "नहीं", "nahi", "nahin", "na")

# (level rank, label, ok) — the highest level mentioned in the answer wins ("10th, 12th pass" → 12th).
_LEVELS: list[tuple[int, str, bool, re.Pattern[str]]] = [
    (0, "Below 10th", False, re.compile(r"\b(?:8th|9th|below\s*10(?:th)?|no\s+education|illiterate|uneducated)\b|अनपढ़")),
    (1, "10th", False, re.compile(r"\b(?:10th|10|matric|matriculation|high\s+school|ssc)\b|10वीं|दसवीं")),
    (2, "12th / Intermediate", True, re.compile(
        r"\b(?:12th|12|intermediate|inter|hsc|higher\s+secondary|senior\s+secondary)\b|(?<![\w+])\+\s?2(?!\d)|10\s?\+\s?2|12वीं|इंटर")),
    (3, "Graduate", True, re.compile(
        r"\b(?:graduate|graduation|degree|ba|b\.\s?a|bsc|b\.\s?sc|bcom|b\.\s?com|bba|bca|b\.?\s?tech|btech|engineering)\b|स्नातक")),
    (4, "Post graduate", True, re.compile(
        r"\b(?:post\s*graduate|post\s*graduation|pg|ma|m\.\s?a|msc|m\.\s?sc|mcom|m\.\s?com|mba|mca|m\.?\s?tech|mtech)\b|स्नातकोत्तर")),
    (5, "PhD", True, re.compile(r"\b(?:phd|ph\.\s?d|doctorate)\b")),
]


def parse_education(text: str | None) -> tuple[str | None, bool | None]:
    """Answer text → (level label, ≥ 12th?). Unrecognised or blank (e.g. "diploma") → (None, None)."""
    if not text or not text.strip():
        return None, None
    value = text.strip().lower()
    best: tuple[int, str, bool] | None = None
    for rank, label, ok, pattern in _LEVELS:
        if pattern.search(value) and (best is None or rank > best[0]):
            best = (rank, label, ok)
    if best is None:
        return None, None
    return best[1], best[2]


def yes_no(text: str | None) -> bool | None:
    """Yes → True, a clear no → False, blank → None. Anything else that is not yes counts as no (AdMarketer treated
    every non-yes answer as a failed screening answer)."""
    if text is None or not str(text).strip():
        return None
    value = str(text).strip().lower()
    if value in YES_VALUES:
        return True
    return False


def esaf_value(text: str | None) -> str | None:
    """Lead-form ESAF answer → "yes" / "no" / None (only clear answers count)."""
    if text is None:
        return None
    value = str(text).strip().lower()
    if value in YES_VALUES:
        return "yes"
    if value in NO_VALUES:
        return "no"
    return None


def sbi_reasons(pincode_match: bool | None, education_ok: bool | None, can_invest: bool | None) -> list[str]:
    reasons: list[str] = []
    for key, value in (("pincode", pincode_match), ("education", education_ok), ("invest", can_invest)):
        if value is False:
            reasons.append(REASONS[key][0])
        elif value is None:
            reasons.append(REASONS[key][1])
    return reasons


def qualify_lead(pincode_match: bool | None, education_ok: bool | None, can_invest: bool | None,
                 esaf_response: str | None) -> tuple[Status, list[str]]:
    """(status, sbi_reasons). ``sbi_reasons`` lists the SBI criteria that failed or are unknown (empty for sbi_strong)."""
    reasons = sbi_reasons(pincode_match, education_ok, can_invest)
    esaf = esaf_response if esaf_response in ("yes", "no") else None
    if pincode_match is True and education_ok is True and can_invest is True:
        return "sbi_strong", reasons
    # Education >= 12th is required for ESAF too (update of 2026-11-18): below 12th fails both tracks.
    if education_ok is False:
        return "not_qualified", reasons
    if pincode_match is False or can_invest is False:  # SBI fails → ESAF track
        if esaf == "yes":
            return ("esaf_strong" if education_ok is True else "needs_info"), reasons
        if esaf == "no":
            return "not_qualified", reasons
        return "esaf_pitch", reasons
    # Nothing failed but something is unknown.
    if esaf == "yes" and education_ok is True:
        return "esaf_strong", reasons
    return "needs_info", reasons


def is_qualified(status: str | None) -> bool:
    return status in QUALIFIED_STATUSES
