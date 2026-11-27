"""Publishing posts to a connected Instagram professional account (photo, carousel, reel, story).

Meta's flow (developers.facebook.com/documentation/instagram-platform/content-publishing, checked 2026-11-27):

1. ``POST /<IG_ID>/media`` creates a *container* from media at a **public URL** (Meta fetches it; images must be JPEG).
   A carousel needs one container per item (``is_carousel_item=true``) and then a parent (``media_type=CAROUSEL``).
2. Video containers are processed asynchronously: ``GET /<CONTAINER_ID>?fields=status_code`` until ``FINISHED``
   (Meta suggests checking once a minute for at most 5 minutes; we allow ``PROCESSING_TIMEOUT``).
3. ``POST /<IG_ID>/media_publish`` with ``creation_id`` publishes it. Accounts may publish a limited number of posts per
   24 h (``/content_publishing_limit``; 50 at the time of writing).

Everything runs in the background worker as a small state machine stored on ``InstagramPublication``: a post is
``scheduled`` (waiting for its time) → ``queued`` → ``publishing`` (containers created, waiting for Meta) →
``published`` | ``failed``; ``scheduled``/``queued`` posts can be ``cancelled``. ``media_publish`` is never retried
blindly: before publishing again the container's status is checked, and ``PUBLISHED`` means it already went out.

Uploaded pictures (``InstagramPublishAsset``) are served to Meta at ``<API>/integrations/instagram/media/<token>.jpg``
— an unguessable, unauthenticated URL that only answers while a post using the picture is waiting to be published.
"""

from __future__ import annotations

import logging
import re
import secrets
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from urllib.parse import urlparse

from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import ApiError, ConflictError, NotFoundError, UnprocessableError
from app.core.tenancy import bind_workspace
from app.models import InstagramConnection, InstagramPublication, InstagramPublishAsset, InstagramToken
from app.models.enums import IgConnectionStatus
from app.services.audit import record_activity
from app.services.common import utcnow

from .connections import mark_needs_reauth
from .crypto import TokenCipher, TokenDecryptError
from .provider import InstagramClient, ProviderError

logger = logging.getLogger("socialboard.instagram.publish")

PUBLISH_SCOPES = frozenset({"instagram_content_publish", "instagram_business_content_publish"})
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_CAPTION = 2200
MAX_HASHTAGS = 30
MAX_MENTIONS = 20
MAX_ALT_TEXT = 1000
CAROUSEL_MIN, CAROUSEL_MAX = 2, 10
MAX_SCHEDULE_AHEAD = timedelta(days=75)
MIN_SCHEDULE_AHEAD = timedelta(minutes=1)
# How long Meta may take to process a container (videos) before the post fails.
PROCESSING_TIMEOUT = timedelta(minutes=15)
FIRST_CHECK_IMAGE = 5.0      # seconds
FIRST_CHECK_VIDEO = 30.0
CHECK_INTERVAL = 30.0
MAX_ATTEMPTS = 5             # transient provider failures (rate limit / unavailable) before giving up
PENDING = ("scheduled", "queued", "publishing")
Dispatcher = Callable[[str, float], None]


class PublishingUnavailableError(ApiError):
    status_code = 409
    code = "publishing_unavailable"


def has_publish_scope(scopes) -> bool:
    return bool(PUBLISH_SCOPES & set(scopes or []))


def public_base(settings: Settings) -> str | None:
    """``https://<api>/api/v1/integrations/instagram`` derived from the registered redirect URI (Meta must reach it)."""
    uri = settings.instagram_redirect_uri or ""
    if not uri.startswith("https://"):
        return None
    return uri.rstrip("/").rsplit("/callback", 1)[0]


def asset_url(settings: Settings, asset: InstagramPublishAsset) -> str | None:
    base = public_base(settings)
    return f"{base}/media/{asset.public_token}.jpg" if base else None


# ------------------------------------------------------------------------------------------ assets
def _jpeg_size(data: bytes) -> tuple[int, int] | None:
    """(width, height) from the first SOF marker, or None if it cannot be read."""
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        length = int.from_bytes(data[i + 2:i + 4], "big")
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            height = int.from_bytes(data[i + 5:i + 7], "big")
            width = int.from_bytes(data[i + 7:i + 9], "big")
            return (width, height) if width and height else None
        if length < 2:
            return None
        i += 2 + length
    return None


