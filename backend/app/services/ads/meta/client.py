"""Graph API client for the Meta Marketing API (port of AdMarketer's ``all_ads._get``).

* A global concurrency cap (``META_ADS_MAX_CONCURRENCY``, AdMarketer's ``_RATE_LIMIT_SEM = 6``) keeps one ad account
  under its rate-limit ceiling while campaigns are fetched in parallel.
* Meta's per-account rate limit (code 17) is retried after 4 s and 8 s, exactly like AdMarketer.
* Errors become :class:`MetaApiError` with the Graph error code; its message is passed through :func:`clean_error`
  so an access token (which travels in the request URL) never reaches a log line, a job row or an API response.
  Error code 190 is reported as ``TOKEN_EXPIRED``.
"""

from __future__ import annotations

import logging
import re
import threading
import time
from collections.abc import Callable
from typing import Any

import httpx

from app.core.config import Settings

logger = logging.getLogger("socialboard.ads")
for _noisy in ("httpx", "httpcore"):  # httpx logs full request URLs (with access_token) at INFO
    logging.getLogger(_noisy).setLevel(logging.WARNING)

GRAPH_HOST = "https://graph.facebook.com"
RETRY_DELAYS = (0, 4, 8)
TOKEN_EXPIRED = "TOKEN_EXPIRED"
_TOKEN_RE = re.compile(r"access_token=[^&\s)'\"]+")
# Long opaque Meta tokens (EAA…) that might appear outside a query string.
_BARE_TOKEN_RE = re.compile(r"\bEAA[A-Za-z0-9]{20,}\b")


def clean_error(msg: object) -> str | None:
    """Port of AdMarketer's ``_clean_error``: an expired/invalid token becomes ``TOKEN_EXPIRED``; any
    ``access_token=…`` is replaced by ``access_token=REDACTED``."""
    if not msg:
        return None
    text = str(msg)
    low = text.lower()
    if ("session has expired" in low or "error validating access token" in low or 'code": 190' in low
            or ("access token" in low and "expired" in low)):
        return TOKEN_EXPIRED
    text = _TOKEN_RE.sub("access_token=REDACTED", text)
    return _BARE_TOKEN_RE.sub("REDACTED", text)


class MetaApiError(Exception):
    """A failed Graph call. ``str()`` is always redacted."""

    def __init__(self, message: str, *, code: int | None = None, subcode: int | None = None, http_status: int | None = None) -> None:
        super().__init__(clean_error(message) or "Meta API error")
        self.code = code
        self.subcode = subcode
        self.http_status = http_status

    @property
    def token_expired(self) -> bool:
        return self.code == 190 or str(self) == TOKEN_EXPIRED

    @property
    def rate_limited(self) -> bool:
        return self.code == 17


class MetaNotConfiguredError(RuntimeError):
    pass


class MetaAdsClient:
    """Thread-safe (one ``httpx.Client`` shared by the worker threads). Tests pass an ``httpx.MockTransport`` and a
    no-op ``sleep``."""

    def __init__(self, settings: Settings, *, transport: httpx.BaseTransport | None = None,
                 sleep: Callable[[float], None] = time.sleep, image_transport: httpx.BaseTransport | None = None) -> None:
        if settings.meta_ads_access_token is None:
            raise MetaNotConfiguredError("META_ADS_ACCESS_TOKEN is not set")
        self._token = settings.meta_ads_access_token.get_secret_value()
        self.base_url = f"{GRAPH_HOST}/{settings.meta_ads_api_version}"
        self._sleep = sleep
        self._sem = threading.Semaphore(settings.meta_ads_max_concurrency)
        timeout = httpx.Timeout(settings.meta_ads_http_timeout_seconds)
        self._http = httpx.Client(transport=transport, timeout=timeout)
        # Picture downloads go to Meta's CDN (no token); a separate client so tests can mock them independently.
        self._images = httpx.Client(transport=image_transport or transport, timeout=httpx.Timeout(15.0), follow_redirects=True)

    def close(self) -> None:
        self._http.close()
        self._images.close()

    def __enter__(self) -> MetaAdsClient:
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    # ------------------------------------------------------------------------------------- graph
    def get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        """GET ``/<version>/<path>``; retries code 17 after 4 s and 8 s (AdMarketer ``_get``)."""
        query = {**(params or {}), "access_token": self._token}
        last: MetaApiError | None = None
        for attempt, delay in enumerate(RETRY_DELAYS):
            if delay:
                self._sleep(delay)
            try:
                with self._sem:
                    resp = self._http.get(f"{self.base_url}/{path}", params=query)
            except httpx.HTTPError as exc:
                # The exception text can contain the request URL (with the token): keep only the class name.
                raise MetaApiError(f"Could not reach Meta ({exc.__class__.__name__})") from None
            if resp.status_code < 400:
                try:
                    data = resp.json()
                except ValueError:
                    raise MetaApiError("Meta returned an unexpected response", http_status=resp.status_code) from None
                return data if isinstance(data, dict) else {}
            err = _error_body(resp)
            code = err.get("code") if isinstance(err.get("code"), int) else None
            subcode = err.get("error_subcode") if isinstance(err.get("error_subcode"), int) else None
            message = f"Meta API error {resp.status_code}" + (f" (code {code})" if code is not None else "")
            if err.get("message"):
                message += f": {str(err['message'])[:300]}"
            last = MetaApiError(message, code=code, subcode=subcode, http_status=resp.status_code)
            if code == 17 and attempt < len(RETRY_DELAYS) - 1:
                continue
            raise last
        assert last is not None
        raise last

    # ----------------------------------------------------------------------------------- images
    def download_image(self, url: str, *, max_bytes: int = 5_000_000) -> tuple[bytes, str] | None:
        """Best effort (AdMarketer ``_download_creative_image``): 200 + ``image/*`` + ≤ 5 MB, else None."""
        if not url or not url.startswith("https://"):
            return None
        try:
            resp = self._images.get(url)
        except httpx.HTTPError:
            return None
        ctype = (resp.headers.get("content-type") or "").lower().split(";")[0].strip()
        if resp.status_code != 200 or not ctype.startswith("image/") or len(resp.content) > max_bytes or not resp.content:
            return None
        return resp.content, ctype


def _error_body(resp: httpx.Response) -> dict[str, Any]:
    try:
        body = resp.json()
    except ValueError:
        return {}
    err = body.get("error") if isinstance(body, dict) else None
    return err if isinstance(err, dict) else {}
