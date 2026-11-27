"""Port of AdMarketer's ``src/meta/all_ads.py``: pulls every real ad the token can see, across every ad account,
with insights, breakdowns, targeting, creative and lead-form leads, then applies AdMarketer's business rules:

* targeting restore from the durable per-campaign record when a live targeting fetch failed
  (``restore_targeting_from_db``),
* shared-form lead assignment (``assign_leads_across_shared_forms``),
* the durable targeting record is only updated from a *successful* fetch (``update_ad_pincode_db``),
* final qualification against each ad's own targeted pincodes + both screening questions
  (``remark_qualified_with_ad_pincode_db``).

Differences from AdMarketer (by design, see notes): no module-level caches (the durable targeting record replaces the
in-memory ``_TARGETING_CACHE``; Postgres replaces the JSON files), the screening-question markers come from settings,
the ad-set request also reads the optimisation fields (backlog item 5) and a lead form whose leads could not be
fetched is reported in ``PullResult.failed_forms`` so the caller keeps the leads it already stored.

Pure functions (no I/O) are separated from the fetchers so the rules can be unit-tested directly.
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterable
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.services import qualification as q

from .client import TOKEN_EXPIRED, MetaAdsClient, MetaApiError, clean_error

MAX_WORKERS = 10
BASE_FIELDS = "impressions,reach,clicks,ctr,cpc,cpm,spend,inline_link_clicks,actions"
ADSET_FIELDS = "targeting,optimization_goal,bid_strategy,promoted_object,daily_budget,lifetime_budget"
YES_VALUES = ("yes", "y", "हाँ", "हां", "ha")
LEAD_FORM_OBJECTIVES = ("LEAD_GENERATION", "OUTCOME_LEADS")
WEBSITE_OBJECTIVES = ("LINK_CLICKS", "OUTCOME_TRAFFIC")
_PINCODE_RE = re.compile(r"\b(\d{6})\b")

CATEGORY_LABELS = {
    "interests": "Interests",
    "behaviors": "Behaviors",
    "work_positions": "Job title",
    "work_employers": "Employer",
    "industries": "Industry",
    "education_statuses": "Education status",
    "education_schools": "School",
    "education_majors": "Field of study",
    "relationship_statuses": "Relationship status",
    "family_statuses": "Family status",
    "life_events": "Life event",
    "income": "Income",
    "home_ownership": "Home ownership",
    "home_type": "Home type",
    "net_worth": "Net worth",
    "generation": "Generation",
    "parents": "Parents",
}


@dataclass
class Markers:
    investment: str = "invest minimum"
    franchise: str = "franchise background"  # display only (no longer part of qualification)
    education: str = "education"
    esaf: str = "esaf"


@dataclass
class PullResult:
    error: str | None
    ads: list[dict] = field(default_factory=list)
    # Lead forms whose lead list could not be fetched this run (their stored leads must be kept).
    failed_forms: set[str] = field(default_factory=set)
    # campaign_id → optimisation fields read from the campaign's ad set (only for successful reads).
    optimization: dict[str, dict] = field(default_factory=dict)
    # The durable targeting record after this run's successful fetches were merged in.
    targeting_db: dict[str, dict] = field(default_factory=dict)
    # campaign ids whose targeting record changed this run.
    targeting_changed: set[str] = field(default_factory=set)
    # form id → every lead id Meta returned for it this run (lets the caller tell "re-attributed" from "aged out").
    form_lead_ids: dict[str, set[str]] = field(default_factory=dict)


def channel_for(objective: str | None) -> str:
    if objective in LEAD_FORM_OBJECTIVES:
        return "lead_form"
    if objective in WEBSITE_OBJECTIVES:
        return "website"
    return "other"


# =============================================================================== pure rules
def extract_creative(creative: dict | None) -> dict:
    """The image and caption text each ad ran with (from ``object_story_spec``)."""
    creative = creative or {}
    spec = creative.get("object_story_spec") or {}
    out = {"type": "unknown", "primary_text": "", "headline": "", "description": "", "cta": "",
           "image_hash": "", "image_url": creative.get("image_url") or "", "thumbnail_url": creative.get("thumbnail_url") or ""}
    ld = spec.get("link_data")
    vd = spec.get("video_data")
    pd = spec.get("photo_data")
    if ld:
        kids = ld.get("child_attachments") or []
        out["type"] = "carousel" if kids else "image"
        out["primary_text"] = ld.get("message") or ""
        out["headline"] = ld.get("name") or (kids[0].get("name") if kids else "") or ""
        out["description"] = ld.get("description") or ld.get("caption") or ""
        out["cta"] = (ld.get("call_to_action") or {}).get("type") or ""
        out["image_hash"] = ld.get("image_hash") or (kids[0].get("image_hash") if kids else "") or ""
        out["image_url"] = out["image_url"] or ld.get("picture") or ""
    elif vd:
        out["type"] = "video"
        out["primary_text"] = vd.get("message") or ""
        out["headline"] = vd.get("title") or ""
        out["description"] = vd.get("link_description") or ""
        out["cta"] = (vd.get("call_to_action") or {}).get("type") or ""
        out["image_url"] = out["image_url"] or vd.get("image_url") or ""
    elif pd:
        out["type"] = "image"
        out["primary_text"] = pd.get("caption") or ""
        out["image_hash"] = pd.get("image_hash") or ""
        out["image_url"] = out["image_url"] or pd.get("url") or ""
    return out


def summarize_targeting(targeting: dict) -> dict:
    """What was configured: geo targeting (pincodes/cities/regions/radius points) and detailed targeting."""
    geo = targeting.get("geo_locations", {}) or {}

    locations: list[str] = []
    targeted_pincodes: set[str] = set()
    if geo.get("zips"):
        pins = [z.get("name") or z.get("key", "").split(":")[-1] for z in geo["zips"]]
        targeted_pincodes = set(pins)
        locations.append(f"{len(pins)} pincode(s): {', '.join(pins)}")
    if geo.get("custom_locations"):
        locations.append(f"{len(geo['custom_locations'])} custom radius point(s)")
    if geo.get("cities"):
        locations.append(", ".join(c.get("name", "") for c in geo["cities"]) + " (city-level)")
    if geo.get("regions"):
        locations.append(", ".join(r.get("name", "") for r in geo["regions"]) + " (state-level)")
    if geo.get("countries"):
        locations.append(", ".join(geo["countries"]) + " (country-wide)")
    if not locations:
        locations.append("Not available")

    def _category_names(container: dict | None) -> dict[str, list[str]]:
        found: dict[str, list[str]] = {}
        for key, items in (container or {}).items():
            if not (isinstance(items, list) and items and isinstance(items[0], dict) and "name" in items[0]):
                continue
            label = CATEGORY_LABELS.get(key, key.replace("_", " ").title())
            found.setdefault(label, [])
            found[label] += [i["name"] for i in items if i.get("name")]
        return found

    categories = _category_names(targeting)
    for spec in targeting.get("flexible_spec", []) or []:
        for label, names in _category_names(spec).items():
            categories.setdefault(label, [])
            categories[label] += names

    advantage_on = (targeting.get("targeting_automation") or {}).get("advantage_audience") == 1

    if categories:
        parts = [f"{label}: {', '.join(dict.fromkeys(names))}" for label, names in categories.items()]
        interests_behaviors = "; ".join(parts)
        if advantage_on:
            interests_behaviors += " (Advantage+ Audience also on -- Meta may deliver beyond this list)"
    elif advantage_on:
        interests_behaviors = "Advantage+ Audience only (Meta auto-targets -- no manual interest/behavior/job-title list was set)"
    else:
        interests_behaviors = "Not available"

    setup = {
        "age_min": targeting.get("age_min"),
        "age_max": targeting.get("age_max"),
        "age_range": targeting.get("age_range"),
        "genders": targeting.get("genders") or [],
        "publisher_platforms": targeting.get("publisher_platforms") or [],
        "advantage_audience": advantage_on,
        "categories": {label: list(dict.fromkeys(names)) for label, names in categories.items()},
    }
    return {"locations": locations, "interests_behaviors": interests_behaviors, "targeted_pincodes": targeted_pincodes,
            "pincode_check_ok": True, "setup": setup}


def display_status(campaign: dict, now: datetime | None = None) -> str | None:
    """ACTIVE past the campaign's own stop_time is shown as COMPLETED."""
    raw = campaign.get("effective_status", campaign.get("status"))
    stop_time = campaign.get("stop_time")
    if raw == "ACTIVE" and stop_time:
        try:
            stop = datetime.fromisoformat(stop_time)
        except ValueError:
            return raw
        if stop.tzinfo is None:
            stop = stop.replace(tzinfo=timezone.utc)
        if stop < (now or datetime.now(timezone.utc)):
            return "COMPLETED"
    return raw


