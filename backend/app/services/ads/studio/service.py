"""Ad Studio persistence + orchestration (port of AdMarketer webapp ``/run``, ``/activate``, ``/refresh_insights``).

Flow:
1. ``create_draft``   — validate copy against the locked rules, resolve targeting, build the exact Meta payload and store it
                        (``mode=dry_run``, ``status=built``). Nothing is sent anywhere.
2. picture            — upload (validated JPEG/PNG/WebP) or generate (Pollinations, only when enabled); payload is rebuilt.
3. ``publish_live``   — ``ads:manage`` + Meta configured: creates Campaign → Ad Set → (image) → Creative → Ad, all PAUSED.
                        Either with the server token (META_ADS_*), or with a connected Instagram account's Unified-login
                        token (``ads_management``): then the ad account is the one picked when connecting, the creative names
                        the Instagram account and the ad runs on Instagram placements only.
4. ``activate``       — ``ads:manage``, explicit confirmation of the daily budget: flips the three objects to ACTIVE.
5. ``insights``       — real Meta insights for a live draft (+ rule-based advice); a dry run has no metrics (AdMarketer
                        showed random mock numbers there; SocialBoard does not).
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, undefer

from app.core.config import Settings
from app.core.errors import ApiError, ConflictError, NotFoundError, UnprocessableError
from app.models import AdsReferenceDataset, AdsStudioDraft, InstagramConnection, InstagramToken, TeamMember
from app.models.enums import IgConnectionStatus
from app.services.audit import record_user_change

from . import adcopy, images, optimizer, payload as payload_builder, publish as publisher, rules, targeting as tg
from .meta import MetaConfig, MetaPublishError, MetaStudioClient, parse_insights

UNTESTED_LIVE_NOTE = ("Live publishing, activation and insights follow AdMarketer's Meta calls but have not been tested against real Meta "
                      "(only against a simulated Meta in automated tests). Check the result in Ads Manager.")
DRY_RUN_NOTE = "Dry run: nothing was sent to Facebook. This is the exact payload that would be sent."
COMPOSE_NOTE = ("The picture is used as-is: AdMarketer's text-on-picture compositor (Playwright) was not ported. "
                "Add text to the picture in a design tool before uploading if you need it.")


class StudioNotConfiguredError(ApiError):
    status_code = 409
    code = "not_configured"


class StudioMetaError(ApiError):
    status_code = 502
    code = "meta_error"


class ImageServiceError(ApiError):
    status_code = 502
    code = "image_service_error"


# ------------------------------------------------------------------------------------------------- config
def publish_missing(settings: Settings) -> list[str]:
    return [name for name, value in (("META_ADS_ACCESS_TOKEN", settings.meta_ads_access_token),
                                     ("META_ADS_PUBLISH_ACCOUNT_ID", settings.meta_ads_publish_account_id),
                                     ("META_ADS_PAGE_ID", settings.meta_ads_page_id)) if not value]


def meta_config(settings: Settings) -> MetaConfig:
    missing = publish_missing(settings)
    if missing:
        raise StudioNotConfiguredError("Live publishing is not configured. Add " + ", ".join(missing) + " to backend/.env.",
                                       details={"missing": missing})
    return MetaConfig(token=settings.meta_ads_access_token.get_secret_value(), api_version=settings.meta_ads_api_version,  # type: ignore[union-attr]
                      account_id=settings.meta_ads_publish_account_id or "", page_id=settings.meta_ads_page_id or "",
                      timeout=settings.meta_ads_http_timeout_seconds)


ADS_SCOPE = "ads_management"


def instagram_ad_accounts(db: Session, settings: Settings) -> list[InstagramConnection]:
    """Connected Instagram accounts whose (Unified login) token can create ads."""
    if not settings.instagram_enabled or settings.instagram_login_flow != "unified":
        return []
    rows = db.scalars(select(InstagramConnection).where(InstagramConnection.status == IgConnectionStatus.connected)
                      .order_by(InstagramConnection.connected_at))
    return [c for c in rows if ADS_SCOPE in (c.granted_scopes or [])]


def _instagram_token(db: Session, settings: Settings, connection: InstagramConnection) -> str:
    from app.services.instagram.crypto import TokenCipher, TokenDecryptError

    row = db.get(InstagramToken, connection.id)
    if row is None or (row.expires_at and row.expires_at <= datetime.now(timezone.utc)):
        raise StudioNotConfiguredError(f"@{connection.username} has no valid token. Reconnect the Instagram account.")
    try:
        return TokenCipher.from_settings(settings).decrypt(row.ciphertext, row.key_version)
    except TokenDecryptError:
        raise StudioNotConfiguredError(f"@{connection.username}'s token cannot be decrypted. Reconnect the Instagram account.") from None


def instagram_meta_config(db: Session, settings: Settings, connection_id: str, *, ad_account_id: str | None = None,
                          transport=None) -> tuple[MetaConfig, InstagramConnection]:
    """MetaConfig using a connected Instagram account's token. The ad account is ``ad_account_id`` (stored after the first
    publish), else META_ADS_PUBLISH_ACCOUNT_ID if the token may use it, else the only ad account the token has."""
    connection = next((c for c in instagram_ad_accounts(db, settings) if c.id == connection_id), None)
    if connection is None:
        raise StudioNotConfiguredError("This Instagram account cannot create ads: connect it with Meta Unified login and the "
                                       "ads_management permission (and select an ad account when connecting).")
    token = _instagram_token(db, settings, connection)
    account = (ad_account_id or "").removeprefix("act_")
    if not account:
        probe = MetaConfig(token=token, api_version=settings.meta_ads_api_version, account_id="0", page_id="",
                           timeout=settings.meta_ads_http_timeout_seconds)
        try:
            with MetaStudioClient(probe, transport=transport) as client:
                accounts = [str(a["account_id"]) for a in client.ad_accounts()]
        except MetaPublishError as exc:
            raise StudioMetaError(exc.safe_message, details={"tokenExpired": exc.token_expired}) from None
        wanted = (settings.meta_ads_publish_account_id or "").removeprefix("act_")
        if wanted and wanted in accounts:
            account = wanted
        elif len(accounts) == 1:
            account = accounts[0]
        elif not accounts:
            raise StudioNotConfiguredError(f"@{connection.username} was connected without an ad account. Reconnect it and select "
                                           "the ad account in Meta's login window.")
        else:
            raise StudioNotConfiguredError(f"@{connection.username} can use {len(accounts)} ad accounts. Set META_ADS_PUBLISH_ACCOUNT_ID "
                                           "in backend/.env to the one Ad Studio should use.")
    return MetaConfig(token=token, api_version=settings.meta_ads_api_version, account_id=account, page_id=settings.meta_ads_page_id or "",
                      timeout=settings.meta_ads_http_timeout_seconds), connection


# ------------------------------------------------------------------------------------------- reference data
def load_datasets(db: Session) -> dict[str, list]:
    rows = db.scalars(select(AdsReferenceDataset).options(undefer(AdsReferenceDataset.data))
                      .where(AdsReferenceDataset.name.in_(tg.REFERENCE_DATASETS))).all()
    return {r.name: r.data for r in rows if isinstance(r.data, list)}


# ------------------------------------------------------------------------------------------------- drafts
def get_draft(db: Session, draft_id: str) -> AdsStudioDraft:
    draft = db.get(AdsStudioDraft, draft_id)
    if draft is None:
        raise NotFoundError("Ad Studio draft", draft_id)
    return draft


def list_drafts(db: Session, limit: int = 50) -> list[AdsStudioDraft]:
    return list(db.scalars(select(AdsStudioDraft).order_by(AdsStudioDraft.created_at.desc(), AdsStudioDraft.id).limit(limit)))


def member_names(db: Session, ids: set[str]) -> dict[str, str]:
    if not ids:
        return {}
    return {m.id: m.name for m in db.scalars(select(TeamMember).where(TeamMember.id.in_(ids)))}


def _verified_source(copy: dict) -> str:
    """The client says where the copy came from; a "locked" claim is only kept if the text really is that caption."""
    source = copy.get("source") or "custom"
    if source in ("locked_caption", "locked_caption_fallback"):
        idx = copy.get("caption_index")
        try:
            locked = rules.caption_to_copy(int(idx)) if idx else None
        except ValueError:
            locked = None
        same = locked is not None and all(copy.get(f) == locked[f] for f in ("headline_line1", "subheading", "primary_text", "description", "cta_text"))
        return source if same else "custom"
    return source if source in ("ai", "custom") else "custom"


def normalize_copy(raw: dict) -> dict:
    copy = {k: raw.get(k) for k in ("headline_line1", "headline_line2", "subheading", "primary_text", "description", "cta_text", "headline",
                                     "angle", "caption_index", "ai_model", "source")}
    copy["headline_line2"] = copy.get("headline_line2") or ""
    copy["bullets"] = [b for b in (raw.get("bullets") or []) if b][:4]
    copy["headline"] = (copy.get("headline") or f"{copy['headline_line1'] or ''} {copy['headline_line2']}").strip()
    report = rules.check_copy(copy)
    if not report.ok:
        raise UnprocessableError("The ad copy breaks the locked creative rules.", details={"violations": report.violations})
    copy["cta"] = rules.CTA_TO_META_TYPE[copy["cta_text"]]
    copy["source"] = _verified_source(copy)
    if copy["source"] != "ai":
        copy["ai_model"] = None
    copy["note"] = {"ai": "Written by AI — not pre-approved copy.", "custom": "Edited or custom copy — not one of the pre-approved captions.",
                    "locked_caption_fallback": "Approved locked caption (AI generation was not available)."}.get(copy["source"])
    copy["guardrails"] = report.as_dict()
    return copy


def _rebuild_payload(draft: AdsStudioDraft, settings: Settings) -> None:
    draft.payload = payload_builder.build(brief=draft.brief, copy=draft.copy, targeting=draft.targeting, destination=draft.brief["destination"],
                                          page_id=settings.meta_ads_page_id, pixel_id=settings.meta_ads_pixel_id,
                                          has_image=draft.image_content_type is not None)


def create_draft(db: Session, settings: Settings, *, member_id: str, brief: dict, copy: dict, targeting_in: dict, destination: dict,
                 target_cpa: float | None) -> AdsStudioDraft:
    brief = adcopy.normalize_brief(brief)
    copy = normalize_copy({**copy, "angle": brief["angle"]})
    try:
        url = payload_builder.normalize_url(destination.get("url"))
    except ValueError as exc:
        raise UnprocessableError(str(exc)) from None
    brief["destination"] = {"type": "website", "url": url, "number": (destination.get("number") or None)}
    if targeting_in["age_min"] > targeting_in["age_max"]:
        raise UnprocessableError("Minimum age must not be above maximum age.")
    targeting = tg.resolve(load_datasets(db), **targeting_in)
    draft = AdsStudioDraft(id=f"ads_{secrets.token_hex(8)}", brief=brief, copy=copy, targeting=targeting, mode="dry_run", status="built",
                           guardrails={"max_daily_spend": targeting["daily_budget"], "target_cpa": target_cpa},
                           result={}, meta_ids={}, created_by_member_id=member_id, error=None)
    _rebuild_payload(draft, settings)
    db.add(draft)
    db.flush()
    return draft


def delete_draft(db: Session, draft_id: str) -> None:
    draft = get_draft(db, draft_id)
    if draft.mode == "live":
        raise ConflictError("A draft that was published to Meta is kept as a record and cannot be deleted here.")
    db.delete(draft)
    db.flush()


def _ensure_editable(draft: AdsStudioDraft) -> None:
    if draft.mode == "live":
        raise ConflictError("This ad was already published to Meta; its picture can no longer be changed here.")


def set_image(db: Session, settings: Settings, draft_id: str, data: bytes, declared_type: str | None, *, source: str) -> AdsStudioDraft:
    draft = get_draft(db, draft_id)
    _ensure_editable(draft)
    try:
        content_type = images.validate(data, declared_type)
    except images.ImageError as exc:
        raise UnprocessableError(exc.safe_message) from None
    draft.image = data
    draft.image_content_type = content_type
    draft.result = {**(draft.result or {}), "image_source": source, "image_bytes": len(data)}
    _rebuild_payload(draft, settings)
    db.flush()
    return draft


def clear_image(db: Session, settings: Settings, draft_id: str) -> AdsStudioDraft:
    draft = get_draft(db, draft_id)
    _ensure_editable(draft)
    draft.image = None
    draft.image_content_type = None
    draft.result = {k: v for k, v in (draft.result or {}).items() if k not in ("image_source", "image_bytes")}
    _rebuild_payload(draft, settings)
    db.flush()
    return draft


def generate_image(db: Session, settings: Settings, draft_id: str, *, transport=None) -> AdsStudioDraft:
    if settings.ad_studio_image_provider != "pollinations":
        raise StudioNotConfiguredError("Picture generation is off. Set AD_STUDIO_IMAGE_PROVIDER=pollinations in backend/.env, or upload a picture.")
    draft = get_draft(db, draft_id)
    _ensure_editable(draft)
    try:
        data, content_type = images.generate_pollinations(draft.brief, transport=transport)
    except images.ImageError as exc:
        raise ImageServiceError(exc.safe_message) from None
    return set_image(db, settings, draft_id, data, content_type, source="pollinations")


def image_of(db: Session, draft_id: str) -> tuple[bytes, str]:
    draft = db.scalar(select(AdsStudioDraft).options(undefer(AdsStudioDraft.image)).where(AdsStudioDraft.id == draft_id))
    if draft is None or draft.image is None or draft.image_content_type is None:
        raise NotFoundError("Ad Studio picture", draft_id)
    return draft.image, draft.image_content_type


# ------------------------------------------------------------------------------------------------- live
def _client(settings: Settings, transport) -> MetaStudioClient:
    return MetaStudioClient(meta_config(settings), transport=transport)


def _client_for(db: Session, settings: Settings, draft: AdsStudioDraft, transport) -> MetaStudioClient:
    """The token a live draft was published with: the server token, or the Instagram account's."""
    via = (draft.result or {}).get("publish_via") or {}
    if via.get("instagram_account_id"):
        cfg, _ = instagram_meta_config(db, settings, via["instagram_account_id"], ad_account_id=via.get("ad_account_id"), transport=transport)
        return MetaStudioClient(cfg, transport=transport)
    return _client(settings, transport)


