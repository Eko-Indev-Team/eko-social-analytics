"""Minimal Meta Marketing API client for Ad Studio publishing (port of AdMarketer ``campaign_builder`` live branch,
``geo_resolver`` and ``insights`` live branch).

UNVERIFIED AGAINST REAL META: AdMarketer's own handover says these live paths were "barely exercised"; here they are
tested only with a mocked transport. The token is sent in the ``Authorization`` header (never in a URL), and every error
message is passed through ``clean_error`` so a token or full Graph URL can never reach a log line or an API response.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

import httpx

logger = logging.getLogger("socialboard.ads.studio")

GRAPH_BASE = "https://graph.facebook.com"
INSIGHT_FIELDS = "reach,impressions,frequency,clicks,ctr,cpc,cpm,spend,actions"
LEAD_ACTION_TYPES = ("lead", "onsite_conversion.lead_grouped")


class MetaPublishError(Exception):
    def __init__(self, message: str, *, code: int | None = None, token_expired: bool = False) -> None:
        super().__init__(message)
        self.safe_message = message
        self.code = code
        self.token_expired = token_expired


def clean_error(msg: object) -> str:
    """AdMarketer ``_clean_error``: Meta errors can echo the request URL incl. the access token."""
    text = str(msg or "")
    low = text.lower()
    if "session has expired" in low or "error validating access token" in low or '"code": 190' in low or ("access token" in low and "expired" in low):
        return "TOKEN_EXPIRED"
    text = re.sub(r"access_token=[^&\s)'\"]+", "access_token=REDACTED", text)
    text = re.sub(r"(?i)bearer\s+[A-Za-z0-9._\-]+", "Bearer REDACTED", text)
    return re.sub(r"https?://graph\.facebook\.com/\S*", "<graph url>", text)[:400]


@dataclass
class MetaConfig:
    token: str
    api_version: str
    account_id: str
    page_id: str
    timeout: float = 20.0


class MetaStudioClient:
    def __init__(self, cfg: MetaConfig, *, transport: httpx.BaseTransport | None = None) -> None:
        self.cfg = cfg
        account = cfg.account_id if cfg.account_id.startswith("act_") else f"act_{cfg.account_id}"
        self.account = account
        self._http = httpx.Client(base_url=f"{GRAPH_BASE}/{cfg.api_version}", transport=transport, timeout=httpx.Timeout(cfg.timeout),
                                  headers={"Authorization": f"Bearer {cfg.token}"}, follow_redirects=False)

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> MetaStudioClient:
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    # ------------------------------------------------------------------ transport
    def _request(self, method: str, path: str, **kwargs) -> dict:
        try:
            response = self._http.request(method, path, **kwargs)
        except httpx.TimeoutException:
            raise MetaPublishError("Meta did not respond in time.") from None
        except httpx.HTTPError as exc:
            logger.warning("meta studio network error %s", exc.__class__.__name__)
            raise MetaPublishError("Could not reach Meta.") from None
        try:
            body = response.json()
        except ValueError:
            body = {}
        if not response.is_success or (isinstance(body, dict) and "error" in body):
            detail = body.get("error", {}) if isinstance(body, dict) else {}
            code = detail.get("code") if isinstance(detail, dict) else None
            raw = (detail.get("error_user_msg") or detail.get("message")) if isinstance(detail, dict) else None
            message = clean_error(raw or f"HTTP {response.status_code}")
            expired = code == 190 or message == "TOKEN_EXPIRED"
            logger.warning("meta studio error http=%s code=%s path=%s", response.status_code, code, path.split("?")[0])
            if expired:
                raise MetaPublishError("The Meta access token has expired or is invalid (TOKEN_EXPIRED). Create a new token.", code=code,
                                       token_expired=True)
            raise MetaPublishError(f"Meta API error ({response.status_code}): {message}", code=code)
        return body if isinstance(body, dict) else {}

    # ------------------------------------------------------------------ publishing
    def create(self, edge: str, body: dict) -> str:
        data = self._request("POST", f"/{self.account}/{edge}", json=body)
        if not data.get("id"):
            raise MetaPublishError(f"Meta did not return an id for the new {edge.rstrip('s')}.")
        return str(data["id"])

    def upload_image(self, content: bytes, content_type: str) -> str:
        ext = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}.get(content_type, "jpg")
        data = self._request("POST", f"/{self.account}/adimages", files={"filename": (f"ad_image.{ext}", content, content_type)})
        images = data.get("images") or {}
        first = next(iter(images.values()), None) if isinstance(images, dict) else None
        if not isinstance(first, dict) or not first.get("hash"):
            raise MetaPublishError("Meta did not return an image hash for the uploaded picture.")
        return str(first["hash"])

    def set_status(self, node_id: str, status: str) -> None:
        self._request("POST", f"/{node_id}", json={"status": status})

    def search_district(self, name: str, state_hint: str | None) -> dict | None:
        """AdMarketer ``geo_resolver.resolve_district``: Meta location search, India only, state hint disambiguates."""
        data = self._request("GET", "/search", params={"type": "adgeolocation", "q": name, "location_types": '["city","region"]', "limit": 5})
        candidates = [row for row in data.get("data", []) if isinstance(row, dict) and row.get("country_code") == "IN"]
        if not candidates:
            return None
        if state_hint:
            for c in candidates:
                if c.get("region") == state_hint:
                    return c
        return candidates[0]

    # ------------------------------------------------------------------ token assets
    def ad_accounts(self) -> list[dict]:
        """Ad accounts this token may use (``/me/adaccounts``). With an Instagram Unified-login token these are the ad
        accounts the person selected when connecting."""
        data = self._request("GET", "/me/adaccounts", params={"fields": "account_id,name,account_status", "limit": 50})
        return [row for row in data.get("data", []) if isinstance(row, dict) and row.get("account_id")]

    # ------------------------------------------------------------------ insights
    def campaign_insights(self, campaign_id: str) -> dict | None:
        data = self._request("GET", f"/{campaign_id}/insights", params={"fields": INSIGHT_FIELDS})
        rows = data.get("data") or []
        return rows[0] if rows and isinstance(rows[0], dict) else None


def parse_insights(row: dict | None) -> dict:
    """AdMarketer ``insights.get_insights`` live branch (no data yet → zeros, as Meta reports none)."""
    if not row:
        return {"reach": 0, "impressions": 0, "frequency": 0.0, "clicks": 0, "ctr": 0.0, "cpc": 0.0, "cpm": 0.0, "spend": 0.0, "leads": 0, "cpa": None}
    leads = 0
    for action in row.get("actions") or []:
        if isinstance(action, dict) and action.get("action_type") in LEAD_ACTION_TYPES:
            try:
                leads += int(float(action.get("value", 0)))
            except (TypeError, ValueError):
                pass

    def f(key: str) -> float:
        try:
            return float(row.get(key) or 0)
        except (TypeError, ValueError):
            return 0.0

    spend = f("spend")
    return {"reach": int(f("reach")), "impressions": int(f("impressions")), "frequency": f("frequency"), "clicks": int(f("clicks")),
            "ctr": f("ctr"), "cpc": f("cpc"), "cpm": f("cpm"), "spend": spend, "leads": leads, "cpa": round(spend / leads, 2) if leads else None}
