"""Website signups from the Eko signup site's admin API (port of AdMarketer ``src/meta/signups.py``).

The signup admin is the ground truth for "did someone actually complete the signup form", which
Meta's insights for website ads cannot answer on their own. Each application carries
``utm_source`` / ``utm_medium`` / ``utm_campaign`` and ``fbclid``: Facebook appends ``fbclid`` to any
link clicked from a Facebook/Instagram ad, and ``utm_campaign``, when present, is a Meta campaign
id, so a signup can be tied back to the campaign that drove it.

Differences from AdMarketer:

* ``httpx`` instead of ``requests``; TLS verification follows ``EKO_SIGNUP_ADMIN_VERIFY_TLS``
  (default on; AdMarketer always disabled it for a self-signed internal certificate).
* There is no default base URL. When the base URL, user or password is missing,
  ``fetch_all_signups`` returns ``[]`` without any network call (``signups_configured`` says why).
* Failures raise ``SignupAdminError`` with a safe message (never the password, the bearer token,
  a response body or any applicant data). Nothing in this module logs applicant data.

The sync job (core) calls ``fetch_all_signups(settings, known_campaigns)`` and upserts the rows.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

log = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SECONDS = 20.0


class SignupAdminError(RuntimeError):
    """Safe to show to an admin and to store as a sync error (contains no credentials or PII)."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _secret(value: Any) -> str | None:
    if value is None:
        return None
    getter = getattr(value, "get_secret_value", None)
    raw = getter() if getter else str(value)
    return raw or None


def _config(settings: Any) -> tuple[str | None, str | None, str | None, bool, float]:
    base = (getattr(settings, "eko_signup_admin_base_url", None) or "").strip().rstrip("/") or None
    user = (getattr(settings, "eko_signup_admin_user", None) or "").strip() or None
    password = _secret(getattr(settings, "eko_signup_admin_password", None))
    verify = bool(getattr(settings, "eko_signup_admin_verify_tls", True))
    timeout = float(getattr(settings, "meta_ads_http_timeout_seconds", None) or DEFAULT_TIMEOUT_SECONDS)
    return base, user, password, verify, timeout


def signups_configured(settings: Any) -> bool:
    base, user, password, _, _ = _config(settings)
    return bool(base and user and password)


def classify_attribution(app: dict) -> tuple[str, str | None]:
    """Three tiers, most to least certain:
    1. campaign_matched -- utm_campaign names a real Meta campaign ID
    2. fbclid_only -- came from a Facebook click, but the destination URL
       didn't carry UTM params (so we know "Facebook" but not which ad)
    3. none -- no Facebook signal at all (organic, direct, or another channel)
    """
    campaign = (app.get("utm_campaign") or "").strip()
    has_fbclid = bool(app.get("fbclid"))
    source = (app.get("utm_source") or "").strip().lower()

    if campaign and (has_fbclid or source == "fb"):
        return "campaign_matched", campaign
    if has_fbclid or source == "fb":
        return "fbclid_only", None
    return "none", None


def to_signup(app: dict, known_campaigns: dict[str, str] | None = None) -> dict:
    """One admin-API application → AdMarketer's signup dict (DATA_DICTIONARY "A website signup")."""
    known_campaigns = known_campaigns or {}
    tier, campaign_id = classify_attribution(app)
    name = f"{app.get('first_name') or ''} {app.get('last_name') or ''}".strip()
    raw_id = app.get("id")
    return {
        "id": None if raw_id is None else str(raw_id),
        "mobile": str(app.get("mobile") or ""),
        "name": name,
        "submitted_at": app.get("submitted_at") or app.get("created_at"),
        "qualification_verdict": app.get("qualification_verdict") or "",
        "shop_address": app.get("shop_address") or "",
        "attribution_tier": tier,
        "matched_campaign_id": campaign_id,
        "matched_campaign_name": known_campaigns.get(campaign_id) if campaign_id else None,
        "utm_source": app.get("utm_source") or "",
        "utm_medium": app.get("utm_medium") or "",
        "utm_campaign": app.get("utm_campaign") or "",
    }


def _check(resp: httpx.Response, step: str) -> None:
    if resp.status_code in (401, 403):
        raise SignupAdminError("SIGNUP_ADMIN_AUTH", f"The signup admin panel rejected the {step} (HTTP {resp.status_code}). Check EKO_SIGNUP_ADMIN_USER / EKO_SIGNUP_ADMIN_PASSWORD.")
    if resp.status_code >= 400:
        raise SignupAdminError("SIGNUP_ADMIN_HTTP", f"The signup admin panel returned HTTP {resp.status_code} for the {step}.")


def _json(resp: httpx.Response, step: str) -> Any:
    try:
        return resp.json()
    except ValueError:
        raise SignupAdminError("SIGNUP_ADMIN_BAD_RESPONSE", f"The signup admin panel's {step} response was not JSON.") from None


def fetch_all_signups(settings: Any, known_campaigns: dict[str, str] | None = None, *,
                      transport: httpx.BaseTransport | None = None) -> list[dict]:
    """Every website signup, newest first, as AdMarketer signup dicts.

    Returns ``[]`` (no network call) when the signup admin is not configured. Raises
    ``SignupAdminError`` when the admin panel cannot be reached or rejects the request.
    ``known_campaigns`` maps Meta campaign id → name, so a campaign-matched signup can name its ad.
    """
    base, user, password, verify, timeout = _config(settings)
    if not (base and user and password):
        return []

    try:
        with httpx.Client(base_url=base, verify=verify, timeout=timeout, transport=transport, follow_redirects=False) as client:
            # The admin panel's own app-level login: POST credentials, then send the returned token as
            # ``Authorization: Bearer <token>`` (AdMarketer confirmed Basic Auth alone is rejected).
            resp = client.post("/api/admin/login", json={"username": user, "password": password})
            _check(resp, "login")
            data = _json(resp, "login")
            token = ((data.get("data") or {}).get("token") if isinstance(data, dict) else None)
            if not isinstance(data, dict) or data.get("status") != 0 or not token:
                raise SignupAdminError("SIGNUP_ADMIN_AUTH", "The signup admin panel did not accept the login. Check EKO_SIGNUP_ADMIN_USER / EKO_SIGNUP_ADMIN_PASSWORD.")

            resp = client.get("/api/applications", headers={"Authorization": f"Bearer {token}"})
            _check(resp, "applications request")
            payload = _json(resp, "applications")
    except SignupAdminError:
        raise
    except httpx.TimeoutException:
        raise SignupAdminError("SIGNUP_ADMIN_TIMEOUT", "The signup admin panel did not answer in time.") from None
    except httpx.HTTPError as exc:
        # The exception text can contain the request URL; only its type is reported.
        raise SignupAdminError("SIGNUP_ADMIN_UNREACHABLE", f"Could not reach the signup admin panel ({type(exc).__name__}).") from None

    apps = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(apps, list):
        raise SignupAdminError("SIGNUP_ADMIN_BAD_RESPONSE", "The signup admin panel's applications response had no list of applications.")

    signups = [to_signup(app, known_campaigns) for app in apps if isinstance(app, dict)]
    signups.sort(key=lambda s: str(s.get("submitted_at") or ""), reverse=True)
    log.info("signup admin: fetched %d signups", len(signups))  # counts only, never applicant data
    return signups
