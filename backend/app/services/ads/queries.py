"""Read models for the Ads HTTP API (``/api/v1/ads``). Everything is read from Postgres through the request's
tenant-filtered session. Lead PII (name, phone, answers) is only returned to roles with ``ads:leads``; everyone else
gets ``name: null``, a last-4 phone mask and ``answers: null``, plus counts."""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import NotFoundError
from app.models import AdsCreativeImage, AdsCreativeLabel, AdsLead, AdsMetaAd, AdsWebsiteSignup
from app.models.ads import QUALIFICATION_STATUSES
from app.services.audit import record_user_change
from app.services.auth import AuthContext
from app.services.qualification import STATUS_LABELS, sbi_reasons

from . import records, sync

MASK = "••••••"


def mask_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = "".join(ch for ch in str(phone) if ch.isdigit())
    return f"{MASK} {digits[-4:]}" if len(digits) >= 4 else MASK


# ------------------------------------------------------------------------------------ status
def status(db: Session, settings: Settings, ctx: AuthContext) -> dict[str, Any]:
    owns = sync.owns_ads(db, settings, ctx.workspace_id)
    last = sync.last_finished(db, "meta")
    active = sync.active_run(db, ctx.workspace_id)
    return {
        "configured": settings.meta_ads_configured and owns,
        "signups_configured": settings.ads_signups_configured and owns,
        "studio_publish_configured": settings.ad_studio_publish_configured and owns,
        "last_synced_at": sync.last_success_at(db, "meta"),
        "last_sync_status": last.status if last else None,
        "last_error_code": last.error_code if last and last.status == "failed" else None,
        "last_error_message": last.error_message if last and last.status == "failed" else None,
        "token_expired": bool(last and last.status == "failed" and last.error_code == "TOKEN_EXPIRED"),
        "current_job": {"id": active.id, "status": active.status, "kind": active.kind} if active else None,
        "ad_count": db.scalar(select(func.count()).select_from(AdsMetaAd)) or 0,
        "lead_count": db.scalar(select(func.count()).select_from(AdsLead).where(AdsLead.ad_id.is_not(None))) or 0,
        "can_sync": ctx.can("ads:manage"),
        "can_see_leads": ctx.can("ads:leads"),
    }


# ----------------------------------------------------------------------------------- summary
def summary(db: Session) -> dict[str, Any]:
    """Totals across every stored ad (AdMarketer ``_apply_ads`` totals) + website signups."""
    ads = records.load_ad_records(db)
    spend = round(sum(float(a["metrics"].get("spend", 0) or 0) for a in ads), 2)
    leads = sum(int(a["metrics"].get("leads", 0) or 0) for a in ads)
    qualified = sum(1 for a in ads for lead in a["leads_data"] if lead.get("qualified"))
    signups = db.scalar(select(func.count()).select_from(AdsWebsiteSignup)) or 0
    strong = db.scalar(select(func.count()).select_from(AdsWebsiteSignup).where(AdsWebsiteSignup.qualification_verdict == "STRONG_QUALIFY")) or 0

    def total(key: str) -> int:
        return sum(int(a["metrics"].get(key, 0) or 0) for a in ads)

    return {
        "spend": spend, "impressions": total("impressions"), "reach": total("reach"), "clicks": total("clicks"),
        "link_clicks": total("link_clicks"), "landing_page_views": total("landing_page_views"), "leads": leads,
        "pincode_qualified_leads": sum(1 for a in ads for lead in a["leads_data"] if lead.get("pincode_qualified")),
        "qualified_leads": qualified, "website_signups": signups, "strong_signups": strong, "ad_count": len(ads),
        "active_ad_count": sum(1 for a in ads if a["status"] == "ACTIVE"),
        "completed_ad_count": sum(1 for a in ads if a["status"] == "COMPLETED"),
        "qualification_counts": {st: sum(1 for a in ads for lead in a["leads_data"] if lead.get("qualification_status") == st)
                                 for st in QUALIFICATION_STATUSES},
        "cost_per_lead": round(spend / leads, 2) if leads else None,
        "cost_per_qualified_lead": round(spend / qualified, 2) if qualified else None,
        "currency": "INR",
    }


# --------------------------------------------------------------------------------------- ads
GENDERS = {(): "All", (0,): "All", (1,): "Men", (2,): "Women", (1, 2): "All"}


