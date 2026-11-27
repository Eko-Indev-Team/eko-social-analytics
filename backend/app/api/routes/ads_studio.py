"""Ad Studio routes (port of AdMarketer ``/``, ``/run``, ``/activate``, ``/refresh_insights``). All behind ``require_auth``.

    GET    /ads/studio/options                          read   · angles, CTAs, captions, districts, capabilities
    GET    /ads/studio/villages?district=               read   · villages (with PIN codes) of one district
    POST   /ads/studio/copy                             write  · locked caption or AI copy (labelled fallback without AI)
    POST   /ads/studio/targeting                        read   · preview targeting for districts/villages
    POST   /ads/studio/drafts                           write  · build a DRY RUN draft (exact payload stored, nothing sent)
    GET    /ads/studio/drafts · GET /ads/studio/drafts/{id}
    DELETE /ads/studio/drafts/{id}                      write  · dry-run drafts only
    PUT    /ads/studio/drafts/{id}/image                write  · raw JPEG/PNG/WebP body (Content-Type header), ≤ 8 MB
    DELETE /ads/studio/drafts/{id}/image                write
    POST   /ads/studio/drafts/{id}/image/generate       write  · Pollinations, only when AD_STUDIO_IMAGE_PROVIDER=pollinations
    GET    /ads/studio/drafts/{id}/image                read
    POST   /ads/studio/drafts/{id}/publish              ads:manage · LIVE: create Campaign/Ad Set/Ad on Meta, all PAUSED
    POST   /ads/studio/drafts/{id}/activate             ads:manage · LIVE: set ACTIVE (body confirms the daily budget)
    GET    /ads/studio/drafts/{id}/insights             read   · real Meta numbers for a live draft; dry run → no metrics

State-changing routes need the CSRF header (enforced by ``require_auth``).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Body, Path, Query, Request, Response, status
from starlette.concurrency import run_in_threadpool

from app.ai.service import AIGateway
from app.api.deps import DB, Ctx, commit, require
from app.core.errors import ApiError, UnprocessableError
from app.models import AdsStudioDraft
from app.schemas import ads_studio as s
from app.services.ads.studio import adcopy, images, rules, service, targeting as tg

router = APIRouter(prefix="/ads/studio", tags=["ads studio"])

DraftId = Annotated[str, Path(min_length=5, max_length=64, pattern=r"^ads_[a-f0-9]+$")]


class PayloadTooLargeError(ApiError):
    status_code = 413
    code = "payload_too_large"


# ------------------------------------------------------------------------------------------------ helpers
def _settings(request: Request):
    return request.app.state.settings


def _meta_transport(request: Request):
    """Tests inject an ``httpx.MockTransport`` here; production uses the real network."""
    return getattr(request.app.state, "ads_studio_meta_transport", None)


def _gateway(request: Request, db, ctx) -> AIGateway | None:
    settings = _settings(request)
    if not settings.ai_enabled:
        return None
    factory = getattr(request.app.state, "ads_studio_ai_provider_factory", None)
    return AIGateway(settings, db, ctx.workspace_id, provider_factory=factory)


def _copy_out(copy: dict) -> s.AdCopyOut:
    g = copy.get("guardrails") or {}
    return s.AdCopyOut(
        headline_line1=copy.get("headline_line1") or "", headline_line2=copy.get("headline_line2") or "", subheading=copy.get("subheading") or "",
        primary_text=copy.get("primary_text") or "", description=copy.get("description") or "", bullets=list(copy.get("bullets") or []),
        cta_text=copy["cta_text"], cta=copy["cta"], headline=copy.get("headline") or "", angle=copy.get("angle") or "general_opportunity",
        source=copy.get("source") or "custom", caption_index=copy.get("caption_index"), ai_model=copy.get("ai_model"), note=copy.get("note"),
        guardrails=s.CopyGuardrailsOut(ok=g.get("ok", True), violations=g.get("violations", []), removed_phrases=g.get("removed_phrases", []),
                                       cta_replaced=g.get("cta_replaced", False)))


def _targeting_out(t: dict) -> s.TargetingOut:
    return s.TargetingOut(
        districts=t.get("districts", []), removed=t.get("removed", []),
        anchors=[s.AnchorOut(**a) for a in t.get("anchors", [])], villages=[s.VillageOut(**v) for v in t.get("villages", [])],
        pincodes=t.get("pincodes", []), unresolved_districts=t.get("unresolved_districts", []), age_min=t["age_min"], age_max=t["age_max"],
        gender=t["gender"], daily_budget=t["daily_budget"], schedule_days=t["schedule_days"], placements=t["placements"],
        meta_targeting=t.get("meta_targeting", {}), notes=t.get("notes", []))


def _iso(value) -> str:
    return value.isoformat(timespec="seconds") if value else ""


def _summary_fields(d: AdsStudioDraft, names: dict[str, str]) -> dict:
    has_image = d.image_content_type is not None
    return dict(
        id=d.id, status=d.status, mode=d.mode, created_at=_iso(d.created_at), updated_at=_iso(d.updated_at),
        created_by_name=names.get(d.created_by_member_id or ""), headline=(d.copy or {}).get("headline") or "",
        angle=(d.brief or {}).get("angle") or "general_opportunity", objective=(d.brief or {}).get("objective") or "leads",
        copy_source=(d.copy or {}).get("source") or "custom", districts=(d.targeting or {}).get("districts", []),
        pincode_count=len((d.targeting or {}).get("pincodes", [])), daily_budget=float((d.targeting or {}).get("daily_budget") or 0),
        has_image=has_image, image_url=f"/api/v1/ads/studio/drafts/{d.id}/image" if has_image else None,
        meta_ids=s.MetaIdsOut(**{k: v for k, v in (d.meta_ids or {}).items() if k in s.MetaIdsOut.model_fields}), error=d.error)


def _draft_out(request: Request, db, ctx, d: AdsStudioDraft) -> s.DraftOut:
    settings = _settings(request)
    names = service.member_names(db, {d.created_by_member_id} if d.created_by_member_id else set())
    live_ok = not service.publish_missing(settings) or bool(service.instagram_ad_accounts(db, settings))
    result = d.result or {}
    notes: list[str] = []
    if d.mode == "dry_run":
        notes.append(service.DRY_RUN_NOTE)
        if not live_ok:
            notes.append("Live publishing is not configured (needs " + ", ".join(service.publish_missing(settings)) + ", or an Instagram "
                         "account connected with Meta Unified login and the ads_management permission).")
    else:
        notes.append(service.UNTESTED_LIVE_NOTE)
        if d.status == "built":
            notes.append("Created PAUSED on Meta: nothing spends until you activate it.")
    if d.image_content_type is None:
        notes.append("No picture yet: upload one" + (" or generate one" if settings.ad_studio_image_provider == "pollinations" else "") +
                     " (required for a live publish).")
    notes.append(service.COMPOSE_NOTE)
    brief = {k: v for k, v in (d.brief or {}).items() if k != "destination"}
    dest = (d.brief or {}).get("destination") or {"type": "website", "url": rules.DEFAULT_DESTINATION_URL, "number": None}
    meta_complete = all((d.meta_ids or {}).get(k) for k in ("campaign_id", "ad_set_id", "ad_id"))
    return s.DraftOut(
        **_summary_fields(d, names), brief=brief, copy_=_copy_out(d.copy), targeting=_targeting_out(d.targeting),
        destination=s.DestinationOut(type=dest.get("type", "website"), url=dest["url"], number=dest.get("number")),
        guardrails=s.DraftGuardrailsOut(max_daily_spend=(d.guardrails or {}).get("max_daily_spend"), target_cpa=(d.guardrails or {}).get("target_cpa")),
        image_source=result.get("image_source"), payload=d.payload or {},
        can_publish=d.mode == "dry_run" and live_ok and ctx.can("ads:manage") and d.image_content_type is not None,
        can_activate=d.mode == "live" and d.status == "built" and meta_complete and live_ok and ctx.can("ads:manage"),
        published_with=(f"@{via['username']}" if (via := result.get("publish_via") or {}).get("username") else
                        ("server" if d.mode == "live" else None)),
        published_at=result.get("published_at"), activated_at=result.get("activated_at"), notes=notes)


# ------------------------------------------------------------------------------------------------ options
@router.get("/options", response_model=s.StudioOptionsOut)
def studio_options(request: Request, db: DB, ctx: Ctx):
    settings = _settings(request)
    datasets = service.load_datasets(db)
    missing = service.publish_missing(settings)
    ig_accounts = service.instagram_ad_accounts(db, settings)
    notes = [service.COMPOSE_NOTE, service.UNTESTED_LIVE_NOTE]
    if ig_accounts:
        notes.append("You can also publish with a connected Instagram account: the ad then uses that account's ad account and runs on "
                     "Instagram only." + ("" if settings.meta_ads_page_id else " Meta's guide asks for a Facebook Page too; without "
                                          "META_ADS_PAGE_ID Meta may reject the ad."))
    if not datasets:
        notes.append("Reference location data has not been imported, so districts have no map anchors. Run "
                     "`python -m scripts.import_admarketer_reference <dir>` on the server.")
    if not settings.ai_enabled:
        notes.append("AI copy generation is not configured (AI_PROVIDER=none): 'Generate' returns an approved locked caption, labelled as such.")
    return s.StudioOptionsOut(
        angles=[s.OptionItem(id=a, label=rules.ANGLE_LABELS[a], description=rules.ANGLE_GUIDANCE[a]) for a in rules.APPROVED_ANGLES],
        ctas=[s.CtaOut(text=c, meta_type=rules.CTA_TO_META_TYPE[c]) for c in rules.APPROVED_CTAS],
        banned_phrases=list(rules.BANNED_PHRASES),
        locked_captions=[s.LockedCaptionOut(**c) for c in rules.locked_captions()],
        objectives=[s.OptionItem(id=k, label=k.capitalize(), description=v) for k, v in rules.OBJECTIVE_MAP.items()],
        genders=["all", "male", "female"], placements=["advantage", "manual"], languages=["hindi", "english"],
        districts=[s.DistrictOut(**d) for d in tg.districts_available(datasets)],
        reference_data_loaded=bool(datasets),
        defaults=s.StudioDefaultsOut(brief=dict(rules.DEFAULT_BRIEF),
                                     targeting={"ageMin": 21, "ageMax": 45, "gender": "all", "dailyBudget": 500, "scheduleDays": 7, "placements": "advantage"},
                                     destination_url=rules.DEFAULT_DESTINATION_URL, target_cpa=150),
        capabilities=s.CapabilitiesOut(
            ai_copy=settings.ai_enabled, ai_provider=settings.ai_provider if settings.ai_enabled else None,
            image_generation=settings.ad_studio_image_provider == "pollinations", image_provider=settings.ad_studio_image_provider,
            image_upload=True, max_image_bytes=images.MAX_IMAGE_BYTES, accepted_image_types=list(images.ALLOWED_TYPES),
            live_publish=not missing or bool(ig_accounts), live_publish_missing=missing,
            instagram_publish_accounts=[s.InstagramPublishAccountOut(id=c.id, username=c.username) for c in ig_accounts],
            can_edit=ctx.can("write"), can_publish=ctx.can("ads:manage")),
        notes=notes)


@router.get("/villages", response_model=list[s.VillageOut])
def studio_villages(db: DB, district: Annotated[str, Query(min_length=1, max_length=80)]):
    return [s.VillageOut(**v) for v in tg.villages_for_district(service.load_datasets(db), district)]


# ------------------------------------------------------------------------------------------------ copy / targeting
@router.post("/copy", response_model=s.AdCopyOut, dependencies=[require("write")])
def studio_copy(request: Request, db: DB, ctx: Ctx, body: s.CopyRequestIn):
    brief = adcopy.normalize_brief(body.brief.model_dump())
    if body.mode == "locked":
        return _copy_out(adcopy.locked_copy(body.caption_index or 1, angle=brief["angle"]))
    gateway = _gateway(request, db, ctx)
    try:
        copy = adcopy.generate_copy(brief, gateway)
    finally:
        if gateway is not None:
            gateway.close()
    return commit(db, _copy_out(copy))  # AI usage records are durable even if the client goes away


@router.post("/targeting", response_model=s.TargetingOut)
def studio_targeting(db: DB, body: s.TargetingIn):
    if body.age_min > body.age_max:
        raise UnprocessableError("Minimum age must not be above maximum age.")
    return _targeting_out(tg.resolve(service.load_datasets(db), **body.model_dump()))


# ------------------------------------------------------------------------------------------------ drafts
@router.post("/drafts", response_model=s.DraftOut, status_code=status.HTTP_201_CREATED, dependencies=[require("write")])
def create_draft(request: Request, db: DB, ctx: Ctx, body: s.DraftCreateIn):
    draft = service.create_draft(db, _settings(request), member_id=ctx.member_id, brief=body.brief.model_dump(), copy=body.copy_.model_dump(),
                                 targeting_in=body.targeting.model_dump(), destination=body.destination.model_dump(), target_cpa=body.target_cpa)
    return commit(db, _draft_out(request, db, ctx, draft))


@router.get("/drafts", response_model=list[s.DraftSummaryOut])
def list_drafts(db: DB, limit: Annotated[int, Query(ge=1, le=200)] = 50):
    drafts = service.list_drafts(db, limit)
    names = service.member_names(db, {d.created_by_member_id for d in drafts if d.created_by_member_id})
    return [s.DraftSummaryOut(**_summary_fields(d, names)) for d in drafts]


@router.get("/drafts/{draft_id}", response_model=s.DraftOut)
def get_draft(request: Request, db: DB, ctx: Ctx, draft_id: DraftId):
    return _draft_out(request, db, ctx, service.get_draft(db, draft_id))


@router.delete("/drafts/{draft_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[require("write")])
def delete_draft(db: DB, draft_id: DraftId):
    service.delete_draft(db, draft_id)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ------------------------------------------------------------------------------------------------ picture
@router.put("/drafts/{draft_id}/image", response_model=s.DraftOut, dependencies=[require("write")],
            openapi_extra={"requestBody": {"content": {t: {"schema": {"type": "string", "format": "binary"}} for t in images.ALLOWED_TYPES}}})
async def upload_image(request: Request, db: DB, ctx: Ctx, draft_id: DraftId):
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > images.MAX_IMAGE_BYTES:
        raise PayloadTooLargeError(f"The picture is too large (max {images.MAX_IMAGE_BYTES // (1024 * 1024)} MB).")
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > images.MAX_IMAGE_BYTES:
            raise PayloadTooLargeError(f"The picture is too large (max {images.MAX_IMAGE_BYTES // (1024 * 1024)} MB).")

    def _store() -> s.DraftOut:  # database work off the event loop
        draft = service.set_image(db, _settings(request), draft_id, bytes(data), request.headers.get("content-type"), source="upload")
        return commit(db, _draft_out(request, db, ctx, draft))

    return await run_in_threadpool(_store)


@router.delete("/drafts/{draft_id}/image", response_model=s.DraftOut, dependencies=[require("write")])
def delete_image(request: Request, db: DB, ctx: Ctx, draft_id: DraftId):
    draft = service.clear_image(db, _settings(request), draft_id)
    return commit(db, _draft_out(request, db, ctx, draft))


@router.post("/drafts/{draft_id}/image/generate", response_model=s.DraftOut, dependencies=[require("write")])
def generate_image(request: Request, db: DB, ctx: Ctx, draft_id: DraftId):
    draft = service.generate_image(db, _settings(request), draft_id, transport=getattr(request.app.state, "ads_studio_image_transport", None))
    return commit(db, _draft_out(request, db, ctx, draft))


@router.get("/drafts/{draft_id}/image")
def get_image(db: DB, draft_id: DraftId):
    data, content_type = service.image_of(db, draft_id)
    return Response(content=data, media_type=content_type,
                    headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"})


# ------------------------------------------------------------------------------------------------ live
@router.post("/drafts/{draft_id}/publish", response_model=s.DraftOut, dependencies=[require("ads:manage")])
def publish_draft(request: Request, db: DB, ctx: Ctx, draft_id: DraftId, body: Annotated[s.PublishIn | None, Body()] = None):
    draft = service.publish_live(db, _settings(request), draft_id, instagram_account_id=body.instagram_account_id if body else None,
                                 transport=_meta_transport(request))
    return commit(db, _draft_out(request, db, ctx, draft))


@router.post("/drafts/{draft_id}/activate", response_model=s.DraftOut, dependencies=[require("ads:manage")])
def activate_draft(request: Request, db: DB, ctx: Ctx, draft_id: DraftId, body: Annotated[s.ActivateIn, Body()]):
    draft = service.activate(db, _settings(request), draft_id, confirm_daily_budget=body.confirm_daily_budget, transport=_meta_transport(request))
    return commit(db, _draft_out(request, db, ctx, draft))


@router.get("/drafts/{draft_id}/insights", response_model=s.DraftInsightsOut)
def draft_insights(request: Request, db: DB, draft_id: DraftId):
    return service.insights(db, _settings(request), draft_id, transport=_meta_transport(request))