def extract_lead_form_id(ad: dict) -> str | None:
    spec = ((ad.get("creative") or {}).get("object_story_spec")) or {}
    for block in ("link_data", "video_data"):
        cta = (spec.get(block) or {}).get("call_to_action") or {}
        form_id = (cta.get("value") or {}).get("lead_gen_form_id")
        if form_id:
            return form_id
    return None


def extract_actions(actions: Iterable[dict] | None) -> dict[str, int]:
    """``lead`` and ``onsite_conversion.lead_grouped`` are the same conversions: max, never summed."""
    dedup_groups = {"leads": {"lead", "onsite_conversion.lead_grouped"}}
    single_keys = {
        "link_click": "link_clicks",
        "landing_page_view": "landing_page_views",
        "post_engagement": "post_engagement",
        "video_view": "video_views",
    }
    out: dict[str, int] = {}
    for a in actions or []:
        action_type = a.get("action_type")
        value = int(float(a.get("value", 0)))
        if action_type in single_keys:
            key = single_keys[action_type]
            out[key] = out.get(key, 0) + value
        else:
            for key, members in dedup_groups.items():
                if action_type in members:
                    out[key] = max(out.get(key, 0), value)
    return out


def find_answer(answers: dict, marker: str) -> str | None:
    for label, value in answers.items():
        if marker in label.lower():
            return value
    return None


