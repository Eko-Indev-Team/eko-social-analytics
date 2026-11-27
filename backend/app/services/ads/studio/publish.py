"""Live publish + activation (port of AdMarketer ``campaign_builder.build_campaign`` live branch and ``activate``).

Everything is created PAUSED. If a step fails, the ids already created are kept and returned so the person can find
(and delete) the paused leftovers in Ads Manager — nothing spends money while paused.
"""

from __future__ import annotations

import copy as _copy
from dataclasses import dataclass, field

from . import targeting as tg
from .meta import MetaPublishError, MetaStudioClient


@dataclass
class PublishOutcome:
    meta_ids: dict = field(default_factory=dict)  # campaign_id, ad_set_id, image_hash, creative_id, ad_id
    sent: dict = field(default_factory=dict)  # the exact bodies sent (placeholders replaced)
    error: str | None = None
    token_expired: bool = False


def _resolve_unresolved(client: MetaStudioClient, ad_set: dict, unresolved: list[str]) -> None:
    geo = ad_set["targeting"].setdefault("geo_locations", {})
    if not unresolved:
        return
    cities, missing = [], []
    for name in unresolved:
        match = client.search_district(name, tg.DISTRICT_STATE_HINTS.get(name.title()))
        if match and match.get("key"):
            cities.append({"key": match["key"], "radius": tg.SEARCH_RADIUS_KM, "distance_unit": "kilometer"})
        else:
            missing.append(name)
    if missing:
        raise MetaPublishError(f"Could not resolve these districts to Meta locations: {', '.join(missing)}. Check the spelling or remove them.")
    geo["cities"] = cities
    geo.pop("countries", None)


def instagram_only(body: dict, instagram_user_id: str, page_id: str | None) -> None:
    """Turn the payload into an Instagram ad: the creative names the Instagram account (``instagram_user_id``) and the ad
    set runs only on Instagram placements. Meta's Instagram ads guide asks for a Facebook Page as well; without
    META_ADS_PAGE_ID the Page is left out, which Meta may reject (not verified against real Meta)."""
    spec = body["ad_creative"]["object_story_spec"]
    spec["instagram_user_id"] = instagram_user_id
    if page_id:
        spec["page_id"] = page_id
    else:
        spec.pop("page_id", None)
    targeting = body["ad_set"]["targeting"]
    targeting["publisher_platforms"] = ["instagram"]
    for key in ("facebook_positions", "messenger_positions", "audience_network_positions"):
        targeting.pop(key, None)


def publish(client: MetaStudioClient, payload: dict, *, image: bytes | None, image_content_type: str | None, unresolved: list[str],
            instagram_user_id: str | None = None) -> PublishOutcome:
    out = PublishOutcome()
    body = _copy.deepcopy(payload)
    if instagram_user_id:
        instagram_only(body, instagram_user_id, client.cfg.page_id)
    try:
        # Resolve districts first: a typo must not leave a stray paused campaign behind.
        _resolve_unresolved(client, body["ad_set"], unresolved)
        if not body["ad_set"]["targeting"].get("geo_locations"):
            raise MetaPublishError("No targetable locations: choose at least one district or village.")

        out.meta_ids["campaign_id"] = client.create("campaigns", body["campaign"])
        body["ad_set"]["campaign_id"] = out.meta_ids["campaign_id"]
        out.meta_ids["ad_set_id"] = client.create("adsets", body["ad_set"])

        link_data = body["ad_creative"]["object_story_spec"]["link_data"]
        if image:
            out.meta_ids["image_hash"] = client.upload_image(image, image_content_type or "image/jpeg")
            link_data["image_hash"] = out.meta_ids["image_hash"]
        else:
            link_data.pop("image_hash", None)
        if client.cfg.page_id:
            body["ad_creative"]["object_story_spec"]["page_id"] = client.cfg.page_id
        out.meta_ids["creative_id"] = client.create("adcreatives", body["ad_creative"])

        body["ad"]["adset_id"] = out.meta_ids["ad_set_id"]
        body["ad"]["creative"] = {"creative_id": out.meta_ids["creative_id"]}
        out.meta_ids["ad_id"] = client.create("ads", body["ad"])
    except MetaPublishError as exc:
        out.error = exc.safe_message
        out.token_expired = exc.token_expired
    body.pop("ad_image", None)
    out.sent = body
    return out


def activate(client: MetaStudioClient, meta_ids: dict) -> list[str]:
    """Flip campaign → ad set → ad to ACTIVE. Only ever called from an explicit, confirmed request."""
    done = []
    for key in ("campaign_id", "ad_set_id", "ad_id"):
        client.set_status(meta_ids[key], "ACTIVE")
        done.append(key)
    return done