def _targeting_out(ts: dict, include_pincodes: bool = False) -> dict[str, Any]:
    setup = ts.get("setup") or {}
    age_min, age_max = setup.get("age_min"), setup.get("age_max")
    pins = sorted(ts.get("targeted_pincodes") or [])
    out = {
        "locations": list(ts.get("locations") or []),
        "pincode_count": len(pins),
        "interests_behaviors": ts.get("interests_behaviors"),
        "age_range": f"{age_min}-{age_max}" if age_min is not None and age_max is not None else None,
        "genders": GENDERS.get(tuple(sorted(setup.get("genders") or [])), "All") if setup else None,
        "placements": list(setup.get("publisher_platforms") or []),
        "advantage_audience": bool(setup.get("advantage_audience")) if setup else None,
        "restored_from_db": bool(ts.get("restored_from_db")),
        "pincode_check_ok": bool(ts.get("pincode_check_ok")),
    }
    if include_pincodes:
        out["pincodes"] = pins
        out["categories"] = dict(setup.get("categories") or {})
        out["suggested_age_range"] = setup.get("age_range")
    return out


def _creative_out(rec: dict, stored: dict | None, labels: dict[str, dict], has_image: bool) -> dict[str, Any]:
    live = rec.get("creative") or {}
    stored = stored or {}

    def pick(key: str) -> str:
        return live.get(key) or stored.get(key) or ""

    image_hash = pick("image_hash")
    ctype = live.get("type") if live.get("type") not in (None, "", "unknown") else stored.get("type") or "unknown"
    return {
        "type": ctype, "primary_text": pick("primary_text"), "headline": pick("headline"), "description": pick("description"),
        "cta": pick("cta"), "image_hash": image_hash or None,
        "image_url": f"/api/v1/ads/{rec['ad_id']}/image" if has_image else None,
        "image_type": (labels.get(image_hash) or {}).get("image_type") if image_hash else None,
    }


def _metrics_out(m: dict) -> dict[str, Any]:
    keys = ("impressions", "reach", "clicks", "ctr", "cpc", "cpm", "spend", "link_clicks", "landing_page_views", "leads")
    return {k: m.get(k, 0) or 0 for k in keys}


def _lead_counts(leads: list[dict]) -> dict[str, int]:
    return {"total": len(leads), "pincode_qualified": sum(1 for lead in leads if lead.get("pincode_qualified")),
            "qualified": sum(1 for lead in leads if lead.get("qualified"))}


def _context(db: Session) -> tuple[dict, dict, set[str]]:
    creatives = records.load_creatives(db)
    labels = records.load_creative_labels(db)
    images = set(db.scalars(select(AdsCreativeImage.ad_id)))
    return creatives, labels, images


def ad_row(rec: dict, creatives: dict, labels: dict, images: set[str], *, detail: bool = False) -> dict[str, Any]:
    from .meta.all_ads import channel_for

    return {
        "id": rec["ad_id"], "campaign_id": rec["campaign_id"], "campaign_name": rec.get("campaign_name"), "ad_name": rec.get("ad_name"),
        "account_name": rec.get("account_name"), "status": rec.get("status"), "objective": rec.get("objective"),
        "channel": channel_for(rec.get("objective")), "created_time": rec.get("created_time"),
        "first_impression_date": rec.get("first_impression_date"), "first_impression_hour": rec.get("first_impression_hour"),
        "creative": _creative_out(rec, creatives.get(rec["ad_id"]), labels, rec["ad_id"] in images),
        "metrics": _metrics_out(rec.get("metrics") or {}),
        "lead_counts": _lead_counts(rec.get("leads_data") or []),
        "targeting": _targeting_out(rec.get("targeting_summary") or {}, include_pincodes=detail),
    }


def list_ads(db: Session) -> list[dict]:
    creatives, labels, images = _context(db)
    return [ad_row(rec, creatives, labels, images) for rec in records.load_ad_records(db)]


def _breakdown_rows(rows: list[dict]) -> list[dict]:
    from .meta.all_ads import extract_actions

    out = []
    for r in rows or []:
        out.append({
            "age": r.get("age"), "gender": r.get("gender"), "publisher_platform": r.get("publisher_platform"),
            "platform_position": r.get("platform_position"), "region": r.get("region"),
            "impressions": int(float(r.get("impressions", 0) or 0)), "reach": int(float(r.get("reach", 0) or 0)),
            "clicks": int(float(r.get("clicks", 0) or 0)), "spend": round(float(r.get("spend", 0) or 0), 2),
            "leads": extract_actions(r.get("actions")).get("leads", 0),
        })
    return out


