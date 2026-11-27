"""Instagram content publishing routes.

Authenticated (mounted with ``require_auth``; tenant-scoped):

    GET  /integrations/instagram/publishing                 read                · capabilities, publishable accounts, limits
    GET  /integrations/instagram/publications               read                · recent posts (?accountId=)
    POST /integrations/instagram/publications               instagram:publish   · publish now or schedule (201)
    GET  /integrations/instagram/publications/{id}          read
    POST /integrations/instagram/publications/{id}/cancel   instagram:publish   · scheduled/queued only
    PUT  /integrations/instagram/publish-assets             instagram:publish   · raw JPEG body (image/jpeg), ≤ 8 MB
    GET  /integrations/instagram/publish-assets/{id}        read                · preview of an uploaded picture
    GET  /integrations/instagram/accounts/{id}/publishing-limit  read           · Meta's 24 h quota for the account

Public (no session — Meta's servers download from here):

    GET  /integrations/instagram/media/{token}.jpg          · an uploaded picture, only while a post using it is pending
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path, Query, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select

from app.api.deps import DB, Ctx, commit, require
from app.api.routes.integrations import make_cipher, make_client
from app.core.errors import ApiError, NotFoundError
from app.models import InstagramConnection, InstagramPublication, InstagramPublishAsset, TeamMember
from app.models.enums import IgConnectionStatus
from app.schemas import instagram as s
from app.services.instagram import connections as conn
from app.services.instagram import publishing as pub_service

router = APIRouter(prefix="/integrations/instagram", tags=["instagram publishing"])
public = APIRouter(prefix="/integrations/instagram", tags=["instagram publishing"])

PublicationId = Annotated[str, Path(min_length=4, max_length=64, pattern=r"^igp_[a-f0-9]+$")]
AssetId = Annotated[str, Path(min_length=4, max_length=64, pattern=r"^iga_[a-f0-9]+$")]
AccountIdPath = Annotated[str, Path(min_length=4, max_length=64, pattern=r"^igc_[a-f0-9]+$")]

NOTES = [
    "Instagram downloads every picture and video from a public https link when the post is published, so links must stay "
    "reachable until then. Pictures must be JPEG.",
    "Meta limits how many posts an account can publish through apps in 24 hours (shown per account).",
    "Live publishing has been tested only against a simulated Instagram API, not the real one. Check the post on Instagram.",
]


class PayloadTooLargeError(ApiError):
    status_code = 413
    code = "payload_too_large"


def _dispatcher(request: Request):
    return getattr(request.app.state, "job_dispatcher", None)


def _publication_out(db, p: InstagramPublication, *, names: dict[str, str] | None = None,
                     usernames: dict[str, str] | None = None, can_publish: bool = False) -> s.PublicationOut:
    if usernames is None:
        connection = db.get(InstagramConnection, p.connection_id)
        usernames = {p.connection_id: connection.username} if connection else {}
    if names is None:
        member = db.get(TeamMember, p.created_by_member_id) if p.created_by_member_id else None
        names = {member.id: member.name} if member else {}
    options = p.options or {}
    items = [s.PublicationItemOut(type=i.get("type", "image"), url=i.get("url"), asset_id=i.get("asset_id"),
                                  preview_url=f"/api/v1/integrations/instagram/publish-assets/{i['asset_id']}" if i.get("asset_id") else i.get("url"))
             for i in (p.items or []) if isinstance(i, dict)]
    return s.PublicationOut(
        id=p.id, account_id=p.connection_id, account_username=usernames.get(p.connection_id), kind=p.kind, caption=p.caption, items=items,
        share_to_feed=options.get("share_to_feed") if p.kind == "reel" else None, alt_text=options.get("alt_text"),
        cover_url=options.get("cover_url"), status=p.status, scheduled_at=p.scheduled_at, published_at=p.published_at,
        ig_media_id=p.ig_media_id, permalink=p.permalink, error_code=p.error_code, error_message=p.error_message, created_at=p.created_at,
        created_by_name=names.get(p.created_by_member_id or ""), can_cancel=can_publish and p.status in ("scheduled", "queued"))


@router.get("/publishing", response_model=s.PublishingStatusOut, summary="Can this workspace publish, and to which accounts?")
def publishing_status(request: Request, db: DB, ctx: Ctx):
    settings = request.app.state.settings
    accounts = []
    for c in db.scalars(select(InstagramConnection).where(InstagramConnection.status != IgConnectionStatus.disconnected)
                        .order_by(InstagramConnection.connected_at)):
        reason = None
        if c.status != IgConnectionStatus.connected:
            reason = "Reconnect this account first."
        elif not pub_service.has_publish_scope(c.granted_scopes):
            reason = "Connected without the content publishing permission. Add instagram_content_publish to the Meta configuration and reconnect."
        accounts.append(s.PublishingAccountOut(id=c.id, username=c.username, profile_picture_url=c.profile_picture_url,
                                               can_publish=reason is None, reason=reason))
    notes = list(NOTES)
    if pub_service.public_base(settings) is None:
        notes.insert(0, "Uploading pictures needs SocialBoard's API on a public https address (INSTAGRAM_REDIRECT_URI). "
                        "Until then, use links to pictures that are already online.")
    return s.PublishingStatusOut(
        enabled=settings.instagram_enabled, can_publish=ctx.can("instagram:publish"),
        uploads_available=pub_service.public_base(settings) is not None, accounts=accounts,
        limits={"captionMax": pub_service.MAX_CAPTION, "hashtagsMax": pub_service.MAX_HASHTAGS, "mentionsMax": pub_service.MAX_MENTIONS,
                "carouselMin": pub_service.CAROUSEL_MIN, "carouselMax": pub_service.CAROUSEL_MAX, "altTextMax": pub_service.MAX_ALT_TEXT,
                "imageMaxBytes": pub_service.MAX_IMAGE_BYTES, "scheduleMaxDays": pub_service.MAX_SCHEDULE_AHEAD.days},
        notes=notes)


@router.get("/publications", response_model=list[s.PublicationOut], summary="Recent posts (newest first)")
def list_publications(db: DB, ctx: Ctx, account_id: Annotated[str | None, Query(alias="accountId", max_length=64, pattern=r"^igc_[a-f0-9]+$")] = None,
                      limit: Annotated[int, Query(ge=1, le=200)] = 50):
    rows = pub_service.list_publications(db, connection_id=account_id, limit=limit)
    usernames = {c.id: c.username for c in db.scalars(select(InstagramConnection).where(InstagramConnection.id.in_({r.connection_id for r in rows})))}
    member_ids = {r.created_by_member_id for r in rows if r.created_by_member_id}
    names = {m.id: m.name for m in db.scalars(select(TeamMember).where(TeamMember.id.in_(member_ids)))} if member_ids else {}
    can = ctx.can("instagram:publish")
    return [_publication_out(db, r, names=names, usernames=usernames, can_publish=can) for r in rows]


@router.post("/publications", response_model=s.PublicationOut, status_code=status.HTTP_201_CREATED,
             summary="Publish a post now, or schedule it (the background worker publishes it)")
def create_publication(request: Request, db: DB, ctx: Ctx, body: s.PublicationCreateIn, _perm=require("instagram:publish")):
    settings = request.app.state.settings
    conn.ensure_enabled(settings)
    dispatcher = _dispatcher(request)
    if dispatcher is None:
        raise pub_service.PublishingUnavailableError("Background jobs are not configured (REDIS_URL), so posts cannot be published.")
    p = pub_service.create_publication(
        db, settings, member_id=ctx.member_id, connection_id=body.account_id, kind=body.kind, caption=body.caption,
        items=[pub_service.ItemIn(type=i.type, url=i.url, asset_id=i.asset_id) for i in body.items], scheduled_at=body.scheduled_at,
        share_to_feed=body.share_to_feed, alt_text=body.alt_text, cover_url=body.cover_url)
    out = _publication_out(db, p, can_publish=True)
    db.commit()
    if p.status == "queued":
        dispatcher(p.id, 0.0)
    return out


@router.get("/publications/{publication_id}", response_model=s.PublicationOut)
def get_publication(db: DB, ctx: Ctx, publication_id: PublicationId):
    return _publication_out(db, pub_service.get_publication(db, publication_id), can_publish=ctx.can("instagram:publish"))


@router.post("/publications/{publication_id}/cancel", response_model=s.PublicationOut, summary="Cancel a scheduled or queued post")
def cancel_publication(db: DB, ctx: Ctx, publication_id: PublicationId, _perm=require("instagram:publish")):
    p = pub_service.cancel(db, publication_id)
    return commit(db, _publication_out(db, p, can_publish=True))


@router.put("/publish-assets", response_model=s.PublishAssetOut, status_code=status.HTTP_201_CREATED,
            openapi_extra={"requestBody": {"content": {"image/jpeg": {"schema": {"type": "string", "format": "binary"}}}}},
            summary="Upload a JPEG for a post (raw body)")
async def upload_asset(request: Request, db: DB, ctx: Ctx, _perm=require("instagram:publish")):
    limit = pub_service.MAX_IMAGE_BYTES
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > limit:
        raise PayloadTooLargeError("The picture is too large (max 8 MB).")
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > limit:
            raise PayloadTooLargeError("The picture is too large (max 8 MB).")

    def _store() -> s.PublishAssetOut:
        asset = pub_service.store_asset(db, member_id=ctx.member_id, data=bytes(data), declared_type=request.headers.get("content-type"))
        size = asset.__dict__.get("_dimensions") or (None, None)
        out = s.PublishAssetOut(id=asset.id, byte_size=asset.byte_size, width=size[0], height=size[1],
                                preview_url=f"/api/v1/integrations/instagram/publish-assets/{asset.id}")
        return commit(db, out)

    return await run_in_threadpool(_store)


@router.get("/publish-assets/{asset_id}", summary="Preview an uploaded picture")
def get_asset(db: DB, asset_id: AssetId):
    asset = db.get(InstagramPublishAsset, asset_id)
    if asset is None:
        raise NotFoundError("Picture", asset_id)
    db.refresh(asset, ["data"])
    return Response(content=asset.data, media_type=asset.content_type,
                    headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"})


@router.get("/accounts/{account_id}/publishing-limit", response_model=s.PublishingLimitOut,
            summary="Meta's publishing quota for the account (posts in the last 24 h)")
def publishing_limit(request: Request, db: DB, account_id: AccountIdPath):
    conn.ensure_enabled(request.app.state.settings)
    client = make_client(request)
    try:
        return s.PublishingLimitOut(**pub_service.publishing_limit(db, request.app.state.settings, client, make_cipher(request), account_id))
    finally:
        client.close()


# ----------------------------------------------------------------------------------- public
@public.get("/media/{token}.jpg", include_in_schema=False)
def public_media(db: DB, token: Annotated[str, Path(min_length=20, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")]):
    found = pub_service.public_asset(db, token)
    if found is None:
        raise NotFoundError("Picture", "media")
    data, content_type = found
    return Response(content=data, media_type=content_type,
                    headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex"})
