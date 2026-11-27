"""Eko signup admin client (``app.services.ads.signups``) against ``httpx.MockTransport``. No network, synthetic data."""

from __future__ import annotations

import json
import logging

import httpx
import pytest
from pydantic import SecretStr

from app.services.ads import signups as su

BASE = "https://signup-admin.test"
PASSWORD = "pw-not-real-123"
TOKEN = "tok-not-real-456"


class FakeSettings:
    def __init__(self, **kw):
        self.eko_signup_admin_base_url = kw.get("base", BASE + "/")
        self.eko_signup_admin_user = kw.get("user", "admin-user")
        self.eko_signup_admin_password = kw.get("password", SecretStr(PASSWORD))
        self.eko_signup_admin_verify_tls = kw.get("verify", True)
        self.meta_ads_http_timeout_seconds = 5.0


APPS = [
    {"id": 11, "first_name": "Test", "last_name": "Alpha", "mobile": "9000000011", "submitted_at": "2026-09-01T10:00:00",
     "qualification_verdict": "STRONG_QUALIFY", "shop_address": "Shop 1", "utm_source": "fb", "utm_medium": "paid", "utm_campaign": "c-1",
     "fbclid": "x"},
    {"id": 12, "first_name": "Test", "last_name": "Beta", "mobile": "9000000012", "created_at": "2026-09-03T10:00:00",
     "qualification_verdict": "NOT_QUALIFY", "shop_address": "Shop 2", "fbclid": "y"},
    {"id": 13, "first_name": "Test", "last_name": "Gamma", "mobile": "9000000013", "submitted_at": "2026-09-02T10:00:00",
     "utm_source": "google", "utm_campaign": "spring"},
]


def handler_ok(seen: list):
    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.url.path == "/api/admin/login":
            assert request.method == "POST"
            assert json.loads(request.content) == {"username": "admin-user", "password": PASSWORD}
            return httpx.Response(200, json={"status": 0, "data": {"token": TOKEN}})
        if request.url.path == "/api/applications":
            assert request.headers["authorization"] == f"Bearer {TOKEN}"
            return httpx.Response(200, json={"status": 0, "data": APPS})
        return httpx.Response(404)
    return handle


def test_not_configured_returns_empty_without_network():
    def boom(request):  # pragma: no cover - must not be called
        raise AssertionError("no request expected")
    for settings in (FakeSettings(base=None), FakeSettings(user=""), FakeSettings(password=None), FakeSettings(password=SecretStr(""))):
        assert su.fetch_all_signups(settings, {}, transport=httpx.MockTransport(boom)) == []
        assert su.signups_configured(settings) is False
    assert su.signups_configured(FakeSettings()) is True


def test_fetch_classifies_and_sorts_newest_first():
    seen: list = []
    out = su.fetch_all_signups(FakeSettings(), {"c-1": "Campaign One"}, transport=httpx.MockTransport(handler_ok(seen)))
    assert [r.url.path for r in seen] == ["/api/admin/login", "/api/applications"]
    assert [s["id"] for s in out] == ["12", "13", "11"]  # submitted_at (or created_at) desc
    by_id = {s["id"]: s for s in out}
    assert by_id["11"]["attribution_tier"] == "campaign_matched" and by_id["11"]["matched_campaign_id"] == "c-1"
    assert by_id["11"]["matched_campaign_name"] == "Campaign One" and by_id["11"]["name"] == "Test Alpha"
    assert by_id["12"]["attribution_tier"] == "fbclid_only" and by_id["12"]["matched_campaign_id"] is None
    assert by_id["12"]["submitted_at"] == "2026-09-03T10:00:00" and by_id["12"]["utm_campaign"] == ""
    assert by_id["13"]["attribution_tier"] == "none"  # utm_campaign without a Facebook signal is not matched
    assert set(by_id["11"]) == {"id", "mobile", "name", "submitted_at", "qualification_verdict", "shop_address", "attribution_tier",
                                "matched_campaign_id", "matched_campaign_name", "utm_source", "utm_medium", "utm_campaign"}