def answered_yes(answers: dict, marker: str) -> bool:
    val = (find_answer(answers, marker) or "").strip().lower()
    return val in YES_VALUES


def passes_screening_questions(answers: dict, markers: Markers) -> bool:
    return answered_yes(answers, markers.investment) and answered_yes(answers, markers.franchise)


def extract_pincode(answers: dict) -> str | None:
    """The 6-digit PIN the lead typed, whatever the form labelled that question."""
    for label, value in answers.items():
        if "pin" in label.lower() or "पिन" in label:
            m = _PINCODE_RE.search(value or "")
            if m:
                return m.group(1)
    for value in answers.values():
        m = _PINCODE_RE.search(value or "")
        if m:
            return m.group(1)
    return None


def extract_contact(answers: dict) -> tuple[str | None, str | None]:
    """(name, phone) from a lead's answers — AdMarketer reads the ``Full name`` / ``Phone number`` answers."""
    def pick(exact: tuple[str, ...], contains: tuple[str, ...]) -> str | None:
        for key in exact:
            if answers.get(key):
                return str(answers[key])
        for label, value in answers.items():
            low = label.lower()
            if value and any(c in low for c in contains):
                return str(value)
        return None

    return pick(("Full name", "full_name"), ("full name",)), pick(("Phone number", "phone_number"), ("phone", "mobile"))


def mark_pincode_qualified(leads_data: list[dict], targeted_pincodes: set[str], pincode_check_ok: bool = True) -> None:
    for lead in leads_data:
        pin = extract_pincode(lead.get("answers", {}))
        lead["submitted_pincode"] = pin
        if not pincode_check_ok:
            lead["pincode_qualified"] = None
        else:
            lead["pincode_qualified"] = bool(pin and targeted_pincodes and pin in targeted_pincodes)


def assign_leads(campaigns: list[dict], raw_leads: list[dict]) -> None:
    """Assignment for ONE shared form (AdMarketer ``_assign_leads_across_shared_forms`` inner loop): narrowest
    targeting claims its real pincode matches first, then remaining slots are filled by recency. ``raw_leads`` is
    newest-first. Sets ``leads_data`` on every campaign."""
    for lead in raw_leads:
        lead["submitted_pincode"] = extract_pincode(lead.get("answers", {}))
    unassigned = list(raw_leads)
    campaigns_by_specificity = sorted(
        campaigns, key=lambda r: len(r["targeting_summary"]["targeted_pincodes"]) or float("inf"),
    )
    for r in campaigns_by_specificity:
        need = r["_campaign_lead_count"]
        targeted = r["targeting_summary"]["targeted_pincodes"]
        pincode_check_ok = r["targeting_summary"]["pincode_check_ok"]
        assigned: list[dict] = []
        if pincode_check_ok and targeted:
            matches = [lead for lead in unassigned if lead.get("submitted_pincode") in targeted]
            assigned.extend(matches[:need])
        for lead in assigned:
            unassigned.remove(lead)
        if len(assigned) < need:
            fill = unassigned[: need - len(assigned)]
            assigned.extend(fill)
            for lead in fill:
                unassigned.remove(lead)
        mark_pincode_qualified(assigned, targeted, pincode_check_ok)
        r["leads_data"] = assigned