def ad_detail(db: Session, ad_id: str) -> dict[str, Any]:
    rec = records.load_ad_record(db, ad_id)
    if rec is None:
        raise NotFoundError("Ad", ad_id)
    creatives, labels, images = _context(db)
    row = ad_row(rec, creatives, labels, images, detail=True)
    b = rec.get("breakdowns") or {}
    row["breakdowns"] = {"age_gender": _breakdown_rows(b.get("age_gender")), "platform": _breakdown_rows(b.get("platform")),
                         "region": _breakdown_rows(b.get("region"))}
    row["lead_form_id"] = db.scalar(select(AdsMetaAd.lead_form_id).where(AdsMetaAd.ad_id == ad_id))
    return row


# ------------------------------------------------------------------------------------- leads
def lead_out(lead: AdsLead, ad: AdsMetaAd | None, *, reveal: bool) -> dict[str, Any]:
    return {
        "id": lead.meta_lead_id, "ad_id": lead.ad_id, "ad_name": (ad.ad_name or ad.campaign_name) if ad else None,
        "campaign_name": ad.campaign_name if ad else None, "created_time": lead.created_time,
        "name": lead.name if reveal else None,
        "phone": lead.phone if reveal else mask_phone(lead.phone),
        "submitted_pincode": lead.submitted_pincode, "pincode_qualified": lead.pincode_qualified,
        "passes_screening": bool(lead.passes_screening), "qualified": bool(lead.qualified),
        "qualification_status": lead.qualification_status,
        "sbi_reasons": sbi_reasons(lead.pincode_match, lead.education_ok, lead.can_invest),
        "pincode_match": lead.pincode_match, "education_level": lead.education_level, "education_ok": lead.education_ok,
        "can_invest": lead.can_invest, "esaf_response": lead.esaf_response, "esaf_response_source": lead.esaf_response_source,
        "answers": [{"question": q, "answer": a} for q, a in (lead.answers or {}).items()] if reveal else None,
    }


def list_leads(db: Session, ctx: AuthContext, *, ad_id: str | None = None, status: str = "all", q: str | None = None) -> list[dict]:
    reveal = ctx.can("ads:leads")
    query = select(AdsLead).where(AdsLead.ad_id.is_not(None))
    if ad_id:
        query = query.where(AdsLead.ad_id == ad_id)
    if status == "qualified":
        query = query.where(AdsLead.qualified.is_(True))
    elif status == "pincode":
        query = query.where(AdsLead.pincode_qualified.is_(True))
    elif status in QUALIFICATION_STATUSES:
        query = query.where(AdsLead.qualification_status == status)
    leads = list(db.scalars(query))
    ads = {a.ad_id: a for a in db.scalars(select(AdsMetaAd))}
    leads = [lead for lead in leads if lead.ad_id in ads]  # only leads of ads we show
    if q:
        needle = q.strip().lower()

        def hit(lead: AdsLead) -> bool:
            ad = ads.get(lead.ad_id or "")
            fields = [lead.submitted_pincode, ad.ad_name if ad else None, ad.campaign_name if ad else None, lead.meta_lead_id]
            if reveal:  # searching PII would otherwise let a masked role probe names/phones
                fields += [lead.name, lead.phone]
            return any(needle in (f or "").lower() for f in fields)

        leads = [lead for lead in leads if hit(lead)]
    leads.sort(key=lambda lead: lead.created_time or "", reverse=True)
    return [lead_out(lead, ads.get(lead.ad_id or ""), reveal=reveal) for lead in leads]


def ad_leads(db: Session, ctx: AuthContext, ad_id: str) -> list[dict]:
    if db.scalar(select(AdsMetaAd.id).where(AdsMetaAd.ad_id == ad_id)) is None:
        raise NotFoundError("Ad", ad_id)
    return list_leads(db, ctx, ad_id=ad_id)


# ------------------------------------------------------------------------------------ images
SAFE_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def ad_image(db: Session, ad_id: str) -> tuple[bytes, str]:
    img = db.scalar(select(AdsCreativeImage).where(AdsCreativeImage.ad_id == ad_id))
    if img is None or img.content_type not in SAFE_IMAGE_TYPES:
        raise NotFoundError("Ad picture", ad_id)
    return img.data, img.content_type


