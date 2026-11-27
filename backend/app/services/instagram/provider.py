"""HTTP client for the Instagram platform, in either of Meta's two login setups.

**Unified login** (``INSTAGRAM_CONFIG_ID`` set — the only setup Meta offers to apps created since late 2026;
developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login, checked Nov 2026):

* ``https://www.facebook.com/dialog/oauth``  — Facebook Login for Business dialog: ``client_id`` (Meta app ID),
  ``config_id``, ``redirect_uri``, ``response_type=code``, ``state``; no ``scope`` (permissions live in the config)
* ``https://graph.facebook.com/<version>/oauth/access_token`` — code → Business Integration System User token
  (no short/long-lived exchange; its expiry is fixed by the configuration)
* ``https://graph.facebook.com/<version>/debug_token``  — granted scopes and expiry of that token
* ``https://graph.facebook.com/<version>/me/assigned_instagram_accounts`` — the Instagram accounts the client picked
  (``/me`` is the system user, never the Instagram account)
* ``https://graph.facebook.com/<version>/<IG_ID>`` and ``/<IG_ID>/media``, ``/<MEDIA_ID>/insights``,
  ``/<IG_ID>/insights``, ``/<MEDIA_ID>/comments``

**Instagram login** (legacy; older apps only), verified Oct 2026:

* ``https://www.instagram.com/oauth/authorize``     — authorization window (code, valid 1 h, single use)
* ``https://api.instagram.com/oauth/access_token``  — code → short-lived token (POST, form body)
* ``https://graph.instagram.com/access_token``      — short-lived → long-lived (60 days), ``ig_exchange_token``
* ``https://graph.instagram.com/refresh_access_token`` — refresh a ≥24 h old, unexpired long-lived token
* ``https://graph.instagram.com/<version>/...``     — /me, /<IG_ID>/media, /<MEDIA_ID>/insights, /<IG_ID>/insights,
  /<MEDIA_ID>/comments

Every call has an explicit timeout; transient failures (network errors, timeouts, HTTP 5xx, Graph errors
flagged ``is_transient`` or codes 1/2) are retried a bounded number of times. Errors are mapped to
:class:`ProviderError` with a safe, generic message — access tokens, the app secret and raw provider payloads
never reach logs, exceptions shown to users or API responses.
"""

from __future__ import annotations

import json
import logging
import random
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlencode

import httpx

from app.core.config import Settings

AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize"
TOKEN_URL = "https://api.instagram.com/oauth/access_token"
GRAPH_HOST = "https://graph.instagram.com"
FB_DIALOG_URL = "https://www.facebook.com/dialog/oauth"
FB_GRAPH_HOST = "https://graph.facebook.com"

# Profile fields per setup: graph.instagram.com /me knows user_id / account_type; the Facebook-host IG User node does not.
INSTAGRAM_LOGIN_PROFILE_FIELDS = ["id", "user_id", "username", "name", "account_type", "profile_picture_url", "followers_count",
                                  "follows_count", "media_count"]
UNIFIED_PROFILE_FIELDS = ["id", "username", "name", "profile_picture_url", "followers_count", "follows_count", "media_count"]
MAX_ASSIGNED_ACCOUNTS = 50