def publish_live(db: Session, settings: Settings, draft_id: str, *, instagram_account_id: str | None = None, transport=None) -> AdsStudioDraft:
    connection: InstagramConnection | None = None
    if instagram_account_id:
        cfg, connection = instagram_meta_config(db, settings, instagram_account_id, transport=transport)
        cfg_client = MetaStudioClient(cfg, transport=transport)
    else:
        cfg_client = _client(settings, transport)  # raises not_configured before anything else
    draft = db.scalar(select(AdsStudioDraft).options(undefer(AdsStudioDraft.image)).where(AdsStudioDraft.id == draft_id).with_for_update())
    if draft is None:
        cfg_client.close()
        raise NotFoundError("Ad Studio draft", draft_id)
    if draft.mode == "live":
        cfg_client.close()
        raise ConflictError("This draft was already published to Meta (paused). Use Activate, or build a new draft.")
    if draft.image is None:
        cfg_client.close()
        raise UnprocessableError("Add a picture (upload or generate) before publishing to Meta.")
    _rebuild_payload(draft, settings)
    with cfg_client as client:
        outcome = publisher.publish(client, draft.payload, image=draft.image, image_content_type=draft.image_content_type,
                                    unresolved=draft.targeting.get("unresolved_districts") or [],
                                    instagram_user_id=connection.ig_user_id if connection else None)
        ad_account = client.account
    draft.mode = "live"
    draft.meta_ids = outcome.meta_ids
    draft.payload = outcome.sent
    draft.result = {**(draft.result or {}), "published_at": _now(), "token_expired": outcome.token_expired}
    if connection is not None:
        draft.result["publish_via"] = {"instagram_account_id": connection.id, "username": connection.username, "ad_account_id": ad_account}
    if outcome.error:
        draft.status = "failed"
        left = ", ".join(k.replace("_id", "").replace("_", " ") for k in outcome.meta_ids if k != "image_hash")
        draft.error = outcome.error + (f" Already created (paused, no spend) and left in Ads Manager: {left}." if left else "")
    else:
        draft.status = "built"
        draft.error = None
    record_user_change(
        db, category="campaigns", kind="Ad Published", icon="campaign", title="Ad Studio: published to Meta (paused)" if not outcome.error else "Ad Studio: publish failed",
        summary=f"Ad Studio draft {draft.id} {'created paused on Meta' if not outcome.error else 'failed to publish'}.",
        target_label=draft.copy.get("headline") or draft.id, target_to="/ads/studio", module="Ads",
        payload={"draftId": draft.id, "metaIds": draft.meta_ids, "status": draft.status,
                 "via": f"@{connection.username}" if connection else "server token"},
        narrative_suffix="Created PAUSED on Meta: nothing spends until someone activates it.")
    db.flush()
    return draft


