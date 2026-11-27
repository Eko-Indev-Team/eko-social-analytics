"""Postgres → AdMarketer-shaped dicts. This is the contract between the core ads module and the report builders
(``performance.build`` / ``experiments.build`` ports): the dicts are exactly AdMarketer's (``docs/DATA_DICTIONARY.md``),
so the ported builders run unchanged.

All loaders read through the caller's session, so the tenant filter (``app.core.tenancy``) scopes them to the
request's workspace. They return lead / signup PII unmasked — callers that serve HTTP must mask (see ``queries``).
Nothing here is cached: Postgres is the store.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.services.qualification import sbi_reasons

from app.models import (
    AdsCreative, AdsCreativeImage, AdsCreativeLabel, AdsLead, AdsMetaAd, AdsOptimization, AdsReferenceDataset, AdsTargetingRecord, AdsWebsiteSignup,
)


def lead_dict(lead: AdsLead) -> dict[str, Any]:
    """A ``leads_data`` item: AdMarketer's ``id, created_time, answers, submitted_pincode, pincode_qualified,
    passes_screening_questions, qualified`` plus ``qualification_status, sbi_reasons, pincode_match, education_answer,
    education_level, education_ok, can_invest, esaf_response, esaf_response_source``. ``qualified`` = status in
    {sbi_strong, esaf_strong}; ``passes_screening_questions`` = can_invest AND education_ok."""
    return {
        "id": lead.meta_lead_id,
        "created_time": lead.created_time,
        "answers": dict(lead.answers or {}),
        "submitted_pincode": lead.submitted_pincode,
        "pincode_qualified": lead.pincode_qualified,
        "passes_screening_questions": bool(lead.passes_screening),
        "qualified": bool(lead.qualified),
        # Qualification rules of 2026-11-18 (app.services.qualification).
        "qualification_status": lead.qualification_status,
        "sbi_reasons": sbi_reasons(lead.pincode_match, lead.education_ok, lead.can_invest),
        "pincode_match": lead.pincode_match,
        "education_answer": lead.education_answer,
        "education_level": lead.education_level,
        "education_ok": lead.education_ok,
        "can_invest": lead.can_invest,
        "esaf_response": lead.esaf_response,
        "esaf_response_source": lead.esaf_response_source,
    }


def targeting_summary(stored: dict[str, Any] | None) -> dict[str, Any]:
    """Stored targeting JSON → AdMarketer's ``targeting_summary`` (``targeted_pincodes`` back to a ``set``)."""
    ts = dict(stored or {})
    ts["targeted_pincodes"] = set(ts.get("targeted_pincodes") or [])
    ts.setdefault("locations", ["Not available"])
    ts.setdefault("interests_behaviors", "Not available")
    ts.setdefault("pincode_check_ok", False)
    return ts


def ad_record(ad: AdsMetaAd, leads: list[AdsLead]) -> dict[str, Any]:
    return {
        "account_name": ad.account_name,
        "account_id": ad.account_id,
        "campaign_id": ad.campaign_id,
        "campaign_name": ad.campaign_name,
        "status": ad.status,
        "objective": ad.objective,
        "created_time": ad.created_time,
        "first_impression_date": ad.first_impression_date,
        "first_impression_hour": ad.first_impression_hour,
        "ad_id": ad.ad_id,
        "ad_name": ad.ad_name,
        "thumbnail_url": ad.thumbnail_url,
        "creative": dict(ad.creative or {}),
        "metrics": dict(ad.metrics or {}),
        "breakdowns": {"age_gender": [], "platform": [], "region": [], **(ad.breakdowns or {})},
        "targeting_summary": targeting_summary(ad.targeting),
        "leads_data": [lead_dict(lead) for lead in leads],
    }


def _sort_leads(leads: list[AdsLead]) -> list[AdsLead]:
    return sorted(leads, key=lambda lead: lead.created_time or "", reverse=True)


def load_ad_records(db: Session) -> list[dict]:
    """Every stored ad as an AdMarketer ad record, newest first (``created_time`` desc), with its assigned leads
    (newest first) in ``leads_data``."""
    ads = list(db.scalars(select(AdsMetaAd)))
    by_ad: dict[str, list[AdsLead]] = {}
    for lead in db.scalars(select(AdsLead).where(AdsLead.ad_id.is_not(None))):
        by_ad.setdefault(lead.ad_id, []).append(lead)  # type: ignore[arg-type]
    records = [ad_record(ad, _sort_leads(by_ad.get(ad.ad_id, []))) for ad in ads]
    records.sort(key=lambda r: r.get("created_time") or "", reverse=True)
    return records


def load_ad_record(db: Session, ad_id: str) -> dict | None:
    ad = db.scalar(select(AdsMetaAd).where(AdsMetaAd.ad_id == ad_id))
    if ad is None:
        return None
    leads = list(db.scalars(select(AdsLead).where(AdsLead.ad_id == ad_id)))
    return ad_record(ad, _sort_leads(leads))