def restore_targeting_from_db(results: list[dict], db: dict[str, dict]) -> None:
    """Fills targeting for any ad whose live fetch failed, from the last successful fetch on record."""
    for r in results:
        ts = r.get("targeting_summary", {})
        if ts.get("pincode_check_ok"):
            continue
        entry = db.get(r["campaign_id"])
        if not entry:
            continue
        pins = entry.get("pincodes") or []
        locations = entry.get("locations") or ([f"{len(pins)} pincode(s): {', '.join(pins)}"] if pins else ["Not available"])
        r["targeting_summary"] = {
            "locations": locations,
            "interests_behaviors": entry.get("interests_behaviors") or "Not recorded",
            "setup": entry.get("setup") or {},
            "targeted_pincodes": set(pins),
            "pincode_check_ok": True,
            "restored_from_db": True,
        }


def update_ad_pincode_db(results: list[dict], db: dict[str, dict]) -> set[str]:
    """Upserts each campaign's targeting into ``db`` — only from a fetch that succeeded this run (never from a
    failed or restored one). Returns the campaign ids whose entry changed."""
    changed: set[str] = set()
    for r in results:
        ts = r.get("targeting_summary", {})
        if not ts.get("pincode_check_ok") or ts.get("restored_from_db"):
            continue
        entry = {
            "campaign_name": r.get("campaign_name"),
            "ad_name": r.get("ad_name"),
            "account_name": r.get("account_name"),
            "pincodes": sorted(ts.get("targeted_pincodes") or []),
            "locations": ts.get("locations") or [],
            "interests_behaviors": ts.get("interests_behaviors") or "",
            "setup": ts.get("setup") or {},
        }
        if db.get(r["campaign_id"]) != entry:
            db[r["campaign_id"]] = entry
            changed.add(r["campaign_id"])
    return changed


def effective_targeted_pincodes(result: dict, db: dict[str, dict]) -> set[str]:
    ts = result.get("targeting_summary", {})
    if ts.get("pincode_check_ok") and ts.get("targeted_pincodes"):
        return set(ts["targeted_pincodes"])
    entry = db.get(result["campaign_id"])
    return set(entry["pincodes"]) if entry else set()


def find_education_answer(answers: dict, markers: Markers) -> str | None:
    """The highest-education answer: label containing the education marker, else "qualification"."""
    value = find_answer(answers, markers.education)
    if value is None and markers.education != "qualification":
        value = find_answer(answers, "qualification")
    return value


def qualify_lead(lead: dict, targeted: set[str], markers: Markers, *, staff_esaf: str | None = None) -> None:
    """Final qualification (product-owner rules, ``app.services.qualification``). Keeps AdMarketer's
    ``pincode_qualified`` (stage 1, a bool) for the reports and adds the new status fields. ``qualified`` is now
    ``qualification_status in {sbi_strong, esaf_strong}`` and ``passes_screening_questions`` = can_invest AND education_ok.
    A staff-set ESAF answer (``staff_esaf``) wins over the lead-form answer."""
    answers = lead.get("answers", {}) or {}
    pin = lead.get("submitted_pincode")
    lead["pincode_qualified"] = bool(pin and targeted and pin in targeted)
    # Unknown pincode (none typed, or no targeted list to check against) → None, not a mismatch.
    pincode_match = None if not pin or not targeted else pin in targeted
    education_answer = find_education_answer(answers, markers)
    education_level, education_ok = q.parse_education(education_answer)
    can_invest = q.yes_no(find_answer(answers, markers.investment))
    if staff_esaf in ("yes", "no"):
        esaf, source = staff_esaf, "staff"
    else:
        esaf = q.esaf_value(find_answer(answers, markers.esaf))
        source = "form" if esaf else None
    status, reasons = q.qualify_lead(pincode_match, education_ok, can_invest, esaf)
    lead.update({
        "pincode_match": pincode_match, "education_answer": education_answer, "education_level": education_level,
        "education_ok": education_ok, "can_invest": can_invest, "esaf_response": esaf, "esaf_response_source": source,
        "qualification_status": status, "sbi_reasons": reasons,
        "passes_screening_questions": bool(can_invest and education_ok),
        "qualified": q.is_qualified(status),
    })


