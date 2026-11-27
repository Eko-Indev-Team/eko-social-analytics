"""Instagram content publishing and Ad Studio publishing with an Instagram account's token — against a *mocked* Meta.

No real Meta credentials, network access or Instagram account are used: every provider response below is fabricated
test data shaped like the documented responses (developers.facebook.com/documentation/instagram-platform/content-publishing).
"""

from __future__ import annotations

import json
from datetime import timedelta
from urllib.parse import parse_qs

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session, sessionmaker

from app.main import create_app
from app.models import AdsStudioDraft, ActivityEvent, InstagramPublication
from app.services.common import utcnow
from app.services.instagram import publishing
from app.services.instagram.crypto import TokenCipher
from app.services.instagram.provider import InstagramClient

from .conftest import api, sign_in
from .test_ads_studio_api import make_draft
from .test_ads_studio_rules import PNG, FakeMeta as FakeAdsMeta
from .test_instagram import IG_ID, callback, ig_settings
from .test_instagram_unified import SUAT, UNIFIED, FakeUnifiedMeta, start_unified

pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")

PUBLISH_SCOPES = ["instagram_basic", "instagram_manage_insights", "instagram_content_publish", "instagram_manage_messages",
                  "ads_management", "ads_read"]
JPEG = b"\xff\xd8\xff\xe0" + b"\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00" + b"\xff\xc0\x00\x11\x08\x04\x38\x04\x38\x03" + b"\x00" * 64 + b"\xff\xd9"


class FakePublishMeta(FakeUnifiedMeta):
    """Adds container creation, status, publish, permalink and quota endpoints."""

    def __init__(self) -> None:
        super().__init__()
        self.scopes = list(PUBLISH_SCOPES)
        self.created: list[dict] = []
        self.status: dict[str, str] = {}
        self.default_status = "FINISHED"
        self.published: list[str] = []

    def handle(self, request: httpx.Request) -> httpx.Response:
        path, params = request.url.path, dict(request.url.params)
        for suffix, queue in self.fail.items():
            if path.endswith(suffix) and queue:
                self.calls.append(request)
                return queue.pop(0)
        if path == f"/v26.0/{IG_ID}/media" and request.method == "POST":
            self.calls.append(request)
            form = {k: v[0] for k, v in parse_qs(request.content.decode()).items()}
            assert params["access_token"] == SUAT
            cid = f"c{len(self.created) + 1}"
            self.created.append({"id": cid, **form})
            self.status.setdefault(cid, self.default_status)
            return httpx.Response(200, json={"id": cid})
        if path == f"/v26.0/{IG_ID}/media_publish":
            self.calls.append(request)
            form = {k: v[0] for k, v in parse_qs(request.content.decode()).items()}
            self.published.append(form["creation_id"])
            self.status[form["creation_id"]] = "PUBLISHED"
            return httpx.Response(200, json={"id": "17900000000000001"})
        if path.startswith("/v26.0/c") and request.method == "GET":
            self.calls.append(request)
            cid = path.rsplit("/", 1)[1]
            code = self.status[cid]
            return httpx.Response(200, json={"status_code": code, "status": "Error: 2207026" if code == "ERROR" else code, "id": cid})
        if path == "/v26.0/17900000000000001":
            self.calls.append(request)
            return httpx.Response(200, json={"permalink": "https://www.instagram.com/p/TEST123/", "id": "17900000000000001"})
        if path == f"/v26.0/{IG_ID}/content_publishing_limit":
            self.calls.append(request)
            return httpx.Response(200, json={"data": [{"quota_usage": 3, "config": {"quota_total": 50, "quota_duration": 86400}}]})
        return super().handle(request)


@pytest.fixture
def meta() -> FakePublishMeta:
    return FakePublishMeta()


@pytest.fixture
def ads_meta() -> FakeAdsMeta:
    return FakeAdsMeta()