def store_asset(db: Session, *, member_id: str | None, data: bytes, declared_type: str | None) -> InstagramPublishAsset:
    if not data:
        raise UnprocessableError("The picture is empty.")
    if len(data) > MAX_IMAGE_BYTES:
        raise UnprocessableError("The picture is too large (max 8 MB).")
    if not data.startswith(b"\xff\xd8\xff"):
        raise UnprocessableError("Instagram only accepts JPEG pictures for posts. Save the picture as .jpg and try again.")
    if declared_type and declared_type.split(";")[0].strip().lower() not in ("image/jpeg", "image/jpg"):
        raise UnprocessableError("Instagram only accepts JPEG pictures for posts (Content-Type image/jpeg).")
    size = _jpeg_size(data)
    asset = InstagramPublishAsset(id=f"iga_{secrets.token_hex(8)}", public_token=secrets.token_urlsafe(32), content_type="image/jpeg",
                                  byte_size=len(data), data=data, created_by_member_id=member_id)
    db.add(asset)
    db.flush()
    asset.__dict__["_dimensions"] = size  # transient, for the response
    return asset


def public_asset(db: Session, token: str) -> tuple[bytes, str] | None:
    """Bytes for Meta's fetch — only while a pending post uses this picture. Called without a bound workspace."""
    asset = db.scalar(select(InstagramPublishAsset).where(InstagramPublishAsset.public_token == token))
    if asset is None:
        return None
    pending = db.scalars(select(InstagramPublication.items).where(
        InstagramPublication.workspace_id == asset.workspace_id, InstagramPublication.status.in_(PENDING)))
    if not any(isinstance(item, dict) and item.get("asset_id") == asset.id for items in pending for item in (items or [])):
        return None
    db.refresh(asset, ["data"])
    return asset.data, asset.content_type


# ------------------------------------------------------------------------------------------ create
@dataclass
class ItemIn:
    type: str  # image | video
    url: str | None = None
    asset_id: str | None = None


def _check_url(url: str, what: str) -> str:
    url = url.strip()
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname or len(url) > 2000 or any(c.isspace() for c in url):
        raise UnprocessableError(f"The {what} link must be a public https:// address that Instagram can open.")
    if parsed.hostname in ("localhost", "127.0.0.1") or parsed.hostname.endswith((".local", ".localhost")):
        raise UnprocessableError(f"The {what} link points at this computer; Instagram must be able to download it from the internet.")
    return url


def _check_caption(caption: str | None, kind: str) -> str | None:
    caption = (caption or "").strip() or None
    if caption is None:
        return None
    if kind == "story":
        raise UnprocessableError("Stories cannot have a caption.")
    if len(caption) > MAX_CAPTION:
        raise UnprocessableError(f"The caption is too long (max {MAX_CAPTION} characters).")
    if len(re.findall(r"(?<!\w)#\w", caption)) > MAX_HASHTAGS:
        raise UnprocessableError(f"Instagram allows at most {MAX_HASHTAGS} hashtags.")
    if len(re.findall(r"(?<!\w)@[\w.]+", caption)) > MAX_MENTIONS:
        raise UnprocessableError(f"Instagram allows at most {MAX_MENTIONS} @mentions.")
    return caption


