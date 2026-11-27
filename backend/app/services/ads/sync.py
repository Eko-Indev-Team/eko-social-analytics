"""Ads sync runs: durable jobs that pull Meta ads (and website signups) and persist them into Postgres.

PostgreSQL is the source of truth; Celery only carries "run X is ready" (``adsr_`` ids are routed to the ads task by
``app.worker.queue``). Rules kept from AdMarketer:

* A failed or empty pull never overwrites stored data (the run fails, nothing is written).
* Error code 190 → ``TOKEN_EXPIRED`` (status shows a banner); every stored message is redacted (``clean_error``).
* Targeting is restored from ``ads_targeting_records``; that record is only updated from successful fetches.
* Leads are never deleted: a lead form whose lead list could not be fetched keeps its stored leads, and leads Meta no
  longer returns keep their assignment. Qualification is recomputed for every lead of every pulled ad.
* Creatives: text is never blanked by a thinner read; pictures are downloaded (Meta links expire) and a saved
  thumbnail is upgraded to the full-size picture when Meta gives one.

At most one queued/running run per workspace and kind (partial unique index); a run's lease expiring (worker died)
turns it into ``failed`` via ``reap_stale_runs``.
"""

from __future__ import annotations

import logging
import secrets
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import ApiError, ConflictError
from app.core.tenancy import bind_workspace
from app.models import (
    AdsCreative, AdsCreativeImage, AdsLead, AdsMetaAd, AdsOptimization, AdsSyncRun, AdsTargetingRecord, AdsWebsiteSignup, Workspace,
)
from app.models.ads import ACTIVE_SYNC_STATUSES
from app.services.common import utcnow

from . import records
from .meta.all_ads import AdsFetcher, Markers, PullResult, channel_for, effective_targeted_pincodes, extract_contact, get_all_real_ads, qualify_lead
from .meta.client import TOKEN_EXPIRED, MetaAdsClient, clean_error

logger = logging.getLogger("socialboard.ads")

Dispatcher = Callable[[str, float], None]
ACTIVE_WHERE = text("status IN ('queued', 'running')")
RUN_PREFIX = "adsr_"
LEASE = timedelta(minutes=35)          # > the Celery hard time limit (30 min)
UNDELIVERED_AFTER = timedelta(minutes=2)
SCHEDULER_LOCK = 0x0AD5_5C4E

MESSAGES = {
    "not_configured": "Meta Ads is not connected: add META_ADS_ACCESS_TOKEN to backend/.env.",
    "signups_not_configured": "Website signups are not connected: set EKO_SIGNUP_ADMIN_BASE_URL, EKO_SIGNUP_ADMIN_USER and EKO_SIGNUP_ADMIN_PASSWORD.",
    TOKEN_EXPIRED: "The Meta access token expired or was revoked. Create a new one (a System User token does not expire) and update META_ADS_ACCESS_TOKEN.",
    "empty_pull": "Meta returned no ads. The data already stored was kept.",
    "worker_lost": "The worker stopped while syncing. The data already stored was kept.",
    "internal_error": "An internal error interrupted the sync. The data already stored was kept.",
}


class AdsNotConfiguredError(ApiError):
    status_code = 409
    code = "ads_not_configured"


class AdsWorkspaceError(ApiError):
    status_code = 409
    code = "ads_workspace_unresolved"


class AdsSyncUnavailableError(ApiError):
    status_code = 503
    code = "background_sync_unavailable"

    def __init__(self) -> None:
        super().__init__("Background sync is not running on this server (REDIS_URL is not configured). See README → Background sync.")


