"""The exact Meta Marketing API request bodies Ad Studio sends (port of AdMarketer ``campaign_builder._dry_run_payload``
merged with its live branch, so a dry run shows what *would* be sent rather than an approximation).

Values only known after Meta answers (campaign id, ad set id, uploaded image hash, creative id) are placeholders in
angle brackets. Everything is created ``PAUSED``; activation is a separate, explicit step.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

from . import rules

PLACEHOLDER_CAMPAIGN_ID = "<campaign id from Meta>"
PLACEHOLDER_ADSET_ID = "<ad set id from Meta>"
PLACEHOLDER_IMAGE_HASH = "<image hash from Meta upload>"
PLACEHOLDER_CREATIVE_ID = "<creative id from Meta>"


def normalize_url(url: str | None) -> str:
    """AdMarketer accepted 'kiosk.eko.in/signup'; Meta needs an absolute http(s) link."""
    raw = (url or "").strip() or rules.DEFAULT_DESTINATION_URL
    if not raw.lower().startswith(("http://", "https://")):
        raw = "https://" + raw
    message = "The destination must be a website address like https://kiosk.eko.in/signup"
    parsed = urlparse(raw)
    try:
        parsed.port  # noqa: B018 - raises ValueError for a malformed port
    except ValueError:
        raise ValueError(message) from None
    host = parsed.hostname or ""
    if parsed.scheme not in ("http", "https") or not re.fullmatch(r"[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}", host) or any(c.isspace() for c in raw):
        raise ValueError(message)
    return raw


def build(*, brief: dict, copy: dict, targeting: dict, destination: dict, page_id: str | None, pixel_id: str | None,
          has_image: bool) -> dict:
    product = brief["product"]
    objective = rules.OBJECTIVE_MAP.get(brief["objective"], "OUTCOME_TRAFFIC")
    optimization_goal = "OFFSITE_CONVERSIONS" if objective == "OUTCOME_SALES" else "LINK_CLICKS"
    ad_set: dict = {
        "name": f"{product} - AdSet 1",
        "campaign_id": PLACEHOLDER_CAMPAIGN_ID,
        "daily_budget": int(round(float(targeting["daily_budget"]) * 100)),  # minor units (paise)
        "billing_event": "IMPRESSIONS",
        "optimization_goal": optimization_goal,
        "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
        "targeting": targeting["meta_targeting"],
        "status": "PAUSED",
    }
    if objective == "OUTCOME_TRAFFIC" and pixel_id:
        # AdMarketer: website ads optimised for link clicks found clickers, not signups; with a pixel, optimise for the
        # "Lead" event the signup site actually fires (it never sends CompleteRegistration).
        ad_set["optimization_goal"] = "OFFSITE_CONVERSIONS"
        ad_set["promoted_object"] = {"pixel_id": pixel_id, "custom_event_type": "LEAD"}

    link = destination["url"]
    return {
        "campaign": {
            "name": f"{product} - {brief['objective']}",
            "objective": objective,
            "status": "PAUSED",
            "special_ad_categories": [],
            # Required by Meta when the budget lives on the ad set (no Campaign Budget Optimization).
            "is_adset_budget_sharing_enabled": False,
        },
        "ad_set": ad_set,
        "ad_image": {"upload": "the draft's picture" if has_image else None},
        "ad_creative": {
            "name": f"{product} creative",
            "object_story_spec": {
                "page_id": page_id or "<META_ADS_PAGE_ID not set>",
                "link_data": {
                    "message": copy["primary_text"],
                    "link": link,
                    "name": copy["headline"],
                    "description": copy["description"],
                    "image_hash": PLACEHOLDER_IMAGE_HASH if has_image else None,
                    "call_to_action": {"type": copy["cta"]},
                },
            },
        },
        "ad": {
            "name": f"{product} - Ad 1",
            "adset_id": PLACEHOLDER_ADSET_ID,
            "creative": {"creative_id": PLACEHOLDER_CREATIVE_ID},
            "status": "PAUSED",
            # Meta fills {{campaign.id}}/{{ad.id}} per click so every signup can be traced to the ad (AdMarketer fix:
            # 141 of 146 signups had no utm_campaign before these tags were added).
            "url_tags": rules.URL_TAGS,
        },
        "review": {
            "unresolved_districts": targeting.get("unresolved_districts", []),
            "placements": targeting.get("placements"),
            "schedule_days": targeting.get("schedule_days"),
            "schedule_note": "Run length is for your planning only: like AdMarketer, no end date is sent to Meta. Pause the ad when you are done.",
            "call_whatsapp_number": destination.get("number"),
        },
    }
