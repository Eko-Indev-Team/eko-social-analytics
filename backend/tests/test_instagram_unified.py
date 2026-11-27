"""Instagram API with Unified login (Meta apps created since late 2026), against a *mocked* Meta.

No real Meta credentials, network access or Instagram account are used: every provider response below is
fabricated test data shaped like the documented responses (developers.facebook.com/documentation/instagram-platform/
instagram-api-with-unified-login). The fixtures and helpers come from ``test_instagram``; ``meta`` is overridden
here with a Facebook-host fake, and every app is built with ``INSTAGRAM_CONFIG_ID`` set.
"""

from __future__ import annotations

from datetime import timedelta
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from pydantic import ValidationError
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import InstagramConnection, InstagramToken
from app.services.common import utcnow
from app.services.instagram.crypto import TokenCipher

from .conftest import UNREACHABLE_DB, api
from .test_instagram import (  # noqa: F401 — imported fixtures
    APP_SECRET, FERNET_KEY, IG_ID, LONG, FakeMeta, callback, ig_app, ig_client_as, ig_settings, owner, sync,
)

pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")

CONFIG_ID = "987654321012345"
SUAT = LONG  # the base fake accepts this token on Graph reads
SECOND_IG_ID = "17841400000000002"
UNIFIED_SCOPES = ["instagram_basic", "instagram_manage_insights", "instagram_manage_comments", "instagram_manage_messages"]


class FakeUnifiedMeta(FakeMeta):
    """Facebook-host token, debug_token and assigned-accounts endpoints; Graph reads reuse the base fake."""

    def __init__(self) -> None:
        super().__init__()
        self.scopes = list(UNIFIED_SCOPES)
        self.expires_at = 0  # Meta reports 0 for a token that does not expire
        self.token_app_id = "1234567890"
        self.accounts = [{"id": IG_ID, "username": "eko_live_test"}]
        # The Facebook-host IG User node has no user_id / account_type.
        self.profiles = {
            IG_ID: {"id": IG_ID, "username": "eko_live_test", "name": "Eko Live (test)", "followers_count": 1200,
                    "follows_count": 10, "media_count": 3},
            SECOND_IG_ID: {"id": SECOND_IG_ID, "username": "eko_second_test", "followers_count": 50},
        }

    def handle(self, request: httpx.Request) -> httpx.Response:
        host, path, params = request.url.host, request.url.path, dict(request.url.params)
        assert host == "graph.facebook.com", f"unexpected host {host}"  # never graph.instagram.com / api.instagram.com
        if path == "/v26.0/oauth/access_token":
            self.calls.append(request)
            assert params["client_id"] == "1234567890" and params["client_secret"] == APP_SECRET
            assert params["redirect_uri"] == "https://api.example.test/api/v1/integrations/instagram/callback"
            if params["code"] != "good-code":
                return httpx.Response(400, json={"error": {"message": "Invalid verification code", "type": "OAuthException", "code": 100}})
            return httpx.Response(200, json={"access_token": SUAT, "token_type": "bearer"})
        if path == "/v26.0/debug_token":
            self.calls.append(request)
            assert params["access_token"] == f"1234567890|{APP_SECRET}" and params["input_token"] == SUAT
            return httpx.Response(200, json={"data": {"app_id": self.token_app_id, "type": "SYSTEM_USER", "is_valid": True,
                                                      "expires_at": self.expires_at, "scopes": self.scopes}})
        if path == "/v26.0/me/assigned_instagram_accounts":
            self.calls.append(request)
            assert params["access_token"] == SUAT
            return httpx.Response(200, json={"data": self.accounts, "paging": {"cursors": {"before": "a", "after": "b"}}})
        if path in (f"/v26.0/{IG_ID}", f"/v26.0/{SECOND_IG_ID}"):
            self.calls.append(request)
            assert "user_id" not in params["fields"] and "account_type" not in params["fields"]
            return httpx.Response(200, json=self.profiles[path.rsplit("/", 1)[1]])
        assert path != "/v26.0/me", "/me is the system user with Unified login, never the Instagram account"
        return super().handle(request)


@pytest.fixture
def meta() -> FakeUnifiedMeta:
    return FakeUnifiedMeta()


UNIFIED = {"instagram_config_id": CONFIG_ID,
           "instagram_redirect_uri": "https://api.example.test/api/v1/integrations/instagram/callback"}


@pytest.fixture
def unified_owner(ig_client_as):
    return ig_client_as("usr-mansi", **UNIFIED)


def start_unified(client) -> str:
    response = client.post(api("/integrations/instagram/connect"))
    assert response.status_code == 200, response.text
    url = urlparse(response.json()["authorizationUrl"])
    assert (url.scheme, url.netloc, url.path) == ("https", "www.facebook.com", "/dialog/oauth")
    query = parse_qs(url.query)
    assert query["client_id"] == ["1234567890"] and query["config_id"] == [CONFIG_ID] and query["response_type"] == ["code"]
    assert query["redirect_uri"] == [UNIFIED["instagram_redirect_uri"]]
    assert "scope" not in query  # permissions come from the dashboard configuration
    return query["state"][0]