class SyncFailed(Exception):
    def __init__(self, code: str, message: str | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.message = message or MESSAGES.get(code) or "The sync failed. The data already stored was kept."


# ------------------------------------------------------------------------------- workspace
def resolve_workspace_id(db: Session, settings: Settings) -> str:
    """The workspace that owns the env-configured Meta / Eko credentials."""
    if settings.meta_ads_workspace_id:
        if db.get(Workspace, settings.meta_ads_workspace_id) is None:
            raise AdsWorkspaceError("META_ADS_WORKSPACE_ID does not name an existing workspace.")
        return settings.meta_ads_workspace_id
    ids = list(db.scalars(select(Workspace.id).limit(2)))
    if len(ids) != 1:
        raise AdsWorkspaceError("Set META_ADS_WORKSPACE_ID: the ads data belongs to one workspace and more than one exists."
                                if ids else "No workspace exists yet.")
    return ids[0]


def owns_ads(db: Session, settings: Settings, workspace_id: str) -> bool:
    try:
        return resolve_workspace_id(db, settings) == workspace_id
    except AdsWorkspaceError:
        return False


# ---------------------------------------------------------------------------------- enqueue
@dataclass
class EnqueueResult:
    run: AdsSyncRun
    created: bool


def active_run(db: Session, workspace_id: str, kind: str | None = None) -> AdsSyncRun | None:
    query = select(AdsSyncRun).where(AdsSyncRun.workspace_id == workspace_id, AdsSyncRun.status.in_(ACTIVE_SYNC_STATUSES))
    if kind:
        query = query.where(AdsSyncRun.kind == kind)
    return db.scalar(query.order_by(AdsSyncRun.queued_at.desc()).limit(1))


def check_configured(settings: Settings, kind: str) -> None:
    if kind == "meta" and not settings.meta_ads_configured:
        raise AdsNotConfiguredError(MESSAGES["not_configured"])
    if kind == "signups" and not settings.ads_signups_configured:
        raise AdsNotConfiguredError(MESSAGES["signups_not_configured"])


def enqueue(db: Session, settings: Settings, workspace_id: str, *, kind: str = "meta", trigger: str = "manual",
            member_id: str | None = None) -> EnqueueResult:
    """Queue a run (deduplicated: an already queued/running run of that kind is returned instead)."""
    check_configured(settings, kind)
    existing = active_run(db, workspace_id, kind)
    if existing is not None:
        return EnqueueResult(existing, False)
    run_id = f"{RUN_PREFIX}{secrets.token_hex(8)}"
    created = db.execute(insert(AdsSyncRun).values(
        id=run_id, workspace_id=workspace_id, kind=kind, trigger=trigger, status="queued", triggered_by_member_id=member_id,
        queued_at=utcnow(), counts={},
    ).on_conflict_do_nothing(index_elements=["workspace_id", "kind"], index_where=ACTIVE_WHERE).returning(AdsSyncRun.id)).scalar()
    db.flush()
    run = db.get(AdsSyncRun, created) if created else active_run(db, workspace_id, kind)
    if run is None:  # pragma: no cover — the conflicting run finished in between
        raise ConflictError("A sync just finished; try again.")
    return EnqueueResult(run, bool(created))


def claim(db: Session, run_id: str) -> AdsSyncRun | None:
    now = utcnow()
    claimed = db.execute(
        update(AdsSyncRun).where(AdsSyncRun.id == run_id, AdsSyncRun.status == "queued")
        .values(status="running", started_at=now, lease_expires_at=now + LEASE)
        .returning(AdsSyncRun.id).execution_options(synchronize_session=False)
    ).scalar()
    db.commit()
    return db.get(AdsSyncRun, claimed, populate_existing=True) if claimed else None


def _finish(run: AdsSyncRun, status: str, *, counts: dict | None = None, code: str | None = None, message: str | None = None) -> None:
    run.status = status
    run.finished_at = utcnow()
    run.lease_expires_at = None
    if counts is not None:
        run.counts = counts
    run.error_code = code
    run.error_message = clean_error(message) if message else None


# ---------------------------------------------------------------------------------- execute
ClientFactory = Callable[[], MetaAdsClient]


def execute_run(session_factory, settings: Settings, run_id: str, *, client_factory: ClientFactory | None = None,
                signup_fetcher: Callable[..., list[dict]] | None = None) -> str:
    """Run one delivery of a sync run. Safe to call more than once (only one claim succeeds)."""
    with session_factory() as db:
        run = claim(db, run_id)
        if run is None:
            return "skipped"
        bind_workspace(db, run.workspace_id)
        log = {"run": run.id, "kind": run.kind, "trigger": run.trigger}
        logger.info("ads sync started %s", log)
        try:
            if run.kind == "meta":
                check_configured(settings, "meta")
                factory = client_factory or (lambda: MetaAdsClient(settings))
                with factory() as client:
                    counts = run_meta_sync(db, settings, client)
                if settings.ads_signups_configured:
                    try:
                        counts["signups"] = run_signup_sync(db, settings, signup_fetcher=signup_fetcher)
                    except SyncFailed as exc:  # the Meta part succeeded; report the signup problem in the counts
                        db.rollback()
                        counts["signups"] = {"error": exc.code, "message": exc.message}
            else:
                check_configured(settings, "signups")
                counts = {"signups": run_signup_sync(db, settings, signup_fetcher=signup_fetcher)}
            _finish(run, "succeeded", counts=counts)
        except AdsNotConfiguredError as exc:
            db.rollback()
            _finish(run, "failed", code="not_configured", message=exc.message)
        except SyncFailed as exc:
            db.rollback()
            _finish(run, "failed", code=exc.code, message=exc.message)
        except Exception as exc:  # noqa: BLE001 — never leave a run running; log the class only (no payloads/PII)
            db.rollback()
            logger.error("ads sync crashed %s error=%s", log, exc.__class__.__name__)
            _finish(run, "failed", code="internal_error", message=MESSAGES["internal_error"])
        db.commit()
        logger.info("ads sync finished %s status=%s code=%s", log, run.status, run.error_code)
        return run.status


# ------------------------------------------------------------------------------ meta pull
def markers_for(settings: Settings) -> Markers:
    return Markers(investment=settings.ads_investment_question_marker, franchise=settings.ads_franchise_question_marker,
                   education=settings.ads_education_question_marker, esaf=settings.ads_esaf_question_marker)


def run_meta_sync(db: Session, settings: Settings, client: MetaAdsClient) -> dict[str, Any]:
    """Pull everything and persist it. Raises :class:`SyncFailed` (nothing written) on a failed or empty pull."""
    targeting_db = records.load_targeting_db(db)
    result = get_all_real_ads(client, targeting_db=targeting_db, markers=markers_for(settings),
                              account_ids=settings.meta_ads_account_ids or None)
    if result.error:
        code = TOKEN_EXPIRED if result.error == TOKEN_EXPIRED else "meta_error"
        raise SyncFailed(code, MESSAGES.get(code) if code == TOKEN_EXPIRED else f"Meta API error: {result.error}"[:500])
    if not result.ads:
        raise SyncFailed("empty_pull")
    return persist_pull(db, settings, client, result)


def persist_pull(db: Session, settings: Settings, client: MetaAdsClient | None, result: PullResult) -> dict[str, Any]:
    now = utcnow()
    markers = markers_for(settings)
    ads_by_id = {a.ad_id: a for a in db.scalars(select(AdsMetaAd))}
    for rec in result.ads:
        row = ads_by_id.get(rec["ad_id"])
        if row is None:
            row = AdsMetaAd(ad_id=rec["ad_id"])
            db.add(row)
            ads_by_id[rec["ad_id"]] = row
        ts = dict(rec.get("targeting_summary") or {})
        ts["targeted_pincodes"] = sorted(ts.get("targeted_pincodes") or [])
        row.account_id, row.account_name = rec.get("account_id"), rec.get("account_name")
        row.campaign_id, row.campaign_name = rec["campaign_id"], rec.get("campaign_name")
        row.status, row.objective, row.channel = rec.get("status"), rec.get("objective"), channel_for(rec.get("objective"))
        row.created_time = rec.get("created_time")
        row.first_impression_date, row.first_impression_hour = rec.get("first_impression_date"), rec.get("first_impression_hour")
        row.ad_name, row.thumbnail_url = rec.get("ad_name"), rec.get("thumbnail_url")
        row.creative, row.metrics, row.breakdowns = rec.get("creative") or {}, rec.get("metrics") or {}, rec.get("breakdowns") or {}
        row.targeting = ts
        row.lead_form_id = rec.get("lead_form_id")
        row.last_seen_at = now

    # Durable targeting record — only entries a successful fetch changed this run.
    if result.targeting_changed:
        existing = {t.campaign_id: t for t in db.scalars(select(AdsTargetingRecord).where(
            AdsTargetingRecord.campaign_id.in_(result.targeting_changed)))}
        for cid in result.targeting_changed:
            entry = result.targeting_db[cid]
            row = existing.get(cid) or AdsTargetingRecord(campaign_id=cid)
            if cid not in existing:
                db.add(row)
            row.campaign_name, row.ad_name, row.account_name = entry.get("campaign_name"), entry.get("ad_name"), entry.get("account_name")
            row.pincodes, row.locations = list(entry.get("pincodes") or []), list(entry.get("locations") or [])
            row.interests_behaviors, row.setup = entry.get("interests_behaviors") or "", dict(entry.get("setup") or {})

    # Optimisation (successful ad-set reads only).
    if result.optimization:
        opts = {o.campaign_id: o for o in db.scalars(select(AdsOptimization).where(AdsOptimization.campaign_id.in_(list(result.optimization))))}
        for cid, values in result.optimization.items():
            row = opts.get(cid) or AdsOptimization(campaign_id=cid)
            if cid not in opts:
                db.add(row)
            for key, value in values.items():
                setattr(row, key, None if value is None else str(value))

    lead_counts = persist_leads(db, result, markers)
    creative_counts = persist_creatives(db, client, result.ads) if client is not None else {}
    db.flush()
    return {"ads": len(result.ads), "targetingRecordsUpdated": len(result.targeting_changed), "optimization": len(result.optimization),
            "failedLeadForms": len(result.failed_forms), **lead_counts, **creative_counts}


def persist_leads(db: Session, result: PullResult, markers: Markers) -> dict[str, int]:
    pulled_ad_ids = {r["ad_id"] for r in result.ads}
    incoming: dict[str, tuple[dict, str, str | None]] = {}  # lead id → (lead, ad_id, form_id)
    reassigned_forms: set[str] = set()
    for rec in result.ads:
        form_id = rec.get("lead_form_id")
        if form_id and form_id in result.failed_forms:
            continue  # keep whatever is stored for this ad
        if form_id:
            reassigned_forms.add(form_id)
        for lead in rec.get("leads_data", []):
            incoming[str(lead["id"])] = (lead, rec["ad_id"], lead.get("_form_id") or form_id)

    fetched_ids = set(result_form_lead_ids(result))
    stored = {lead.meta_lead_id: lead for lead in db.scalars(select(AdsLead).where(
        AdsLead.meta_lead_id.in_(list(set(incoming) | fetched_ids)) | AdsLead.ad_id.in_(pulled_ad_ids)))}
    new = 0
    for lead_id, (lead, ad_id, form_id) in incoming.items():
        row = stored.get(lead_id)
        if row is None:
            row = AdsLead(meta_lead_id=lead_id)
            db.add(row)
            stored[lead_id] = row
            new += 1
        answers = dict(lead.get("answers") or {})
        name, phone = extract_contact(answers)
        row.ad_id, row.form_id, row.created_time = ad_id, form_id, lead.get("created_time")
        row.answers, row.name, row.phone = answers, name, phone
        row.submitted_pincode = lead.get("submitted_pincode")

    # A lead of a re-fetched form that this run attributed to no ad (or to another ad) loses its old assignment;
    # leads Meta no longer returns (not in this run's form lists) keep theirs.
    for row in stored.values():
        if row.meta_lead_id in incoming:
            continue
        if row.form_id in reassigned_forms and row.meta_lead_id in fetched_ids:
            row.ad_id = None

    # Final qualification for every lead of every pulled ad (AdMarketer's remark pass).
    by_ad = {r["ad_id"]: r for r in result.ads}
    assigned = 0
    for row in stored.values():
        rec = by_ad.get(row.ad_id or "")
        if rec is None:
            continue
        requalify(row, effective_targeted_pincodes(rec, result.targeting_db), markers)
        assigned += 1
    return {"leads": assigned, "newLeads": new}


def requalify(row: AdsLead, targeted: set[str], markers: Markers) -> None:
    """Recompute a stored lead's qualification (staff-set ESAF answers win and survive syncs)."""
    staff_esaf = row.esaf_response if row.esaf_response_source == "staff" else None
    lead = {"submitted_pincode": row.submitted_pincode, "answers": row.answers or {}}
    qualify_lead(lead, targeted, markers, staff_esaf=staff_esaf)
    row.pincode_qualified, row.passes_screening, row.qualified = lead["pincode_qualified"], lead["passes_screening_questions"], lead["qualified"]
    row.pincode_match, row.education_answer, row.education_level = lead["pincode_match"], lead["education_answer"], lead["education_level"]
    row.education_ok, row.can_invest = lead["education_ok"], lead["can_invest"]
    row.esaf_response, row.esaf_response_source = lead["esaf_response"], lead["esaf_response_source"]
    row.qualification_status = lead["qualification_status"]


def result_form_lead_ids(result: PullResult) -> list[str]:
    return [i for ids in result.form_lead_ids.values() for i in ids]


def persist_creatives(db: Session, client: MetaAdsClient, ads: list[dict]) -> dict[str, int]:
    """AdMarketer ``_persist_creatives`` into ``ads_creatives`` / ``ads_creative_images``."""
    todo = [r for r in ads if r.get("creative")]
    if not todo:
        return {"creatives": 0, "imagesDownloaded": 0}
    ids = [r["ad_id"] for r in todo]
    creatives = {c.ad_id: c for c in db.scalars(select(AdsCreative).where(AdsCreative.ad_id.in_(ids)))}
    images = {i.ad_id: i for i in db.scalars(select(AdsCreativeImage).where(AdsCreativeImage.ad_id.in_(ids)))}
    need_full = [r for r in todo if not (creatives.get(r["ad_id"]) and creatives[r["ad_id"]].image_full)]
    need_ids = {r["ad_id"] for r in need_full}
    full_urls: dict[str, str] = {}
    if need_full:
        fetcher = AdsFetcher(client)
        by_account: dict[str, set[str]] = {}
        for r in need_full:
            h = (r.get("creative") or {}).get("image_hash")
            if h and r.get("account_id"):
                by_account.setdefault(r["account_id"], set()).add(h)
        for account_id, hashes in by_account.items():
            full_urls.update(fetcher.ad_image_urls(account_id, sorted(hashes)))

    def fetch(r: dict) -> tuple[bytes, str, bool] | None:
        c = r["creative"]
        full_url = full_urls.get(c.get("image_hash") or "", "")
        replace = bool(full_url) and r["ad_id"] in need_ids
        if r["ad_id"] in images and not replace:
            return None
        for url, is_full in ((full_url, True), (c.get("image_url"), True), (c.get("thumbnail_url"), False)):
            got = client.download_image(url or "")
            if got:
                return got[0], got[1], is_full
        return None

    with ThreadPoolExecutor(max_workers=4) as pool:
        fetched = list(pool.map(fetch, todo))

    downloaded = 0
    for r, got in zip(todo, fetched, strict=True):
        c = r["creative"]
        old = creatives.get(r["ad_id"])
        if old is None:
            old = AdsCreative(ad_id=r["ad_id"], type="unknown", primary_text="", headline="", description="", cta="", image_hash="", image_full=False)
            db.add(old)
            creatives[r["ad_id"]] = old
        old.campaign_id, old.account_name, old.built = r["campaign_id"], r.get("account_name"), (r.get("created_time") or "")[:10]
        old.type = c["type"] if c.get("type") and c["type"] != "unknown" else (old.type or "unknown")
        for key in ("primary_text", "headline", "description", "cta", "image_hash"):
            setattr(old, key, c.get(key) or getattr(old, key) or "")
        is_full = False
        if got is not None:
            data, ctype, is_full = got
            img = images.get(r["ad_id"])
            if img is None:
                img = AdsCreativeImage(ad_id=r["ad_id"])
                db.add(img)
                images[r["ad_id"]] = img
            img.data, img.content_type, img.byte_size, img.is_full = data, ctype[:32], len(data), is_full
            downloaded += 1
        old.image_full = bool(is_full or old.image_full)
    return {"creatives": len(todo), "imagesDownloaded": downloaded}


# ---------------------------------------------------------------------------- signup pull
def run_signup_sync(db: Session, settings: Settings, *, signup_fetcher: Callable[..., list[dict]] | None = None) -> dict[str, Any]:
    """Fetch website signups (reports role's ``signups.fetch_all_signups``) and upsert them by id. An empty or failed
    fetch writes nothing."""
    if signup_fetcher is None:
        try:
            from app.services.ads.signups import fetch_all_signups as signup_fetcher  # type: ignore[no-redef]
        except ImportError:
            raise SyncFailed("signups_unavailable", "The website signup fetcher is not installed on this server.") from None
    try:
        signups = signup_fetcher(settings, records.known_campaign_names(db))
    except Exception as exc:  # noqa: BLE001 — the fetcher's own error; redact before storing
        message = clean_error(str(exc)) or "Could not reach the signup admin."
        if settings.eko_signup_admin_password:
            message = message.replace(settings.eko_signup_admin_password.get_secret_value(), "REDACTED")
        raise SyncFailed("signups_error", f"Could not load website signups: {message}"[:500]) from None
    if not signups:
        return {"signups": 0, "newSignups": 0}
    ids = [str(s.get("id")) for s in signups if s.get("id") is not None]
    existing = {s.signup_id: s for s in db.scalars(select(AdsWebsiteSignup).where(AdsWebsiteSignup.signup_id.in_(ids)))}
    new = 0
    for s in signups:
        if s.get("id") is None:
            continue
        sid = str(s["id"])
        row = existing.get(sid)
        if row is None:
            row = AdsWebsiteSignup(signup_id=sid)
            db.add(row)
            existing[sid] = row
            new += 1
        for fld in records.SIGNUP_FIELDS:
            value = s.get(fld)
            if fld == "attribution_tier":
                value = value if value in ("campaign_matched", "fbclid_only", "none") else "none"
            elif fld in ("utm_source", "utm_medium", "utm_campaign"):
                value = value or ""
            elif value is not None and not isinstance(value, str):
                value = str(value)
            setattr(row, fld, value)
        row.extra = {k: v for k, v in s.items() if k not in records.SIGNUP_FIELDS and k != "id" and _jsonable(v)}
    db.flush()
    return {"signups": len(ids), "newSignups": new}


def _jsonable(value: object) -> bool:
    return isinstance(value, str | int | float | bool | type(None) | list | dict)


# ------------------------------------------------------------------- schedule & recovery
def schedule_due(db: Session, settings: Settings, dispatcher: Dispatcher | None) -> int:
    """Queue a scheduled Meta sync when the interval elapsed (one per workspace; advisory lock against double beat)."""
    if not settings.sync_scheduler_enabled or not settings.meta_ads_configured:
        return 0
    if not db.execute(text("SELECT pg_try_advisory_xact_lock(:k)"), {"k": SCHEDULER_LOCK}).scalar():
        return 0
    try:
        workspace_id = resolve_workspace_id(db, settings)
    except AdsWorkspaceError as exc:
        logger.warning("ads scheduler skipped: %s", exc.message)
        db.commit()
        return 0
    last = db.scalar(select(func.max(AdsSyncRun.queued_at)).where(AdsSyncRun.workspace_id == workspace_id, AdsSyncRun.kind == "meta"))
    # 90 % of the interval so a beat firing exactly on the interval is not skipped by a few seconds.
    if last is not None and last > utcnow() - timedelta(minutes=settings.meta_ads_sync_interval_minutes * 0.9):
        db.commit()
        return 0
    result = enqueue(db, settings, workspace_id, kind="meta", trigger="scheduled")
    db.commit()
    if result.created and dispatcher:
        dispatcher(result.run.id, 0.0)
    return int(result.created)


def reap_stale_runs(db: Session) -> int:
    now = utcnow()
    stale = list(db.scalars(select(AdsSyncRun).where(AdsSyncRun.status == "running", AdsSyncRun.lease_expires_at < now)
                            .with_for_update(skip_locked=True)))
    for run in stale:
        _finish(run, "failed", code="worker_lost", message=MESSAGES["worker_lost"])
    db.commit()
    return len(stale)


def dispatch_due_runs(db: Session, dispatcher: Dispatcher, *, limit: int = 20) -> int:
    ids = list(db.scalars(select(AdsSyncRun.id).where(AdsSyncRun.status == "queued", AdsSyncRun.queued_at < utcnow() - UNDELIVERED_AFTER)
                          .order_by(AdsSyncRun.queued_at).limit(limit)))
    for run_id in ids:
        dispatcher(run_id, 0.0)
    return len(ids)


# ------------------------------------------------------------------------------------ status
def last_finished(db: Session, kind: str) -> AdsSyncRun | None:
    return db.scalar(select(AdsSyncRun).where(AdsSyncRun.kind == kind, AdsSyncRun.status.in_(("succeeded", "failed")))
                     .order_by(AdsSyncRun.finished_at.desc().nulls_last()).limit(1))


def last_success_at(db: Session, kind: str = "meta") -> datetime | None:
    return db.scalar(select(func.max(AdsSyncRun.finished_at)).where(AdsSyncRun.kind == kind, AdsSyncRun.status == "succeeded"))