@pytest.mark.parametrize("app,expected", [
    ({"utm_campaign": "123", "fbclid": "a"}, ("campaign_matched", "123")),
    ({"utm_campaign": " 123 ", "utm_source": "FB"}, ("campaign_matched", "123")),
    ({"utm_campaign": "123"}, ("none", None)),
    ({"fbclid": "a"}, ("fbclid_only", None)),
    ({"utm_source": "fb"}, ("fbclid_only", None)),
    ({}, ("none", None)),
])
def test_classify_attribution(app, expected):
    assert su.classify_attribution(app) == expected


def _raises(handler, settings=None) -> su.SignupAdminError:
    with pytest.raises(su.SignupAdminError) as info:
        su.fetch_all_signups(settings or FakeSettings(), {}, transport=httpx.MockTransport(handler))
    err = info.value
    for secret in (PASSWORD, TOKEN, "Test Alpha", "9000000011"):
        assert secret not in err.message
    return err


def test_errors_are_safe_and_coded():
    assert _raises(lambda r: httpx.Response(401, json={"message": "nope"})).code == "SIGNUP_ADMIN_AUTH"
    assert _raises(lambda r: httpx.Response(200, json={"status": 1, "message": f"bad password {PASSWORD}"})).code == "SIGNUP_ADMIN_AUTH"
    assert _raises(lambda r: httpx.Response(500, text="boom")).code == "SIGNUP_ADMIN_HTTP"
    assert _raises(lambda r: httpx.Response(200, text="<html>")).code == "SIGNUP_ADMIN_BAD_RESPONSE"

    def connect_error(request):
        raise httpx.ConnectError(f"failed {request.url}", request=request)
    err = _raises(connect_error)
    assert err.code == "SIGNUP_ADMIN_UNREACHABLE" and BASE not in err.message

    def timeout(request):
        raise httpx.ReadTimeout("slow", request=request)
    assert _raises(timeout).code == "SIGNUP_ADMIN_TIMEOUT"

    def no_list(request):
        if request.url.path == "/api/admin/login":
            return httpx.Response(200, json={"status": 0, "data": {"token": TOKEN}})
        return httpx.Response(200, json={"status": 0, "data": {"oops": True}})
    assert _raises(no_list).code == "SIGNUP_ADMIN_BAD_RESPONSE"

    def apps_forbidden(request):
        if request.url.path == "/api/admin/login":
            return httpx.Response(200, json={"status": 0, "data": {"token": TOKEN}})
        return httpx.Response(403)
    assert _raises(apps_forbidden).code == "SIGNUP_ADMIN_AUTH"


@pytest.mark.parametrize("verify", [True, False])
def test_tls_verification_follows_setting(monkeypatch, verify):
    captured = {}
    real_client = httpx.Client

    def spy(*args, **kwargs):
        captured.update(kwargs)
        return real_client(*args, **kwargs)

    monkeypatch.setattr(su.httpx, "Client", spy)
    su.fetch_all_signups(FakeSettings(verify=verify), {}, transport=httpx.MockTransport(handler_ok([])))
    assert captured["verify"] is verify and captured["base_url"] == BASE and captured["timeout"] == 5.0


def test_never_logs_pii_or_credentials(caplog):
    caplog.set_level(logging.DEBUG)
    su.fetch_all_signups(FakeSettings(), {}, transport=httpx.MockTransport(handler_ok([])))
    text = caplog.text
    for secret in (PASSWORD, TOKEN, "Alpha", "9000000011", "Shop 1"):
        assert secret not in text


def test_real_settings_object_is_supported():
    from .conftest import UNREACHABLE_DB, make_settings

    st = make_settings(UNREACHABLE_DB, eko_signup_admin_base_url=BASE, eko_signup_admin_user="admin-user", eko_signup_admin_password=PASSWORD)
    assert su.signups_configured(st) is True and st.ads_signups_configured is True
    assert len(su.fetch_all_signups(st, {}, transport=httpx.MockTransport(handler_ok([])))) == 3
    assert su.signups_configured(make_settings(UNREACHABLE_DB)) is False