def _check_items(db: Session, settings: Settings, kind: str, items: list[ItemIn]) -> list[dict]:
    types = [i.type for i in items]
    if kind == "image" and types != ["image"]:
        raise UnprocessableError("A photo post needs exactly one picture.")
    if kind == "reel" and types != ["video"]:
        raise UnprocessableError("A reel needs exactly one video.")
    if kind == "story" and len(items) != 1:
        raise UnprocessableError("A story needs exactly one picture or video.")
    if kind == "carousel" and not CAROUSEL_MIN <= len(items) <= CAROUSEL_MAX:
        raise UnprocessableError(f"A carousel needs {CAROUSEL_MIN} to {CAROUSEL_MAX} pictures or videos.")
    out: list[dict] = []
    for item in items:
        if item.type not in ("image", "video"):
            raise UnprocessableError("Each item must be a picture or a video.")
        if bool(item.url) == bool(item.asset_id):
            raise UnprocessableError("Give each item either an uploaded picture or a link, not both.")
        if item.asset_id:
            if item.type != "image":
                raise UnprocessableError("Videos must be given as a public https link (uploading videos is not supported).")
            asset = db.get(InstagramPublishAsset, item.asset_id)
            if asset is None:
                raise UnprocessableError("An uploaded picture was not found. Upload it again.")
            if public_base(settings) is None:
                raise UnprocessableError("Uploaded pictures need SocialBoard's API on a public https address (INSTAGRAM_REDIRECT_URI), "
                                         "because Instagram downloads them from there. Use a picture link instead.")
            out.append({"type": "image", "asset_id": asset.id})
        else:
            out.append({"type": item.type, "url": _check_url(item.url or "", "picture" if item.type == "image" else "video")})
    return out


def usable_connection(db: Session, connection_id: str) -> InstagramConnection:
    connection = db.get(InstagramConnection, connection_id)
    if connection is None or connection.status == IgConnectionStatus.disconnected:
        raise NotFoundError("Instagram account", connection_id)
    if connection.status != IgConnectionStatus.connected:
        raise PublishingUnavailableError("Reconnect this Instagram account before publishing.")
    if not has_publish_scope(connection.granted_scopes):
        raise PublishingUnavailableError("This account was connected without the content publishing permission "
                                         "(instagram_content_publish). Add it to the Meta configuration and reconnect.")
    return connection


def create_publication(db: Session, settings: Settings, *, member_id: str, connection_id: str, kind: str, caption: str | None,
                       items: list[ItemIn], scheduled_at: datetime | None, share_to_feed: bool = True, alt_text: str | None = None,
                       cover_url: str | None = None) -> InstagramPublication:
    if kind not in ("image", "carousel", "reel", "story"):
        raise UnprocessableError("Unknown post type.")
    connection = usable_connection(db, connection_id)
    caption = _check_caption(caption, kind)
    stored = _check_items(db, settings, kind, items)
    options: dict = {}
    if kind == "reel":
        options["share_to_feed"] = bool(share_to_feed)
        if cover_url:
            options["cover_url"] = _check_url(cover_url, "cover picture")
    if alt_text and alt_text.strip():
        if kind != "image":
            raise UnprocessableError("Alt text can only be added to a single photo.")
        if len(alt_text.strip()) > MAX_ALT_TEXT:
            raise UnprocessableError(f"Alt text is too long (max {MAX_ALT_TEXT} characters).")
        options["alt_text"] = alt_text.strip()
    now = utcnow()
    if scheduled_at is not None:
        if scheduled_at.tzinfo is None:
            raise UnprocessableError("The scheduled time needs a time zone.")
        if scheduled_at < now + MIN_SCHEDULE_AHEAD:
            scheduled_at = None  # "now" (or a moment ago) means publish right away
        elif scheduled_at > now + MAX_SCHEDULE_AHEAD:
            raise UnprocessableError("Posts can be scheduled at most 75 days ahead.")
    pub = InstagramPublication(id=f"igp_{secrets.token_hex(8)}", connection_id=connection.id, kind=kind, caption=caption, items=stored,
                               options=options, status="scheduled" if scheduled_at else "queued", scheduled_at=scheduled_at,
                               next_check_at=scheduled_at or now, containers={}, attempts=0, created_by_member_id=member_id)
    db.add(pub)
    db.flush()
    return pub


def get_publication(db: Session, publication_id: str) -> InstagramPublication:
    pub = db.get(InstagramPublication, publication_id)
    if pub is None:
        raise NotFoundError("Instagram post", publication_id)
    return pub


def list_publications(db: Session, *, connection_id: str | None = None, limit: int = 50) -> list[InstagramPublication]:
    stmt = select(InstagramPublication).order_by(InstagramPublication.created_at.desc(), InstagramPublication.id).limit(limit)
    if connection_id:
        stmt = stmt.where(InstagramPublication.connection_id == connection_id)
    return list(db.scalars(stmt))