def remark_qualified_with_ad_pincode_db(results: list[dict], db: dict[str, dict], markers: Markers) -> None:
    for r in results:
        targeted = effective_targeted_pincodes(r, db)
        for lead in r.get("leads_data", []):
            qualify_lead(lead, targeted, markers)


def optimization_from_adset(adset: dict) -> dict:
    po = adset.get("promoted_object") or {}
    return {
        "optimization_goal": adset.get("optimization_goal"),
        "bid_strategy": adset.get("bid_strategy"),
        "pixel_id": po.get("pixel_id"),
        "custom_event_type": po.get("custom_event_type"),
        "daily_budget": adset.get("daily_budget"),
        "lifetime_budget": adset.get("lifetime_budget"),
    }


# =============================================================================== fetchers
class AdsFetcher:
    """The Graph reads AdMarketer makes, bound to one client."""

    def __init__(self, client: MetaAdsClient) -> None:
        self.client = client

    def list_ad_accounts(self) -> list[dict]:
        return self.client.get("me/adaccounts", {"fields": "id,name,account_status", "limit": 200}).get("data", [])

    def list_campaigns(self, account_id: str) -> list[dict]:
        return self.client.get(f"{account_id}/campaigns", {
            "fields": "id,name,status,effective_status,created_time,objective,stop_time", "limit": 200,
        }).get("data", [])

    def list_ads_for_campaign(self, campaign_id: str) -> list[dict]:
        return self.client.get(f"{campaign_id}/ads", {
            "fields": "id,name,status,effective_status,creative{thumbnail_url,image_url,object_story_spec}", "limit": 50,
        }).get("data", [])

    def get_adset(self, campaign_id: str) -> dict:
        adsets = self.client.get(f"{campaign_id}/adsets", {"fields": ADSET_FIELDS, "limit": 1}).get("data", [])
        return adsets[0] if adsets else {}

    def base_insights(self, campaign_id: str) -> dict | None:
        rows = self.client.get(f"{campaign_id}/insights", {"fields": BASE_FIELDS, "date_preset": "maximum"}).get("data", [])
        return rows[0] if rows else None

    def breakdown_insights(self, campaign_id: str, breakdowns: list[str]) -> list[dict]:
        return self.client.get(f"{campaign_id}/insights", {
            "fields": "impressions,reach,clicks,spend,actions", "breakdowns": ",".join(breakdowns),
            "date_preset": "maximum", "limit": 200,
        }).get("data", [])

    def first_impression_hour(self, campaign_id: str, date: str) -> str | None:
        data = self.client.get(f"{campaign_id}/insights", {
            "fields": "impressions", "breakdowns": "hourly_stats_aggregated_by_advertiser_time_zone",
            "time_range": json.dumps({"since": date, "until": date}),
        })
        rows = [r for r in data.get("data", []) if int(float(r.get("impressions", 0))) > 0]
        if not rows:
            return None
        rows.sort(key=lambda r: r["hourly_stats_aggregated_by_advertiser_time_zone"])
        return rows[0]["hourly_stats_aggregated_by_advertiser_time_zone"].split(" - ")[0]

    def lead_form_questions(self, form_id: str) -> dict[str, str]:
        data = self.client.get(form_id, {"fields": "questions"})
        return {q["key"]: q["label"] for q in data.get("questions", []) if q.get("key")}

    def leads(self, form_id: str) -> list[dict]:
        """Every lead ever submitted to the form (all pages)."""
        leads: list[dict] = []
        params: dict[str, Any] = {"fields": "id,created_time,field_data", "limit": 100}
        while True:
            data = self.client.get(f"{form_id}/leads", params)
            leads.extend(data.get("data", []))
            paging = data.get("paging", {})
            after = paging.get("cursors", {}).get("after")
            if not paging.get("next") or not after:
                break
            params = {"fields": "id,created_time,field_data", "limit": 100, "after": after}
        return leads

    def readable_leads(self, form_id: str) -> list[dict] | None:
        """Leads with question labels as answer keys, newest first. None when the lead list could not be fetched."""
        try:
            questions = self.lead_form_questions(form_id)
        except MetaApiError:
            questions = {}
        try:
            raw_leads = self.leads(form_id)
        except MetaApiError:
            return None
        out = []
        for lead in raw_leads:
            answers = {}
            for fld in lead.get("field_data", []):
                label = questions.get(fld["name"], fld["name"])
                answers[label] = ", ".join(fld.get("values", []))
            out.append({"id": lead["id"], "created_time": lead.get("created_time"), "answers": answers, "_form_id": form_id})
        out.sort(key=lambda lead: lead.get("created_time") or "", reverse=True)
        return out

    def ad_image_urls(self, account_id: str, hashes: list[str]) -> dict[str, str]:
        """Full-size picture URLs by image hash (AdMarketer ``_resolve_full_image_urls``), best effort."""
        urls: dict[str, str] = {}
        hashes = sorted(set(hashes))
        for i in range(0, len(hashes), 20):
            try:
                data = self.client.get(f"{account_id}/adimages", {"hashes": json.dumps(hashes[i:i + 20]), "fields": "hash,url", "limit": 20})
            except MetaApiError:
                continue
            for img in data.get("data", []):
                if img.get("hash") and img.get("url"):
                    urls[img["hash"]] = img["url"]
        return urls