@pytest.fixture
def make_app(connection, db_url, meta, ads_meta):
    def _make(**overrides):
        app = create_app(ig_settings(db_url, **{**UNIFIED, **overrides}))
        app.state.session_factory = sessionmaker(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
        app.state.instagram_transport = meta.transport
        app.state.instagram_sleep = lambda _seconds: None
        app.state.ads_studio_meta_transport = ads_meta.transport
        app.state.dispatched = []
        app.state.job_dispatcher = lambda job_id, countdown=0.0: app.state.dispatched.append((job_id, countdown))
        return app
    return _make


@pytest.fixture
def client_as(make_app, connection):
    opened: list[TestClient] = []

    def _make(member_id: str = "usr-mansi", app=None, **overrides) -> TestClient:
        app = app or make_app(**overrides)
        c = TestClient(app, follow_redirects=False)
        c.__enter__()
        opened.append(c)
        return sign_in(app, c, connection, user_id=f"usr_test_{member_id}")

    yield _make
    for c in opened:
        c.__exit__(None, None, None)


@pytest.fixture
def owner(client_as):
    return client_as()


@pytest.fixture
def account(owner, meta) -> str:
    result = callback(owner, code="good-code", state=start_unified(owner))
    assert result["instagram"] == "connected", result
    owner.app.state.dispatched.clear()  # the initial sync job is not under test here
    return result["account"]


def step(app, publication_id: str) -> str:
    """One worker delivery (what the Celery task does)."""
    settings = app.state.settings
    return publishing.execute_publication(
        app.state.session_factory, settings,
        client_factory=lambda: InstagramClient(settings, transport=app.state.instagram_transport, sleep=lambda _s: None),
        cipher_factory=lambda: TokenCipher.from_settings(settings), dispatcher=app.state.job_dispatcher, publication_id=publication_id)


def make_due(connection, publication_id: str) -> None:
    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:
        s.execute(update(InstagramPublication).where(InstagramPublication.id == publication_id)
                  .values(next_check_at=utcnow() - timedelta(seconds=10)))
        s.commit()


def run_until_done(client, connection, publication_id: str, max_steps: int = 8) -> dict:
    for _ in range(max_steps):
        make_due(connection, publication_id)
        status = step(client.app, publication_id)
        if status not in ("publishing", "queued"):
            break
    return client.get(api(f"/integrations/instagram/publications/{publication_id}")).json()


def post(client, **body) -> httpx.Response:
    return client.post(api("/integrations/instagram/publications"), json=body)


# ----------------------------------------------------------------------------------------- status
def test_publishing_status_lists_accounts_and_limits(owner, account, client_as):
    st = owner.get(api("/integrations/instagram/publishing")).json()
    assert st["enabled"] and st["canPublish"] and st["uploadsAvailable"]  # UNIFIED uses an https redirect URI
    assert st["accounts"] == [{**st["accounts"][0], "id": account, "username": "eko_live_test", "canPublish": True, "reason": None}]
    assert st["limits"]["carouselMax"] == 10 and st["limits"]["captionMax"] == 2200
    editor = client_as("usr-ananya")
    assert editor.get(api("/integrations/instagram/publishing")).json()["canPublish"] is False
    quota = owner.get(api(f"/integrations/instagram/accounts/{account}/publishing-limit")).json()
    assert quota == {"quotaUsage": 3, "quotaTotal": 50, "quotaDuration": 86400}


def test_accounts_without_the_publish_permission_cannot_publish(client_as, meta):
    meta.scopes = ["instagram_basic", "instagram_manage_insights"]
    owner = client_as()
    account = callback(owner, code="good-code", state=start_unified(owner))["account"]
    st = owner.get(api("/integrations/instagram/publishing")).json()
    assert st["accounts"][0]["canPublish"] is False and "instagram_content_publish" in st["accounts"][0]["reason"]
    r = post(owner, accountId=account, kind="image", items=[{"type": "image", "url": "https://cdn.example.com/a.jpg"}])
    assert r.status_code == 409 and r.json()["error"]["code"] == "publishing_unavailable"


# ------------------------------------------------------------------------------------------ flows
def test_photo_post_is_published_in_the_background(owner, account, meta, connection):
    r = post(owner, accountId=account, kind="image", caption="Become an Eko CSP #banking", altText="A kiosk",
             items=[{"type": "image", "url": "https://cdn.example.com/kiosk.jpg"}])
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["status"] == "queued" and p["canCancel"] and owner.app.state.dispatched == [(p["id"], 0.0)]

    assert step(owner.app, p["id"]) == "publishing"  # container created, check scheduled
    assert meta.created == [{"id": "c1", "image_url": "https://cdn.example.com/kiosk.jpg", "caption": "Become an Eko CSP #banking",
                             "alt_text": "A kiosk"}]
    assert owner.app.state.dispatched[-1][0] == p["id"]
    assert step(owner.app, p["id"]) == "not_due"  # the re-dispatch waits for its time
    done = run_until_done(owner, connection, p["id"])
    assert done["status"] == "published" and done["igMediaId"] == "17900000000000001"
    assert done["permalink"] == "https://www.instagram.com/p/TEST123/" and done["publishedAt"] and not done["canCancel"]
    assert meta.published == ["c1"]
    assert step(owner.app, p["id"]) == "skipped"  # never published twice
    with Session(bind=connection) as s:
        assert s.scalar(select(ActivityEvent).where(ActivityEvent.title == "Instagram Post Published")) is not None
    assert all("graph.facebook.com" == c.url.host for c in meta.calls)


def test_carousel_and_reel_containers(owner, account, meta, connection):
    c = post(owner, accountId=account, kind="carousel", caption="Steps",
             items=[{"type": "image", "url": "https://cdn.example.com/1.jpg"}, {"type": "video", "url": "https://cdn.example.com/2.mp4"}]).json()
    assert run_until_done(owner, connection, c["id"])["status"] == "published"
    assert [{k: v for k, v in x.items() if k != "id"} for x in meta.created] == [
        {"image_url": "https://cdn.example.com/1.jpg", "is_carousel_item": "true"},
        {"video_url": "https://cdn.example.com/2.mp4", "is_carousel_item": "true", "media_type": "VIDEO"},
        {"media_type": "CAROUSEL", "children": "c1,c2", "caption": "Steps"},
    ]
    assert meta.published == ["c3"]

    meta.default_status = "IN_PROGRESS"
    reel = post(owner, accountId=account, kind="reel", caption="Reel", shareToFeed=False,
                items=[{"type": "video", "url": "https://cdn.example.com/r.mp4"}]).json()
    step(owner.app, reel["id"])
    assert meta.created[-1] == {"id": "c4", "video_url": "https://cdn.example.com/r.mp4", "media_type": "REELS", "share_to_feed": "false",
                                "caption": "Reel"}
    assert owner.app.state.dispatched[-1] == (reel["id"], publishing.FIRST_CHECK_VIDEO)
    make_due(connection, reel["id"])
    assert step(owner.app, reel["id"]) == "publishing"  # still processing on Meta
    meta.status["c4"] = "FINISHED"
    assert run_until_done(owner, connection, reel["id"])["status"] == "published"


def test_story_and_validation_errors(owner, account):
    bad = [
        (dict(kind="carousel", items=[{"type": "image", "url": "https://cdn.example.com/1.jpg"}]), "2 to 10"),
        (dict(kind="story", caption="hi", items=[{"type": "image", "url": "https://cdn.example.com/1.jpg"}]), "Stories cannot have a caption"),
        (dict(kind="image", items=[{"type": "image", "url": "http://cdn.example.com/1.jpg"}]), "https://"),
        (dict(kind="image", items=[{"type": "image", "url": "https://localhost/1.jpg"}]), "this computer"),
        (dict(kind="reel", items=[{"type": "image", "url": "https://cdn.example.com/1.jpg"}]), "exactly one video"),
        (dict(kind="image", caption=" ".join(f"#t{i}" for i in range(31)), items=[{"type": "image", "url": "https://cdn.example.com/1.jpg"}]), "30 hashtags"),
        (dict(kind="image", scheduledAt=(utcnow() + timedelta(days=80)).isoformat(), items=[{"type": "image", "url": "https://cdn.example.com/1.jpg"}]), "75 days"),
    ]
    for body, needle in bad:
        r = post(owner, accountId=account, **body)
        assert r.status_code == 422 and needle in r.json()["error"]["message"], (body, r.text)
    story = post(owner, accountId=account, kind="story", items=[{"type": "video", "url": "https://cdn.example.com/s.mp4"}])
    assert story.status_code == 201


def test_only_publishers_can_publish(client_as, account):
    editor = client_as("usr-ananya")
    r = post(editor, accountId=account, kind="image", items=[{"type": "image", "url": "https://cdn.example.com/1.jpg"}])
    assert r.status_code == 403
    assert editor.get(api("/integrations/instagram/publications")).status_code == 200


def test_scheduled_posts_start_on_time_and_can_be_cancelled(owner, account, connection, meta):
    later = (utcnow() + timedelta(hours=2)).isoformat()
    p = post(owner, accountId=account, kind="image", scheduledAt=later, items=[{"type": "image", "url": "https://cdn.example.com/1.jpg"}]).json()
    assert p["status"] == "scheduled" and owner.app.state.dispatched == []
    assert step(owner.app, p["id"]) == "skipped" and meta.created == []  # not before its time
    dispatched: list = []
    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:
        assert publishing.dispatch_due(s, lambda pid, _c: dispatched.append(pid)) == 0
        s.execute(update(InstagramPublication).where(InstagramPublication.id == p["id"]).values(scheduled_at=utcnow() - timedelta(seconds=1)))
        s.commit()
        assert publishing.dispatch_due(s, lambda pid, _c: dispatched.append(pid)) == 1
    assert dispatched == [p["id"]]

    other = post(owner, accountId=account, kind="image", scheduledAt=later, items=[{"type": "image", "url": "https://cdn.example.com/2.jpg"}]).json()
    cancelled = owner.post(api(f"/integrations/instagram/publications/{other['id']}/cancel"))
    assert cancelled.status_code == 200 and cancelled.json()["status"] == "cancelled"
    assert owner.post(api(f"/integrations/instagram/publications/{other['id']}/cancel")).status_code == 409


def test_container_errors_and_already_published_containers(owner, account, meta, connection):
    meta.default_status = "ERROR"
    p = post(owner, accountId=account, kind="image", items=[{"type": "image", "url": "https://cdn.example.com/bad.jpg"}]).json()
    failed = run_until_done(owner, connection, p["id"])
    assert failed["status"] == "failed" and failed["errorCode"] == "container_error" and "JPEG" in failed["errorMessage"]
    assert meta.published == []

    meta.default_status = "PUBLISHED"  # e.g. a crash after media_publish but before the result was saved
    again = post(owner, accountId=account, kind="image", items=[{"type": "image", "url": "https://cdn.example.com/ok.jpg"}]).json()
    assert run_until_done(owner, connection, again["id"])["status"] == "published" and meta.published == []


def test_rate_limits_are_retried_then_give_up(owner, account, meta, connection):
    p = post(owner, accountId=account, kind="image", items=[{"type": "image", "url": "https://cdn.example.com/1.jpg"}]).json()
    meta.fail[f"/{IG_ID}/media"] = [httpx.Response(400, json={"error": {"message": "limit", "code": 4}})] * publishing.MAX_ATTEMPTS
    for _ in range(publishing.MAX_ATTEMPTS):
        make_due(connection, p["id"])
        step(owner.app, p["id"])
    out = owner.get(api(f"/integrations/instagram/publications/{p['id']}")).json()
    assert out["status"] == "failed" and out["errorCode"] == "rate_limited"


def test_uploaded_pictures_are_served_to_meta_only_while_pending(owner, account, meta, connection):
    assert owner.put(api("/integrations/instagram/publish-assets"), content=PNG, headers={"content-type": "image/png"}).status_code == 422
    up = owner.put(api("/integrations/instagram/publish-assets"), content=JPEG, headers={"content-type": "image/jpeg"})
    assert up.status_code == 201, up.text
    asset = up.json()
    assert asset["width"] == 1080 and asset["height"] == 1080 and owner.get(api(asset["previewUrl"].removeprefix("/api/v1"))).content == JPEG
    with Session(bind=connection) as s:
        token = s.scalar(select(publishing.InstagramPublishAsset.public_token).where(publishing.InstagramPublishAsset.id == asset["id"]))
    anon = TestClient(owner.app)
    public_path = api(f"/integrations/instagram/media/{token}.jpg")
    assert anon.get(public_path).status_code == 404  # not used by any pending post yet
    p = post(owner, accountId=account, kind="image", items=[{"type": "image", "assetId": asset["id"]}]).json()
    assert p["items"][0]["previewUrl"].endswith(asset["id"])
    served = anon.get(public_path)
    assert served.status_code == 200 and served.content == JPEG and served.headers["content-type"] == "image/jpeg"
    step(owner.app, p["id"])
    assert meta.created[0]["image_url"] == f"https://api.example.test/api/v1/integrations/instagram/media/{token}.jpg"
    assert run_until_done(owner, connection, p["id"])["status"] == "published"
    assert anon.get(public_path).status_code == 404  # published: no longer served


def test_uploads_need_a_public_https_api(client_as, connection, meta):
    owner = client_as(instagram_config_id=None, instagram_redirect_uri="http://localhost:8100/api/v1/integrations/instagram/callback")
    assert owner.get(api("/integrations/instagram/publishing")).json()["uploadsAvailable"] is False


def test_publications_are_workspace_scoped_and_logs_have_no_token(owner, account, caplog):
    p = post(owner, accountId=account, kind="image", items=[{"type": "image", "url": "https://cdn.example.com/1.jpg"}]).json()
    step(owner.app, p["id"])
    assert SUAT not in caplog.text
    assert owner.get(api("/integrations/instagram/publications/igp_0000000000000000")).status_code == 404


# ------------------------------------------------------------------------------- Ad Studio via Instagram
def test_ad_studio_can_publish_with_an_instagram_account(owner, account, ads_meta, connection):
    caps = owner.get(api("/ads/studio/options")).json()["capabilities"]
    assert caps["livePublish"] is True and caps["instagramPublishAccounts"] == [{"id": account, "username": "eko_live_test"}]

    original = ads_meta.handle

    def handle(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/me/adaccounts"):
            ads_meta.requests.append((request.method, "me/adaccounts", None, request))
            return httpx.Response(200, json={"data": [{"account_id": "777", "name": "Eko Ads", "account_status": 1}]})
        return original(request)

    ads_meta.transport = httpx.MockTransport(handle)
    owner.app.state.ads_studio_meta_transport = ads_meta.transport
    d = make_draft(owner)
    assert owner.put(api(f"/ads/studio/drafts/{d['id']}/image"), content=PNG, headers={"content-type": "image/png"}).json()["canPublish"]
    r = owner.post(api(f"/ads/studio/drafts/{d['id']}/publish"), json={"instagramAccountId": account})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["mode"] == "live" and out["status"] == "built" and out["publishedWith"] == "@eko_live_test"
    paths = [x[1] for x in ads_meta.requests]
    assert paths[0] == "me/adaccounts" and "act_777/campaigns" in paths and "act_777/ads" in paths
    bodies = {x[1]: x[2] for x in ads_meta.requests}
    spec = bodies["act_777/adcreatives"]["object_story_spec"]
    assert spec["instagram_user_id"] == IG_ID and "page_id" not in spec  # no META_ADS_PAGE_ID configured
    assert bodies["act_777/adsets"]["targeting"]["publisher_platforms"] == ["instagram"]
    auth = {x[3].headers["authorization"] for x in ads_meta.requests}
    assert auth == {f"Bearer {SUAT}"}  # the Instagram account's token, not a server token
    with Session(bind=connection) as s:
        row = s.get(AdsStudioDraft, d["id"])
        assert row.result["publish_via"] == {"instagram_account_id": account, "username": "eko_live_test", "ad_account_id": "act_777"}

    ads_meta.requests.clear()
    act = owner.post(api(f"/ads/studio/drafts/{d['id']}/activate"), json={"confirmDailyBudget": 400})
    assert act.status_code == 200 and act.json()["status"] == "active"
    assert "me/adaccounts" not in [x[1] for x in ads_meta.requests]  # the stored ad account is reused


def test_ad_studio_rejects_accounts_without_ads_management(client_as, meta):
    meta.scopes = ["instagram_basic", "instagram_content_publish"]
    owner = client_as()
    account = callback(owner, code="good-code", state=start_unified(owner))["account"]
    assert owner.get(api("/ads/studio/options")).json()["capabilities"]["instagramPublishAccounts"] == []
    d = make_draft(owner)
    owner.put(api(f"/ads/studio/drafts/{d['id']}/image"), content=PNG, headers={"content-type": "image/png"})
    r = owner.post(api(f"/ads/studio/drafts/{d['id']}/publish"), json={"instagramAccountId": account})
    assert r.status_code == 409 and "ads_management" in r.json()["error"]["message"]
    assert json.dumps(r.json()).count(SUAT) == 0