def cancel(db: Session, publication_id: str) -> InstagramPublication:
    pub = db.scalar(select(InstagramPublication).where(InstagramPublication.id == publication_id).with_for_update())
    if pub is None:
        raise NotFoundError("Instagram post", publication_id)
    if pub.status not in ("scheduled", "queued"):
        raise ConflictError("Only a scheduled or queued post can be cancelled; this one is already being published or finished.")
    pub.status = "cancelled"
    pub.next_check_at = None
    db.flush()
    return pub


# ----------------------------------------------------------------------------------------- worker
def _token(db: Session, cipher: TokenCipher, connection: InstagramConnection) -> str:
    row = db.get(InstagramToken, connection.id)
    if row is None:
        raise _Stop("token_missing", "No access token is stored for this account. Reconnect it.")
    if row.expires_at and row.expires_at <= utcnow():
        raise _Stop("token_expired", "The Instagram access token expired. Reconnect the account.")
    try:
        return cipher.decrypt(row.ciphertext, row.key_version)
    except TokenDecryptError:
        raise _Stop("token_unreadable", "The stored token cannot be decrypted with the configured key. Reconnect the account.") from None


class _Stop(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code, self.message = code, message


def _media_url(db: Session, settings: Settings, item: dict) -> str:
    if item.get("url"):
        return item["url"]
    asset = db.get(InstagramPublishAsset, item.get("asset_id"))
    url = asset_url(settings, asset) if asset else None
    if not url:
        raise _Stop("media_unavailable", "An uploaded picture is no longer available, or SocialBoard has no public https address.")
    return url


def _container_params(kind: str, item: dict, url: str, *, carousel_child: bool, options: dict, caption: str | None) -> dict[str, str]:
    params: dict[str, str] = {}
    key = "image_url" if item["type"] == "image" else "video_url"
    params[key] = url
    if carousel_child:
        params["is_carousel_item"] = "true"
        if item["type"] == "video":
            params["media_type"] = "VIDEO"
        return params
    if kind == "reel":
        params["media_type"] = "REELS"
        params["share_to_feed"] = "true" if options.get("share_to_feed", True) else "false"
        if options.get("cover_url"):
            params["cover_url"] = options["cover_url"]
    elif kind == "story":
        params["media_type"] = "STORIES"
    if options.get("alt_text") and kind == "image":
        params["alt_text"] = options["alt_text"]
    if caption and kind != "story":
        params["caption"] = caption
    return params


def _create_containers(db: Session, settings: Settings, client: InstagramClient, pub: InstagramPublication, token: str, ig_id: str) -> None:
    """Idempotent per step: ids are saved after every container so a retry continues where it stopped."""
    containers = dict(pub.containers or {})
    if pub.kind == "carousel":
        children: list[str] = list(containers.get("children") or [])
        for item in pub.items[len(children):]:
            children.append(client.create_container(token, ig_id, _container_params(pub.kind, item, _media_url(db, settings, item),
                                                                                    carousel_child=True, options={}, caption=None)))
            containers["children"] = children
            pub.containers = dict(containers)
            db.commit()
        if not containers.get("parent"):
            params = {"media_type": "CAROUSEL", "children": ",".join(children)}
            if pub.caption:
                params["caption"] = pub.caption
            containers["parent"] = client.create_container(token, ig_id, params)
    elif not containers.get("parent"):
        item = pub.items[0]
        containers["parent"] = client.create_container(token, ig_id, _container_params(pub.kind, item, _media_url(db, settings, item),
                                                                                       carousel_child=False, options=pub.options or {},
                                                                                       caption=pub.caption))
    pub.containers = dict(containers)
    db.commit()


def _finish(db: Session, pub: InstagramPublication, connection: InstagramConnection | None, status: str, *, code: str | None = None,
            message: str | None = None) -> None:
    pub.status = status
    pub.next_check_at = None
    pub.error_code, pub.error_message = code, message
    if status == "published":
        pub.published_at = utcnow()
    who = f"@{connection.username}" if connection else "Instagram"
    if status == "published":
        title, summary, icon = "Instagram Post Published", f"A {pub.kind} was published on {who}.", "check_circle"
    else:
        title, summary, icon = "Instagram Post Failed", f"A {pub.kind} for {who} could not be published: {message}", "error"
    record_activity(
        db, workspace_id=pub.workspace_id, category="content", kind="Publishing", kind_icon=icon,
        kind_tone="neutral" if status == "published" else "warning", kind_icon_class="text-text-secondary", title=title, summary=summary,
        narrative=summary + (f" Link: {pub.permalink}" if pub.permalink else ""),
        target={"label": who, "to": "/instagram/publish", "module": "Publishing"}, actor_id=pub.created_by_member_id,
        payload={"type": "INSTAGRAM_POST_" + status.upper(), "publication_id": pub.id, "ig_media_id": pub.ig_media_id},
    )


def execute_publication(session_factory, settings: Settings, *, client_factory: Callable[[], InstagramClient],
                        cipher_factory: Callable[[], TokenCipher], dispatcher: Dispatcher | None, publication_id: str) -> str:
    """Advance one post by one step. Safe to call repeatedly or concurrently (the row is locked; not-due calls are no-ops)."""
    with session_factory() as db:
        pub = db.scalar(select(InstagramPublication).where(InstagramPublication.id == publication_id,
                                                           InstagramPublication.status.in_(("queued", "publishing")))
                        .with_for_update(skip_locked=True))
        if pub is None:
            return "skipped"
        now = utcnow()
        if pub.next_check_at and pub.next_check_at > now + timedelta(seconds=2):
            return "not_due"
        bind_workspace(db, pub.workspace_id)
        connection = db.get(InstagramConnection, pub.connection_id)
        retry_in: float | None = None
        if connection is None or connection.status != IgConnectionStatus.connected:
            _finish(db, pub, connection, "failed", code="connection_unavailable", message="The account is disconnected or must be reconnected.")
            db.commit()
            return pub.status
        if pub.started_at is None:
            pub.started_at = now
        pub.status = "publishing"
        # Lease: until this step ends, other deliveries (and the overdue sweep) treat the post as not due.
        pub.next_check_at = now + timedelta(minutes=10)
        db.commit()
        client = client_factory()
        try:
            token = _token(db, cipher_factory(), connection)
            if not (pub.containers or {}).get("parent"):
                _create_containers(db, settings, client, pub, token, connection.ig_user_id)
                retry_in = FIRST_CHECK_VIDEO if any(i["type"] == "video" for i in pub.items) else FIRST_CHECK_IMAGE
            else:
                retry_in = _check_and_publish(db, client, pub, connection, token)
        except _Stop as stop:
            db.rollback()
            _finish(db, pub, connection, "failed", code=stop.code, message=stop.message)
            retry_in = None
        except ProviderError as exc:
            db.rollback()
            retry_in = _provider_failure(db, pub, connection, exc)
        except Exception as exc:  # noqa: BLE001 — never leave a post stuck; log the class only
            db.rollback()
            logger.error("publish job crashed publication=%s error=%s", pub.id, exc.__class__.__name__)
            retry_in = _transient(db, pub, connection, "internal_error", "An internal error interrupted publishing.")
        finally:
            client.close()
        if retry_in is not None and pub.status == "publishing":
            pub.next_check_at = utcnow() + timedelta(seconds=retry_in)
        db.commit()
        status = pub.status
        logger.info("publish step publication=%s status=%s", pub.id, status)
    if retry_in is not None and status == "publishing" and dispatcher:
        dispatcher(publication_id, retry_in)
    return status


def _check_and_publish(db: Session, client: InstagramClient, pub: InstagramPublication, connection: InstagramConnection, token: str) -> float | None:
    containers = pub.containers or {}
    ids = [containers["parent"], *(containers.get("children") or [])]
    codes = {cid: client.container_status(token, cid) for cid in ids}
    parent_code, parent_status = codes[containers["parent"]]
    if parent_code == "PUBLISHED":  # a previous attempt published it but did not record the result
        _finish(db, pub, connection, "published")
        return None
    bad = [(code, status) for code, status in codes.values() if code in ("ERROR", "EXPIRED")]
    if bad:
        code, status = bad[0]
        message = ("Instagram could not process the media" + (f" ({status})" if status else "") +
                   ". Check the format: pictures must be JPEG (aspect ratio 4:5 to 1.91:1), reels MP4/MOV, 3 s to 15 min.")
        if code == "EXPIRED":
            message = "The prepared post expired on Instagram before it was published (containers last 24 hours)."
        _finish(db, pub, connection, "failed", code="container_" + code.lower(), message=message)
        return None
    if any(code != "FINISHED" for code, _ in codes.values()):
        if pub.started_at and utcnow() - pub.started_at > PROCESSING_TIMEOUT:
            _finish(db, pub, connection, "failed", code="processing_timeout",
                    message=f"Instagram was still processing the media after {int(PROCESSING_TIMEOUT.total_seconds() // 60)} minutes.")
            return None
        return CHECK_INTERVAL
    media_id = client.publish_container(token, connection.ig_user_id, containers["parent"])
    pub.ig_media_id = media_id
    db.commit()  # record the id first: a failure below must not lead to a second publish
    try:
        pub.permalink = client.media_permalink(token, media_id)
    except ProviderError:
        pub.permalink = None
    _finish(db, pub, connection, "published")
    return None


def _transient(db: Session, pub: InstagramPublication, connection: InstagramConnection | None, code: str, message: str,
               retry_after: int | None = None) -> float | None:
    pub.attempts = (pub.attempts or 0) + 1
    if pub.attempts >= MAX_ATTEMPTS:
        _finish(db, pub, connection, "failed", code=code, message=message + " Gave up after several attempts.")
        return None
    pub.status = "publishing"
    pub.error_code, pub.error_message = code, message + " Retrying automatically."
    return float(retry_after or min(60 * 2 ** pub.attempts, 1800))


def _provider_failure(db: Session, pub: InstagramPublication, connection: InstagramConnection, exc: ProviderError) -> float | None:
    if exc.kind == "token_invalid":
        mark_needs_reauth(connection, "token_invalid", exc.safe_message)
        _finish(db, pub, connection, "failed", code="token_invalid", message=exc.safe_message)
        return None
    if exc.kind in ("rate_limited", "unavailable", "bad_response"):
        code = {"rate_limited": "rate_limited", "unavailable": "provider_unavailable", "bad_response": "bad_response"}[exc.kind]
        return _transient(db, pub, connection, code, exc.safe_message, retry_after=exc.retry_after)
    if exc.kind == "permission_denied":
        message = "Instagram did not allow publishing: the content publishing permission is missing or the daily post limit was reached."
    else:
        message = "Instagram rejected the post. Check that the media links are public and in a supported format."
    _finish(db, pub, connection, "failed", code=exc.kind, message=message)
    return None


# ------------------------------------------------------------------------------------- scheduling
def dispatch_due(db: Session, dispatcher: Dispatcher, *, limit: int = 50) -> int:
    """Start scheduled posts whose time has come and re-dispatch publishing posts whose check is overdue
    (covers lost queue messages). Called every minute by the maintenance task."""
    now = utcnow()
    db.execute(update(InstagramPublication).where(InstagramPublication.status == "scheduled", InstagramPublication.scheduled_at <= now)
               .values(status="queued", next_check_at=now - timedelta(seconds=10)).execution_options(synchronize_session=False))
    due = list(db.scalars(select(InstagramPublication.id).where(
        InstagramPublication.status.in_(("queued", "publishing")),
        or_(InstagramPublication.next_check_at.is_(None), InstagramPublication.next_check_at <= now - timedelta(seconds=5)))
        .order_by(InstagramPublication.next_check_at).limit(limit)))
    db.commit()
    for publication_id in due:
        dispatcher(publication_id, 0.0)
    return len(due)


def publishing_limit(db: Session, settings: Settings, client: InstagramClient, cipher: TokenCipher, connection_id: str) -> dict:
    connection = usable_connection(db, connection_id)
    try:
        token = _token(db, cipher, connection)
    except _Stop as stop:
        raise PublishingUnavailableError(stop.message) from None
    return client.publishing_limit(token, connection.ig_user_id)