def _failed_targeting(exc: Exception) -> dict:
    if isinstance(exc, MetaApiError):
        msg = "Rate-limited by Meta -- refresh the dashboard in a few minutes" if exc.rate_limited else "Could not load"
        return {"locations": [msg], "interests_behaviors": msg, "targeted_pincodes": set(), "pincode_check_ok": False}
    return {"locations": ["Not available"], "interests_behaviors": "Not available", "targeted_pincodes": set(), "pincode_check_ok": False}


def process_campaign(fetcher: AdsFetcher, account: dict, campaign: dict) -> dict | None:
    """Ads + insights + breakdowns + targeting for one campaign. None for shells / old dead test campaigns."""
    try:
        ads = fetcher.list_ads_for_campaign(campaign["id"])
    except MetaApiError:
        ads = []
    if not ads:
        return None
    ad = ads[0]
    lead_form_id = extract_lead_form_id(ad)
    cid = campaign["id"]

    with ThreadPoolExecutor(max_workers=5) as pool:
        base_f = pool.submit(fetcher.base_insights, cid)
        age_gender_f = pool.submit(fetcher.breakdown_insights, cid, ["age", "gender"])
        platform_f = pool.submit(fetcher.breakdown_insights, cid, ["publisher_platform", "platform_position"])
        region_f = pool.submit(fetcher.breakdown_insights, cid, ["region"])
        adset_f = pool.submit(fetcher.get_adset, cid)

        def result_or(future, default):
            try:
                return future.result()
            except Exception:  # noqa: BLE001 — AdMarketer: any failed read just leaves that part empty
                return default

        base = result_or(base_f, {}) or {}
        age_gender = result_or(age_gender_f, [])
        platform = result_or(platform_f, [])
        region = result_or(region_f, [])
        optimization = None
        try:
            adset = adset_f.result()
            targeting_summary = summarize_targeting(adset.get("targeting", {}) or {})
            if adset:
                optimization = optimization_from_adset(adset)
        except Exception as exc:  # noqa: BLE001
            targeting_summary = _failed_targeting(exc)

    actions = extract_actions(base.get("actions"))
    campaign_lead_count = actions.get("leads", 0)
    impressions = int(float(base.get("impressions", 0)))
    created_time = campaign.get("created_time") or ""
    first_impression_date = base.get("date_start") if impressions > 0 else None
    first_impression_hour = None
    if first_impression_date:
        try:
            first_impression_hour = fetcher.first_impression_hour(cid, first_impression_date)
        except Exception:  # noqa: BLE001
            first_impression_hour = None

    if impressions == 0 and created_time[:4] < "2025":
        return None

    return {
        "account_name": account.get("name"),
        "account_id": account["id"],
        "campaign_id": cid,
        "campaign_name": campaign.get("name"),
        "status": display_status(campaign),
        "objective": campaign.get("objective"),
        "created_time": created_time,
        "first_impression_date": first_impression_date,
        "first_impression_hour": first_impression_hour,
        "ad_id": ad["id"],
        "ad_name": ad.get("name"),
        "thumbnail_url": (ad.get("creative") or {}).get("thumbnail_url"),
        "creative": extract_creative(ad.get("creative")),
        "metrics": {
            "impressions": impressions,
            "reach": int(float(base.get("reach", 0))),
            "clicks": int(float(base.get("clicks", 0))),
            "ctr": round(float(base.get("ctr", 0)), 2),
            "cpc": round(float(base.get("cpc", 0)), 2),
            "cpm": round(float(base.get("cpm", 0)), 2),
            "spend": round(float(base.get("spend", 0)), 2),
            "link_clicks": actions.get("link_clicks", int(float(base.get("inline_link_clicks", 0) or 0))),
            "landing_page_views": actions.get("landing_page_views", 0),
            "leads": campaign_lead_count if lead_form_id else actions.get("leads", 0),
        },
        "breakdowns": {"age_gender": age_gender, "platform": platform, "region": region},
        "targeting_summary": targeting_summary,
        "leads_data": [],
        "_lead_form_id": lead_form_id,
        "_campaign_lead_count": campaign_lead_count,
        "_optimization": optimization,
    }