# ---------------------------------------------------------------------------- creative labels
def creative_labels(db: Session) -> list[dict]:
    """Every picture (image hash) seen on an ad, with its hand label (``imageType: null`` = not labelled yet)."""
    labels = records.load_creative_labels(db)
    creatives = records.load_creatives(db)
    images = set(db.scalars(select(AdsCreativeImage.ad_id)))
    by_hash: dict[str, list[str]] = {}
    for ad_id, c in creatives.items():
        if c.get("image_hash"):
            by_hash.setdefault(c["image_hash"], []).append(ad_id)
    out = []
    for image_hash in sorted(set(by_hash) | set(labels)):
        ad_ids = sorted(by_hash.get(image_hash, []))
        with_image = next((a for a in ad_ids if a in images), None)
        out.append({"image_hash": image_hash, "image_type": (labels.get(image_hash) or {}).get("image_type"), "ad_ids": ad_ids,
                    "image_url": f"/api/v1/ads/{with_image}/image" if with_image else None})
    return out


def set_creative_label(db: Session, image_hash: str, image_type: str | None) -> dict:
    row = db.scalar(select(AdsCreativeLabel).where(AdsCreativeLabel.image_hash == image_hash))
    value = (image_type or "").strip()
    if not value:
        if row is not None:
            db.delete(row)
        db.flush()
        return {"image_hash": image_hash, "image_type": None}
    if row is None:
        row = AdsCreativeLabel(image_hash=image_hash, image_type=value)
        db.add(row)
    else:
        row.image_type = value
    db.flush()
    return {"image_hash": image_hash, "image_type": value}


# ------------------------------------------------------------------------------- lead edits
def set_lead_esaf(db: Session, settings: Settings, ctx: AuthContext, lead_id: str, esaf_response: str | None) -> dict:
    """Staff record the lead's answer to the ESAF pitch (``yes`` / ``no`` / ``None`` = clear, back to the form's answer).
    The status is recomputed at once; the value survives later syncs. Audited (no PII in the audit row)."""
    from .meta.all_ads import effective_targeted_pincodes
    from .sync import markers_for, requalify

    lead = db.scalar(select(AdsLead).where(AdsLead.meta_lead_id == lead_id))
    if lead is None or lead.ad_id is None:
        raise NotFoundError("Lead", lead_id)
    ad = db.scalar(select(AdsMetaAd).where(AdsMetaAd.ad_id == lead.ad_id))
    before_esaf, before_status = lead.esaf_response, lead.qualification_status
    if esaf_response in ("yes", "no"):
        lead.esaf_response, lead.esaf_response_source = esaf_response, "staff"
    else:
        lead.esaf_response, lead.esaf_response_source = None, None  # requalify falls back to the lead-form answer
    if ad is not None:
        rec = {"campaign_id": ad.campaign_id, "targeting_summary": records.targeting_summary(ad.targeting)}
        targeted = effective_targeted_pincodes(rec, records.load_targeting_db(db))
    else:  # pragma: no cover — leads are only listed for stored ads
        targeted = set()
    requalify(lead, targeted, markers_for(settings))
    db.flush()
    if (before_esaf, before_status) != (lead.esaf_response, lead.qualification_status):
        diff = [{"field": "ESAF response", "before": before_esaf or "—", "after": lead.esaf_response or "—"},
                {"field": "Qualification", "before": STATUS_LABELS.get(before_status or "", "—"),
                 "after": STATUS_LABELS.get(lead.qualification_status, lead.qualification_status)}]
        record_user_change(
            db, category="leads", kind="Lead Update", icon="contact_page", title="Ad Lead Updated",
            summary=f"Ad lead {lead.meta_lead_id}: ESAF response {diff[0]['before']} → {diff[0]['after']}; "
                    f"qualification {diff[1]['before']} → {diff[1]['after']}.",
            target_label=f"Ad lead {lead.meta_lead_id}", target_to=f"/ads/leads?lead={lead.meta_lead_id}", module="Ads",
            payload={"type": "AD_LEAD_UPDATED", "lead_id": lead.meta_lead_id, "fields": ["esaf_response"]}, diff=diff,
            narrative_suffix="Stored in SocialBoard only — nothing was sent to Meta or to the lead.",
        )
    return lead_out(lead, ad, reveal=ctx.can("ads:leads"))