def test_configuration_selects_unified_login():
    settings = ig_settings(UNREACHABLE_DB, **UNIFIED)
    assert settings.instagram_enabled and settings.instagram_login_flow == "unified"
    assert settings.instagram_requested_scopes == ["instagram_basic", "instagram_manage_insights", "instagram_manage_comments"]
    assert ig_settings(UNREACHABLE_DB).instagram_login_flow == "instagram"
    assert ig_settings(UNREACHABLE_DB, instagram_config_id="  ").instagram_login_flow == "instagram"  # blank = unset
    with pytest.raises(ValidationError, match="INSTAGRAM_CONFIG_ID"):
        ig_settings(UNREACHABLE_DB, instagram_config_id="my-config")


def test_status_reports_the_unified_permissions(unified_owner):
    status = unified_owner.get(api("/integrations/instagram/status")).json()
    assert status["enabled"] and status["requestedScopes"] == ["instagram_basic", "instagram_manage_insights", "instagram_manage_comments"]


def test_unified_connect_flow_stores_an_encrypted_non_expiring_token(unified_owner, connection, meta):
    result = callback(unified_owner, code="good-code#_", state=start_unified(unified_owner))
    assert result["instagram"] == "connected", result
    with Session(bind=connection) as s:
        conn = s.get(InstagramConnection, result["account"])
        token = s.get(InstagramToken, conn.id)
        assert conn.ig_user_id == IG_ID and conn.username == "eko_live_test" and conn.followers_count == 1200
        assert conn.account_type is None and conn.app_scoped_user_id is None
        assert conn.granted_scopes == sorted(UNIFIED_SCOPES)
        assert conn.token_expires_at is None and token.expires_at is None  # expires_at 0 = does not expire
        assert SUAT not in token.ciphertext and TokenCipher(FERNET_KEY, 1).decrypt(token.ciphertext, token.key_version) == SUAT
    account = unified_owner.get(api(f"/integrations/instagram/accounts/{result['account']}")).json()
    assert account["insightsAvailable"] and account["commentsAvailable"]
    body = unified_owner.get(api("/integrations/instagram/accounts")).text
    assert SUAT not in body and APP_SECRET not in body


def test_every_selected_account_becomes_a_connection(unified_owner, connection, meta):
    meta.accounts = [{"id": IG_ID, "username": "eko_live_test"}, {"id": SECOND_IG_ID, "username": "eko_second_test"}]
    meta.expires_at = int((utcnow() + timedelta(days=60)).timestamp())
    assert callback(unified_owner, code="good-code", state=start_unified(unified_owner))["instagram"] == "connected"
    with Session(bind=connection) as s:
        rows = {c.ig_user_id: c for c in s.scalars(select(InstagramConnection))}
        assert set(rows) == {IG_ID, SECOND_IG_ID} and rows[SECOND_IG_ID].username == "eko_second_test"
        assert all(c.token_expires_at and c.token_expires_at > utcnow() + timedelta(days=59) for c in rows.values())
        assert s.scalar(select(func.count()).select_from(InstagramToken)) == 2


def test_unified_callback_failures(unified_owner, connection, meta):
    assert callback(unified_owner, code="bad-code", state=start_unified(unified_owner)) == {"instagram": "error", "reason": "exchange_failed"}
    meta.accounts = []
    assert callback(unified_owner, code="good-code", state=start_unified(unified_owner)) == {"instagram": "error", "reason": "no_instagram_account"}
    meta.accounts = [{"id": IG_ID, "username": "eko_live_test"}]
    meta.scopes = ["instagram_manage_messages"]
    assert callback(unified_owner, code="good-code", state=start_unified(unified_owner)) == {"instagram": "error", "reason": "permission_missing"}
    meta.scopes = list(UNIFIED_SCOPES)
    meta.token_app_id = "5555555555"  # token issued to a different app
    assert callback(unified_owner, code="good-code", state=start_unified(unified_owner)) == {"instagram": "error", "reason": "exchange_failed"}
    with Session(bind=connection) as s:
        assert s.scalar(select(func.count()).select_from(InstagramConnection)) == 0


def test_unified_sync_reads_from_graph_facebook_and_never_refreshes(unified_owner, connection, meta):
    account = callback(unified_owner, code="good-code", state=start_unified(unified_owner))["account"]
    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:  # near expiry and old: legacy would refresh
        s.execute(update(InstagramToken).values(issued_at=utcnow() - timedelta(days=50), expires_at=utcnow() + timedelta(days=5)))
        s.commit()
    run = sync(unified_owner, account)
    assert run["status"] in ("succeeded", "partially_succeeded"), run
    assert run["mediaFetched"] == 3 and run["commentsFetched"] == 3
    assert meta.count("/refresh_access_token") == 0
    assert meta.count(f"/{IG_ID}/insights") >= 1 and meta.count(f"/{IG_ID}/media") >= 1
    assert not any(w["code"] == "insights_not_granted" for w in run["warnings"])