def assign_leads_across_shared_forms(fetcher: AdsFetcher, results: list[dict]) -> tuple[set[str], dict[str, set[str]]]:
    """Fetch each shared form's leads once and assign them across the campaigns using it. Returns the forms whose
    lead list could not be fetched, and the lead ids each fetched form returned."""
    by_form: dict[str, list[dict]] = {}
    for r in results:
        form_id = r.get("_lead_form_id")
        if form_id and r.get("_campaign_lead_count", 0) > 0:
            by_form.setdefault(form_id, []).append(r)
    failed: set[str] = set()
    seen: dict[str, set[str]] = {}
    for form_id, campaigns in by_form.items():
        raw_leads = fetcher.readable_leads(form_id)
        if raw_leads is None:
            failed.add(form_id)
            continue
        seen[form_id] = {str(lead["id"]) for lead in raw_leads}
        assign_leads(campaigns, raw_leads)
    return failed, seen


def get_all_real_ads(client: MetaAdsClient, *, targeting_db: dict[str, dict], markers: Markers,
                     account_ids: list[str] | None = None) -> PullResult:
    """One newest-first record per campaign that actually delivered. ``targeting_db`` is the durable per-campaign
    targeting record (copied; the updated copy is returned in the result)."""
    fetcher = AdsFetcher(client)
    db = {k: dict(v) for k, v in targeting_db.items()}
    try:
        accounts = fetcher.list_ad_accounts()
    except MetaApiError as exc:
        return PullResult(error=TOKEN_EXPIRED if exc.token_expired else (clean_error(exc) or "Meta API error"), targeting_db=db)
    if account_ids:
        wanted = set(account_ids)
        accounts = [a for a in accounts if a.get("id") in wanted]

    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        campaigns_by_account: dict[str, tuple[dict, list[dict]]] = {}
        futures = {pool.submit(fetcher.list_campaigns, a["id"]): a for a in accounts}
        for future in as_completed(futures):
            account = futures[future]
            try:
                campaigns_by_account[account["id"]] = (account, future.result())
            except MetaApiError:
                continue
        jobs = [(account, campaign) for account, campaigns in campaigns_by_account.values() for campaign in campaigns]
        cfutures = [pool.submit(process_campaign, fetcher, account, campaign) for account, campaign in jobs]
        for future in as_completed(cfutures):
            try:
                row = future.result()
            except Exception:  # noqa: BLE001
                row = None
            if row is not None:
                results.append(row)

    restore_targeting_from_db(results, db)
    failed_forms, form_lead_ids = assign_leads_across_shared_forms(fetcher, results)
    changed = update_ad_pincode_db(results, db)
    remark_qualified_with_ad_pincode_db(results, db, markers)

    optimization: dict[str, dict] = {}
    for r in results:
        opt = r.pop("_optimization", None)
        if opt is not None:
            optimization[r["campaign_id"]] = opt
        r.pop("_campaign_lead_count", None)
        # ``_lead_form_id`` is kept (as ``lead_form_id``) for persistence.
        r["lead_form_id"] = r.pop("_lead_form_id", None)

    results.sort(key=lambda r: r.get("created_time") or "", reverse=True)
    return PullResult(error=None, ads=results, failed_forms=failed_forms, optimization=optimization, targeting_db=db,
                      targeting_changed=changed, form_lead_ids=form_lead_ids)
