"""Ads reports (ports of AdMarketer's Performance, Experiments, Signups and Overview pages).

    GET /ads/performance                   ad-by-ad comparison, awards, verdicts, breakdowns by targeting
    GET /ads/experiments                   12 experiment cards, mistakes, ideas, creative analysis, competitors
    GET /ads/signups?tier=&verdict=        website signups (PII masked without ads:leads) + tier counts
    GET /ads/overview                      lead-form leads vs website signups, side by side (counts only)

All read-only, mounted behind ``require_auth`` (every role with ``read``). Data comes from Postgres via
``app.services.ads.records``; with no Meta credentials and no imported data the reports are empty and
``configured`` is false — nothing is invented.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Query, Request

from app.api.deps import DB, Ctx
from app.schemas import ads_reports as s
from app.services.ads import records
from app.services.ads.reports import experiments, overview, performance
from app.services.ads.signups import signups_configured

router = APIRouter(prefix="/ads", tags=["ads reports"])

PII_PERMISSION = "ads:leads"


def _flags(request: Request) -> tuple[bool, bool]:
    st = request.app.state.settings
    configured = bool(getattr(st, "meta_ads_access_token", None))
    return configured, signups_configured(st)


def mask_phone(phone: str | None) -> str | None:
    """Last four digits only: ``"•••••• 1234"``; ``None``/empty stays as is."""
    if not phone:
        return phone or None
    digits = "".join(ch for ch in str(phone) if ch.isdigit())
    return f"•••••• {digits[-4:]}" if len(digits) >= 4 else "••••••"


def image_url(ad_id: str) -> str:
    return f"/api/v1/ads/{ad_id}/image"


def _performance_out(report: dict, *, configured: bool, signups_ok: bool, has_data: bool) -> dict:
    return {
        **{k: v for k, v in report.items() if k not in ("delivered", "channels")},
        "configured": configured,
        "signups_configured": signups_ok,
        "has_data": has_data,
        "channels": {"lead_form": report["channels"][performance.LEAD], "website": report["channels"][performance.WEB]},
        "delivered": performance.delivered_tables(report["delivered"]),
        "thresholds": {
            "min_results_for_cost_award": performance.MIN_RESULTS_FOR_COST_AWARD,
            "min_quality_for_best_overall": performance.MIN_QUALITY_FOR_BEST_OVERALL,
            "min_impressions_for_ctr_award": performance.MIN_IMPRESSIONS_FOR_CTR_AWARD,
            "min_lpv_for_lpv_award": performance.MIN_LPV_FOR_LPV_AWARD,
        },
    }


@router.get("/performance", response_model=s.PerformanceOut, summary="Ad Performance report (port of AdMarketer /performance)")
def ads_performance(request: Request, db: DB, ctx: Ctx):
    configured, signups_ok = _flags(request)
    ads = records.load_ad_records(db)
    report = performance.build(ads, records.load_signups(db))
    return s.PerformanceOut.model_validate(_performance_out(report, configured=configured, signups_ok=signups_ok, has_data=bool(ads)))


@router.get("/experiments", response_model=s.ExperimentsOut, summary="Experiments report (port of AdMarketer /experiments)")
def ads_experiments(request: Request, db: DB, ctx: Ctx):
    configured, signups_ok = _flags(request)
    ads = records.load_ad_records(db)
    if ads:
        report = performance.build(ads, records.load_signups(db))
        data = experiments.build(report, overview.dashboard_totals(ads), records.load_optimization(db),
                                 records.load_creatives(db), records.load_creative_labels(db))
    else:
        data = experiments.empty()
    for g in data["creative"]["groups"]:
        g["image_url"] = image_url(g["ad_id"]) if g["has_image"] else None
    return s.ExperimentsOut.model_validate({**data, "configured": configured, "signups_configured": signups_ok, "has_data": bool(ads)})


def _signup_out(row: dict, known: dict[str, str], pii: bool) -> dict:
    campaign_id = row.get("matched_campaign_id") or None
    tier = row.get("attribution_tier") or "none"
    return {
        "id": None if row.get("id") is None else str(row["id"]),
        "name": (row.get("name") or None) if pii else None,
        "mobile": (row.get("mobile") or None) if pii else mask_phone(row.get("mobile")),
        "shop_address": (row.get("shop_address") or None) if pii else None,
        "submitted_at": performance.iso(row.get("submitted_at")),
        "qualification_verdict": row.get("qualification_verdict") or "",
        "attribution_tier": tier if tier in ("campaign_matched", "fbclid_only") else "none",
        "matched_campaign_id": campaign_id,
        "matched_campaign_name": row.get("matched_campaign_name") or (known.get(campaign_id) if campaign_id else None),
        "utm_source": row.get("utm_source") or "",
        "utm_medium": row.get("utm_medium") or "",
        "utm_campaign": row.get("utm_campaign") or "",
    }


@router.get("/signups", response_model=s.SignupsOut, summary="Website signups with attribution (port of AdMarketer /signups)")
def ads_signups(request: Request, db: DB, ctx: Ctx,
                tier: Literal["campaign_matched", "fbclid_only", "none"] | None = Query(default=None),
                verdict: str | None = Query(default=None, max_length=64, pattern=r"^[A-Za-z_ ]*$")):
    configured, signups_ok = _flags(request)
    pii = ctx.can(PII_PERMISSION)
    ads = records.load_ad_records(db)
    signups = records.load_signups(db)
    known = {a.get("campaign_id"): a.get("campaign_name") for a in ads if a.get("campaign_id")}
    totals = overview.signup_totals(signups, ads)

    verdict = (verdict or "").strip().upper().replace(" ", "_") or None
    rows = signups
    if tier:
        rows = [r for r in rows if (r.get("attribution_tier") or "none") == tier]
    if verdict:
        rows = [r for r in rows if (r.get("qualification_verdict") or "").upper() == verdict]
    return s.SignupsOut.model_validate({
        "signups_configured": signups_ok, "configured": configured, "has_ad_data": bool(ads), "pii_visible": pii,
        "tier": tier, "verdict": verdict, "totals": totals,
        "signups": [_signup_out(r, known, pii) for r in rows],
    })


@router.get("/overview", response_model=s.OverviewOut, summary="Lead-form leads and website signups side by side (port of AdMarketer /overview)")
def ads_overview(request: Request, db: DB, ctx: Ctx):
    configured, signups_ok = _flags(request)
    data = overview.build(records.load_ad_records(db), records.load_signups(db))
    return s.OverviewOut.model_validate({**data, "configured": configured, "signups_configured": signups_ok})