logger = logging.getLogger("socialboard.instagram")
# httpx logs full request URLs (which carry access_token / client_secret query parameters) at INFO.
for _noisy in ("httpx", "httpcore"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

RATE_LIMIT_CODES = {4, 17, 32, 613}
TRANSIENT_CODES = {1, 2}
PERMISSION_CODES = {10, *range(200, 300)}


class ProviderError(Exception):
    """A failed Instagram API call, classified. ``str()`` never contains tokens or provider payloads."""

    MESSAGES = {
        "token_invalid": "Instagram rejected the access token (expired, revoked or password changed). Reconnect the account.",
        "permission_denied": "Instagram did not allow this request; a required permission may not be granted.",
        "rate_limited": "Instagram's rate limit was reached. Try again later.",
        "invalid_request": "Instagram rejected the request.",
        "not_found": "The Instagram object no longer exists or is not accessible.",
        "unavailable": "Instagram is temporarily unavailable or did not respond in time.",
        "bad_response": "Instagram returned an unexpected response.",
    }

    def __init__(self, kind: str, *, provider_code: int | None = None, subcode: int | None = None,
                 http_status: int | None = None, retry_after: int | None = None) -> None:
        super().__init__(self.MESSAGES[kind])
        self.kind = kind
        self.provider_code = provider_code
        self.subcode = subcode
        self.http_status = http_status
        self.retry_after = retry_after

    @property
    def safe_message(self) -> str:
        return self.MESSAGES[self.kind]


@dataclass
class ShortLivedToken:
    access_token: str = field(repr=False)
    user_id: str | None
    permissions: list[str]


@dataclass
class TokenInfo:
    """``debug_token`` result for a Unified-login token."""
    scopes: list[str]
    expires_at: int | None  # unix seconds; None = does not expire (Meta reports 0)
    is_valid: bool


@dataclass
class LongLivedToken:
    access_token: str = field(repr=False)
    expires_in: int | None


def _classify(response: httpx.Response) -> ProviderError:
    try:
        body = response.json()
    except ValueError:
        body = {}
    err = body.get("error") if isinstance(body, dict) else None
    if isinstance(err, dict):  # Graph API envelope
        code, subcode, transient = err.get("code"), err.get("error_subcode"), err.get("is_transient")
    elif isinstance(body, dict) and "error_type" in body:  # api.instagram.com OAuth envelope
        code, subcode, transient = body.get("code"), None, False
    else:
        code, subcode, transient = None, None, False
    code = code if isinstance(code, int) else None
    retry = _retry_after_seconds(response)
    common = {"provider_code": code, "subcode": subcode, "http_status": response.status_code}
    if code == 190:
        return ProviderError("token_invalid", **common)
    if code in RATE_LIMIT_CODES or response.status_code == 429:
        return ProviderError("rate_limited", retry_after=retry, **common)
    if transient or code in TRANSIENT_CODES or response.status_code >= 500:
        return ProviderError("unavailable", **common)
    if code in PERMISSION_CODES:
        return ProviderError("permission_denied", **common)
    if code == 100 and subcode == 33:
        return ProviderError("not_found", **common)
    if response.status_code == 404:
        return ProviderError("not_found", **common)
    return ProviderError("invalid_request", **common)


def _retry_after_seconds(response: httpx.Response) -> int | None:
    """Wait hint from ``Retry-After`` or Meta's usage headers (``estimated_time_to_regain_access`` is in minutes)."""
    header = response.headers.get("retry-after")
    if header and header.isdigit():
        return int(header)
    for name in ("x-business-use-case-usage", "x-app-usage"):
        raw = response.headers.get(name)
        if not raw:
            continue
        try:
            usage = json.loads(raw)
        except ValueError:
            continue
        entries = [e for v in usage.values() if isinstance(v, list) for e in v] if isinstance(usage, dict) else []
        if isinstance(usage, dict) and "estimated_time_to_regain_access" in usage:
            entries.append(usage)
        minutes = [e.get("estimated_time_to_regain_access") for e in entries if isinstance(e, dict)]
        minutes = [m for m in minutes if isinstance(m, int | float) and m > 0]
        if minutes:
            return int(max(minutes) * 60)
    return None


class InstagramClient:
    def __init__(self, settings: Settings, *, transport: httpx.BaseTransport | None = None,
                 sleep: Callable[[float], None] = time.sleep) -> None:
        if not settings.instagram_enabled:
            raise RuntimeError("Instagram integration is not configured")
        self._settings = settings
        self._unified = settings.instagram_login_flow == "unified"
        self._host = FB_GRAPH_HOST if self._unified else GRAPH_HOST
        self._version = settings.instagram_graph_api_version
        self._sleep = sleep
        self._http = httpx.Client(transport=transport, timeout=httpx.Timeout(settings.instagram_http_timeout_seconds),
                                  follow_redirects=False, headers={"Accept": "application/json"})

    @property
    def api_version(self) -> str:
        return self._version or ""

    @property
    def unified(self) -> bool:
        return self._unified

    @property
    def supports_refresh(self) -> bool:
        """Only legacy Instagram-login tokens have a refresh endpoint."""
        return not self._unified

    def close(self) -> None:
        self._http.close()

    # ------------------------------------------------------------------ OAuth
    def authorize_url(self, state: str) -> str:
        if self._unified:
            params = {
                "client_id": self._settings.instagram_app_id,
                "config_id": self._settings.instagram_config_id,
                "redirect_uri": self._settings.instagram_redirect_uri,
                "response_type": "code",
                "state": state,
            }
            return f"{FB_DIALOG_URL}?{urlencode(params)}"
        params = {
            "client_id": self._settings.instagram_app_id,
            "redirect_uri": self._settings.instagram_redirect_uri,
            "response_type": "code",
            "scope": ",".join(self._settings.instagram_oauth_scopes),
            "state": state,
        }
        return f"{AUTHORIZE_URL}?{urlencode(params)}"

    def exchange_code(self, code: str) -> ShortLivedToken:
        data = {
            "client_id": self._settings.instagram_app_id,
            "client_secret": self._secret,
            "grant_type": "authorization_code",
            "redirect_uri": self._settings.instagram_redirect_uri,
            "code": code,
        }
        body = self._request("POST", TOKEN_URL, data=data, retry=False)  # codes are single-use: never retry
        if isinstance(body.get("data"), list) and body["data"]:  # documented sample wraps the result in data[]
            body = body["data"][0]
        token = body.get("access_token")
        if not isinstance(token, str) or not token:
            raise ProviderError("bad_response")
        perms = body.get("permissions") or []
        if isinstance(perms, str):
            perms = [p.strip() for p in perms.split(",") if p.strip()]
        user_id = body.get("user_id")
        return ShortLivedToken(access_token=token, user_id=str(user_id) if user_id is not None else None, permissions=list(perms))

    # ------------------------------------------------------------------ Unified login
    def exchange_code_unified(self, code: str) -> str:
        """Code → Business Integration System User access token."""
        params = {
            "client_id": self._settings.instagram_app_id,
            "client_secret": self._secret,
            "redirect_uri": self._settings.instagram_redirect_uri,
            "code": code,
        }
        # codes are single-use: never retry
        body = self._request("GET", f"{FB_GRAPH_HOST}/{self._version}/oauth/access_token", params=params, retry=False)
        token = body.get("access_token")
        if not isinstance(token, str) or not token:
            raise ProviderError("bad_response")
        return token

    def inspect_token(self, token: str) -> TokenInfo:
        """Granted scopes and expiry via ``debug_token`` (authenticated with the app access token)."""
        app_token = f"{self._settings.instagram_app_id}|{self._secret}"
        body = self._request("GET", f"{FB_GRAPH_HOST}/{self._version}/debug_token",
                             params={"input_token": token, "access_token": app_token})
        data = body.get("data")
        if not isinstance(data, dict):
            raise ProviderError("bad_response")
        scopes = data.get("scopes")
        scopes = [str(s) for s in scopes] if isinstance(scopes, list) else []
        expires = data.get("expires_at")
        expires_at = int(expires) if isinstance(expires, int | float) and expires > 0 else None
        valid = bool(data.get("is_valid"))
        if data.get("app_id") is not None and str(data["app_id"]) != str(self._settings.instagram_app_id):
            valid = False  # issued to another app
        return TokenInfo(scopes=scopes, expires_at=expires_at, is_valid=valid)

    def assigned_instagram_accounts(self, token: str) -> list[dict]:
        """Instagram professional accounts the client selected in the Unified-login dialog."""
        accounts: list[dict] = []
        after: str | None = None
        while len(accounts) < MAX_ASSIGNED_ACCOUNTS:
            params = {"fields": "id,username", "limit": "25"}
            if after:
                params["after"] = after
            page, after = self._page(self._graph("GET", "me/assigned_instagram_accounts", token, params))
            accounts.extend(page)
            if after is None:
                break
        return accounts[:MAX_ASSIGNED_ACCOUNTS]

    def exchange_long_lived(self, short_token: str) -> LongLivedToken:
        body = self._request("GET", f"{GRAPH_HOST}/access_token",
                             params={"grant_type": "ig_exchange_token", "client_secret": self._secret, "access_token": short_token})
        return self._long_lived(body)

    def refresh(self, long_token: str) -> LongLivedToken:
        body = self._request("GET", f"{GRAPH_HOST}/refresh_access_token",
                             params={"grant_type": "ig_refresh_token", "access_token": long_token})
        return self._long_lived(body)

    # ------------------------------------------------------------------ Graph reads
    def profile(self, token: str, ig_user_id: str) -> dict[str, Any]:
        """Profile of the connected professional account (``/<IG_ID>`` with Unified login, ``/me`` otherwise)."""
        if self._unified:
            return self._graph("GET", ig_user_id, token, {"fields": ",".join(UNIFIED_PROFILE_FIELDS)})
        return self.me(token, INSTAGRAM_LOGIN_PROFILE_FIELDS)

    def me(self, token: str, fields: list[str]) -> dict[str, Any]:
        body = self._graph("GET", "me", token, {"fields": ",".join(fields)})
        if isinstance(body.get("data"), list) and body["data"]:
            body = body["data"][0]
        return body

    def list_media(self, token: str, ig_user_id: str, fields: list[str], *, max_items: int, page_size: int = 25,
                   after: str | None = None) -> tuple[list[dict], str | None]:
        """Newest-first media from ``after`` (or the start), following cursors until ``max_items``.
        Returns (items, next_cursor); ``next_cursor`` is None when the end of the list was reached."""
        items: list[dict] = []
        while len(items) < max_items:
            params = {"fields": ",".join(fields), "limit": str(min(page_size, max_items - len(items)))}
            if after:
                params["after"] = after
            page, after = self._page(self._graph("GET", f"{ig_user_id}/media", token, params))
            items.extend(page)
            if after is None:
                return items, None
        return items[:max_items], after

    def comments_page(self, token: str, media_id: str, fields: str, *, limit: int = 50, after: str | None = None) -> tuple[list[dict], str | None]:
        params = {"fields": fields, "limit": str(limit)}
        if after:
            params["after"] = after
        return self._page(self._graph("GET", f"{media_id}/comments", token, params))

    def media_insights(self, token: str, media_id: str, metrics: list[str]) -> list[dict]:
        body = self._graph("GET", f"{media_id}/insights", token, {"metric": ",".join(metrics)})
        return self._data(body)

    def account_insights(self, token: str, ig_user_id: str, metrics: list[str], *, metric_type: str, period: str,
                         since: int, until: int) -> list[dict]:
        params = {"metric": ",".join(metrics), "metric_type": metric_type, "period": period, "since": str(since), "until": str(until)}
        return self._data(self._graph("GET", f"{ig_user_id}/insights", token, params))

    def comments(self, token: str, media_id: str, fields: str, *, limit: int = 50) -> list[dict]:
        body = self._graph("GET", f"{media_id}/comments", token, {"fields": fields, "limit": str(limit)})
        return self._data(body)

    # ------------------------------------------------------------------ content publishing
    # POST /<IG_ID>/media (container) → poll /<CONTAINER_ID>?fields=status_code → POST /<IG_ID>/media_publish.
    # Media is fetched by Meta from public URLs (developers.facebook.com/documentation/instagram-platform/content-publishing).
    def create_container(self, token: str, ig_user_id: str, params: dict[str, str]) -> str:
        # Not retried in-request: a duplicate unpublished container is harmless but wastes the 400/24 h container quota;
        # the publishing job retries on its own schedule instead.
        body = self._graph_post(f"{ig_user_id}/media", token, params, retry=False)
        container_id = body.get("id")
        if not isinstance(container_id, str | int) or not str(container_id):
            raise ProviderError("bad_response")
        return str(container_id)

    def container_status(self, token: str, container_id: str) -> tuple[str, str | None]:
        """(status_code, status) — status_code is EXPIRED, ERROR, FINISHED, IN_PROGRESS or PUBLISHED."""
        body = self._graph("GET", container_id, token, {"fields": "status_code,status"})
        code = body.get("status_code")
        if not isinstance(code, str):
            raise ProviderError("bad_response")
        status = body.get("status")
        return code.upper(), (str(status)[:200] if status else None)

    def publish_container(self, token: str, ig_user_id: str, creation_id: str) -> str:
        body = self._graph_post(f"{ig_user_id}/media_publish", token, {"creation_id": creation_id}, retry=False)  # never twice
        media_id = body.get("id")
        if not isinstance(media_id, str | int) or not str(media_id):
            raise ProviderError("bad_response")
        return str(media_id)

    def media_permalink(self, token: str, media_id: str) -> str | None:
        body = self._graph("GET", media_id, token, {"fields": "permalink"})
        link = body.get("permalink")
        return link if isinstance(link, str) and link.startswith("https://") else None

    def publishing_limit(self, token: str, ig_user_id: str) -> dict[str, int | None]:
        body = self._graph("GET", f"{ig_user_id}/content_publishing_limit", token, {"fields": "quota_usage,config"})
        rows = self._data(body)
        row = rows[0] if rows else {}
        config = row.get("config") if isinstance(row.get("config"), dict) else {}

        def num(value: object) -> int | None:
            return int(value) if isinstance(value, int | float) and value >= 0 else None

        return {"quota_usage": num(row.get("quota_usage")), "quota_total": num(config.get("quota_total")),
                "quota_duration": num(config.get("quota_duration"))}

    # ------------------------------------------------------------------ plumbing
    def _graph_post(self, path: str, token: str, data: dict[str, str], *, retry: bool = True) -> dict:
        return self._request("POST", f"{self._host}/{self._version}/{path}", params={"access_token": token}, data=data, retry=retry)

    @property
    def _secret(self) -> str:
        assert self._settings.instagram_app_secret is not None
        return self._settings.instagram_app_secret.get_secret_value()

    @staticmethod
    def _page(body: dict) -> tuple[list[dict], str | None]:
        page = body.get("data")
        if not isinstance(page, list):
            raise ProviderError("bad_response")
        rows = [row for row in page if isinstance(row, dict) and row.get("id")]
        paging = body.get("paging") or {}
        after = (paging.get("cursors") or {}).get("after")
        return rows, (after if paging.get("next") and after and page else None)

    @staticmethod
    def _data(body: dict) -> list[dict]:
        data = body.get("data")
        if not isinstance(data, list):
            raise ProviderError("bad_response")
        return [row for row in data if isinstance(row, dict)]

    @staticmethod
    def _long_lived(body: dict) -> LongLivedToken:
        token = body.get("access_token")
        if not isinstance(token, str) or not token:
            raise ProviderError("bad_response")
        expires = body.get("expires_in")
        return LongLivedToken(access_token=token, expires_in=int(expires) if isinstance(expires, int | float) else None)

    def _graph(self, method: str, path: str, token: str, params: dict[str, str]) -> dict:
        return self._request(method, f"{self._host}/{self._version}/{path}", params={**params, "access_token": token})

    def _request(self, method: str, url: str, *, params: dict | None = None, data: dict | None = None, retry: bool = True) -> dict:
        attempts = 1 + (self._settings.instagram_http_max_retries if retry else 0)
        endpoint = (url.split("?")[0].replace(GRAPH_HOST, "").replace(FB_GRAPH_HOST, "")
                    .replace(f"/{self._version}/", "/"))  # for logs: no ids/tokens
        last: ProviderError | None = None
        for attempt in range(attempts):
            if attempt:  # exponential backoff with jitter (in-request retries; job-level retries come on top)
                base = self._settings.instagram_retry_backoff_seconds * (2 ** (attempt - 1))
                self._sleep(base + random.uniform(0, base))
            try:
                response = self._http.request(method, url, params=params, data=data)
            except httpx.TimeoutException:
                last = ProviderError("unavailable")
                logger.warning("Instagram API timeout (%s %s, attempt %d)", method, _shape(endpoint), attempt + 1)
                continue
            except httpx.HTTPError as exc:
                last = ProviderError("unavailable")
                logger.warning("Instagram API network error %s (%s %s)", exc.__class__.__name__, method, _shape(endpoint))
                continue
            if response.is_success:
                try:
                    body = response.json()
                except ValueError:
                    raise ProviderError("bad_response", http_status=response.status_code) from None
                if not isinstance(body, dict):
                    raise ProviderError("bad_response", http_status=response.status_code)
                return body
            last = _classify(response)
            logger.warning("Instagram API error kind=%s code=%s subcode=%s http=%s (%s %s)",
                           last.kind, last.provider_code, last.subcode, response.status_code, method, _shape(endpoint))
            if last.kind != "unavailable":
                raise last
        assert last is not None
        raise last


def _shape(endpoint: str) -> str:
    """Replace numeric object IDs so logs describe the endpoint without identifying accounts or media."""
    return "/".join("{id}" if part.isdigit() else part for part in endpoint.split("/"))