def activate(db: Session, settings: Settings, draft_id: str, *, confirm_daily_budget: float, transport=None) -> AdsStudioDraft:
    draft = db.scalar(select(AdsStudioDraft).where(AdsStudioDraft.id == draft_id).with_for_update())
    if draft is None:
        raise NotFoundError("Ad Studio draft", draft_id)
    if draft.mode != "live":
        raise ConflictError("This is a dry run: nothing exists on Meta to activate. Publish it first (paused), then activate.")
    if draft.status == "active":
        raise ConflictError("This ad is already active.")
    if draft.status != "built" or not all(draft.meta_ids.get(k) for k in ("campaign_id", "ad_set_id", "ad_id")):
        raise ConflictError("This draft did not finish publishing, so it cannot be activated.")
    budget = float(draft.targeting.get("daily_budget") or 0)
    if abs(float(confirm_daily_budget) - budget) > 0.005:
        raise UnprocessableError(f"Confirm the daily budget of ₹{budget:g} to activate.", details={"dailyBudget": budget})
    with _client_for(db, settings, draft, transport) as client:
        try:
            publisher.activate(client, draft.meta_ids)
        except MetaPublishError as exc:
            draft.error = exc.safe_message
            db.flush()
            raise StudioMetaError(exc.safe_message, details={"tokenExpired": exc.token_expired}) from None
    draft.status = "active"
    draft.error = None
    draft.result = {**(draft.result or {}), "activated_at": _now()}
    record_user_change(
        db, category="campaigns", kind="Ad Activated", icon="campaign", title="Ad Studio: ad activated on Meta",
        summary=f"Ad Studio draft {draft.id} activated with a daily budget of ₹{budget:g}.",
        target_label=draft.copy.get("headline") or draft.id, target_to="/ads/studio", module="Ads",
        payload={"draftId": draft.id, "metaIds": draft.meta_ids, "dailyBudget": budget},
        narrative_suffix="Campaign, ad set and ad were set to ACTIVE on Meta and can now spend.")
    db.flush()
    return draft