SIGNUP_FIELDS = ("mobile", "name", "submitted_at", "qualification_verdict", "shop_address", "attribution_tier", "matched_campaign_id",
                 "matched_campaign_name", "utm_source", "utm_medium", "utm_campaign")


def signup_dict(row: AdsWebsiteSignup) -> dict[str, Any]:
    out: dict[str, Any] = {**(row.extra or {}), "id": row.signup_id}
    for field in SIGNUP_FIELDS:
        out[field] = getattr(row, field)
    for field in ("mobile", "shop_address", "qualification_verdict", "utm_source", "utm_medium", "utm_campaign"):
        if out[field] is None:
            out[field] = ""
    return out


def load_signups(db: Session) -> list[dict]:
    """Website signups in AdMarketer's shape (``id, mobile, name, submitted_at, qualification_verdict, shop_address,
    attribution_tier, matched_campaign_id, matched_campaign_name, utm_source, utm_medium, utm_campaign``), newest first."""
    rows = list(db.scalars(select(AdsWebsiteSignup)))
    out = [signup_dict(r) for r in rows]
    out.sort(key=lambda s: s.get("submitted_at") or "", reverse=True)
    return out


def creative_dict(row: AdsCreative, image_file: str = "") -> dict[str, Any]:
    return {
        "campaign_id": row.campaign_id, "account_name": row.account_name, "built": row.built, "type": row.type,
        "primary_text": row.primary_text, "headline": row.headline, "description": row.description, "cta": row.cta,
        "image_hash": row.image_hash, "image_file": image_file, "image_full": bool(row.image_full),
    }


def load_creatives(db: Session) -> dict[str, dict]:
    """``{ad_id: {campaign_id, account_name, built, type, primary_text, headline, description, cta, image_hash,
    image_file, image_full}}`` (``ad_creatives.json``). ``image_file`` is ``"<ad_id>.<ext>"`` when a stored picture
    exists (serve it via ``/api/v1/ads/{ad_id}/image``), else ``""``."""
    images = {ad_id: ctype for ad_id, ctype in db.execute(select(AdsCreativeImage.ad_id, AdsCreativeImage.content_type))}
    out: dict[str, dict] = {}
    for row in db.scalars(select(AdsCreative)):
        ctype = images.get(row.ad_id)
        image_file = f"{row.ad_id}.{_EXT.get(ctype or '', 'jpg')}" if ctype else ""
        out[row.ad_id] = creative_dict(row, image_file)
    return out


_EXT = {"image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/jpeg": "jpg"}


def load_creative_labels(db: Session) -> dict[str, dict]:
    """``{image_hash: {"image_type": ...}}`` (``creative_labels.json``)."""
    return {row.image_hash: {"image_type": row.image_type} for row in db.scalars(select(AdsCreativeLabel))}


def optimization_dict(row: AdsOptimization) -> dict[str, Any]:
    return {"optimization_goal": row.optimization_goal, "bid_strategy": row.bid_strategy, "pixel_id": row.pixel_id,
            "custom_event_type": row.custom_event_type, "daily_budget": row.daily_budget, "lifetime_budget": row.lifetime_budget}


def load_optimization(db: Session) -> dict[str, dict]:
    """``{campaign_id: {optimization_goal, bid_strategy, pixel_id, custom_event_type, daily_budget, lifetime_budget}}``."""
    return {row.campaign_id: optimization_dict(row) for row in db.scalars(select(AdsOptimization))}


def load_targeting_db(db: Session) -> dict[str, dict]:
    """``{campaign_id: {campaign_name, ad_name, account_name, pincodes[], locations[], interests_behaviors, setup{}}}``
    (``ad_targeted_pincodes.json``)."""
    return {
        r.campaign_id: {"campaign_name": r.campaign_name, "ad_name": r.ad_name, "account_name": r.account_name,
                        "pincodes": list(r.pincodes or []), "locations": list(r.locations or []),
                        "interests_behaviors": r.interests_behaviors or "", "setup": dict(r.setup or {})}
        for r in db.scalars(select(AdsTargetingRecord))
    }


def known_campaign_names(db: Session) -> dict[str, str]:
    """``{campaign_id: campaign_name}`` for every stored ad (signup matching)."""
    return {cid: name for cid, name in db.execute(select(AdsMetaAd.campaign_id, AdsMetaAd.campaign_name)) if cid}


def sbi_service_pincodes(db: Session) -> set[str]:
    """SBI service pincodes for SocialBoard's own leads: every pincode in ``ads_targeting_records`` plus the pincodes of
    the ``csp_villages_geocoded`` reference dataset."""
    pins: set[str] = set()
    for row in db.scalars(select(AdsTargetingRecord.pincodes)):
        pins.update(str(p) for p in row or [])
    data = db.scalar(select(AdsReferenceDataset.data).where(AdsReferenceDataset.name == "csp_villages_geocoded"))
    for item in data or []:
        pin = item.get("pincode") if isinstance(item, dict) else None
        if pin:
            pins.add(str(pin).strip())
    return {p for p in pins if len(p) == 6 and p.isdigit()}