def insights(db: Session, settings: Settings, draft_id: str, *, transport=None) -> dict:
    draft = get_draft(db, draft_id)
    guardrails = {"max_daily_spend": draft.guardrails.get("max_daily_spend"), "target_cpa": draft.guardrails.get("target_cpa")}
    base = {"draft_id": draft.id, "mode": draft.mode, "guardrails": guardrails, "metrics": None, "advice": [], "fetched_at": None, "source": "none"}
    if draft.mode != "live" or not draft.meta_ids.get("campaign_id"):
        return {**base, "available": False,
                "note": "No results: this ad was not published to Meta (dry run), so there are no real numbers. "
                        "SocialBoard does not show example numbers."}
    try:
        with _client_for(db, settings, draft, transport) as client:
            row = client.campaign_insights(draft.meta_ids["campaign_id"])
    except MetaPublishError as exc:
        raise StudioMetaError(exc.safe_message, details={"tokenExpired": exc.token_expired}) from None
    metrics = parse_insights(row)
    advice = optimizer.explain(optimizer.evaluate(metrics, guardrails))
    note = "Pulled directly from your ad on Facebook." if row else "Meta has no results for this ad yet (it may be paused or just started)."
    return {**base, "available": True, "source": "live", "metrics": metrics, "advice": advice, "fetched_at": _now(), "note": note + " " + UNTESTED_LIVE_NOTE}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
