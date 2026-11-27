"""Ads reports: Performance / Experiments / Overview builders over hand-built AdMarketer ad records.

All data here is synthetic (no real names, phones or ids). Records follow AdMarketer's DATA_DICTIONARY
"An ad record" / "A lead" / "A website signup" shapes. No database needed.
"""

from __future__ import annotations

import copy

import pytest

from app.services.ads.reports import experiments, overview, performance

HARYANA_PINS = [f"1250{i:02d}" for i in range(1, 11)]          # 10 pins → "1-15 pincodes"
PUNJAB_PINS = [f"1410{i:02d}" for i in range(1, 51)]           # 50 pins → "46+ pincodes"
UP_PIN = "244901"


# Inputs per status, following QUALIFICATION_RULES.md (2026-11-18): (education_ok, can_invest, esaf_response).
# ESAF needs 12th pass but no investment and no pincode match (UPDATE 2026-11-18).
_STATUS_INPUTS = {
    "sbi_strong": (True, True, None),
    "esaf_strong": (True, False, "yes"),
    "esaf_pitch": (True, False, None),
    "needs_info": (None, True, None),
    "not_qualified": (False, True, None),  # below 12th: neither SBI nor ESAF
}


def _lead(n: int, pin: str, *, matched: bool, status: str) -> dict:
    education_ok, can_invest, esaf = _STATUS_INPUTS[status]
    if status == "needs_info" and not matched:
        raise ValueError("an out-of-area lead is never needs_info")
    return {
        "id": f"lead-{n}",
        "created_time": f"2026-09-{1 + n % 28:02d}T10:00:00+0000",
        "answers": {"full_name": f"Test Person {n}", "phone_number": f"+91000000{n:04d}", "pincode": pin,
                    "franchise background": "no"},  # shown only, no longer part of qualification
        "submitted_pincode": pin,
        "pincode_qualified": matched,
        "education_level": {True: "12th", False: "10th", None: None}[education_ok],
        "education_ok": education_ok,
        "can_invest": can_invest,
        "esaf_response": esaf,
        "passes_screening_questions": bool(can_invest and education_ok),
        "qualification_status": status,
        "qualified": status in ("sbi_strong", "esaf_strong"),
    }


def _statuses(spec):
    out = []
    for status, count in spec:
        out += [status] * count
    return out


def _actions(leads=0, link_clicks=0, lpv=0):
    out = []
    if leads:
        out += [{"action_type": "lead", "value": str(leads)}, {"action_type": "onsite_conversion.lead_grouped", "value": str(leads)}]
    if link_clicks:
        out.append({"action_type": "link_click", "value": str(link_clicks)})
    if lpv:
        out.append({"action_type": "landing_page_view", "value": str(lpv)})
    return out


def _ad(ad_id, *, campaign_id, account, objective, spend, impressions, reach, link_clicks, lpv, leads, pins, setup, interests,
        leads_data, age_gender=(), platform=(), region=(), status="ACTIVE", created="2026-09-01T08:00:00+0530"):
    return {
        "account_name": account, "account_id": "act_000", "campaign_id": campaign_id, "campaign_name": f"Campaign {campaign_id}",
        "status": status, "objective": objective, "created_time": created, "first_impression_date": created[:10],
        "first_impression_hour": "08", "ad_id": ad_id, "ad_name": f"Ad {ad_id}", "thumbnail_url": None,
        "creative": {"type": "image"},
        "metrics": {"impressions": impressions, "reach": reach, "clicks": link_clicks + 10, "ctr": round(100 * link_clicks / impressions, 2) if impressions else 0,
                    "cpc": 0, "cpm": 0, "spend": spend, "link_clicks": link_clicks, "landing_page_views": lpv, "leads": leads},
        "breakdowns": {"age_gender": list(age_gender), "platform": list(platform), "region": list(region)},
        "targeting_summary": {"locations": [f"{len(pins)} pincode(s)"] if pins else ["India (country-wide)"], "interests_behaviors": interests,
                              "targeted_pincodes": set(pins), "pincode_check_ok": bool(pins), "restored_from_db": False, "setup": setup},
        "leads_data": leads_data,
    }


def make_ads() -> list[dict]:
    # A1: narrow Haryana list, Facebook only, Advantage+ audience. 40 leads, 12 in-target.
    # In-target: 3 SBI strong, 3 check details, 6 pitch ESAF. Out of area: 4 ESAF strong, 4 not qualified, 20 pitch ESAF.
    a1_in = _statuses([("sbi_strong", 3), ("needs_info", 3), ("esaf_pitch", 6)])
    a1_out = _statuses([("esaf_strong", 4), ("not_qualified", 4), ("esaf_pitch", 20)])
    a1_leads = ([_lead(i, HARYANA_PINS[i % 10], matched=True, status=st) for i, st in enumerate(a1_in)]
                + [_lead(100 + i, UP_PIN, matched=False, status=st) for i, st in enumerate(a1_out)])
    a1 = _ad("9001", campaign_id="c-1", account="Test Account A", objective="LEAD_GENERATION", spend=1200.0, impressions=40000, reach=30000,
             link_clicks=800, lpv=0, leads=40, pins=HARYANA_PINS,
             setup={"age_min": 18, "age_max": 65, "age_range": [21, 55], "genders": [], "publisher_platforms": ["facebook"], "advantage_audience": True,
                    "categories": {}},
             interests="Advantage+ Audience only (Meta finds the audience)", leads_data=a1_leads,
             age_gender=[{"age": "25-34", "gender": "male", "spend": "700", "impressions": "20000", "actions": _actions(leads=25, link_clicks=400)},
                         {"age": "35-44", "gender": "female", "spend": "500", "impressions": "20000", "actions": _actions(leads=15, link_clicks=400)}],
             platform=[{"publisher_platform": "facebook", "platform_position": "feed", "spend": "1200", "impressions": "40000",
                        "actions": _actions(leads=40, link_clicks=800)}],
             region=[{"region": "Haryana", "spend": "900", "impressions": "30000", "clicks": "600"},
                     {"region": "Uttar Pradesh", "spend": "300", "impressions": "10000", "clicks": "200"}])
    # A2: broad Punjab list, women only with Advantage+ on (80% of spend reached men). 100 leads, 5 in-target.
    # In-target: 1 SBI strong, 4 check details. Out of area: 2 ESAF strong, 93 pitch ESAF.
    a2_in = _statuses([("sbi_strong", 1), ("needs_info", 4)])
    a2_out = _statuses([("esaf_strong", 2), ("esaf_pitch", 93)])
    a2_leads = ([_lead(200 + i, PUNJAB_PINS[i], matched=True, status=st) for i, st in enumerate(a2_in)]
                + [_lead(300 + i, UP_PIN, matched=False, status=st) for i, st in enumerate(a2_out)])
    a2 = _ad("9002", campaign_id="c-2", account="Test Account B", objective="OUTCOME_LEADS", spend=2000.0, impressions=80000, reach=60000,
             link_clicks=1200, lpv=0, leads=100, pins=PUNJAB_PINS,
             setup={"age_min": 18, "age_max": 65, "genders": [2], "publisher_platforms": [], "advantage_audience": True,
                    "categories": {"Interests": ["Personal finance"], "Behaviors": ["Small business owners"]}},
             interests="Interests: Personal finance; Behaviors: Small business owners", leads_data=a2_leads,
             age_gender=[{"age": "25-34", "gender": "male", "spend": "1600", "impressions": "60000", "actions": _actions(leads=80, link_clicks=900)},
                         {"age": "25-34", "gender": "female", "spend": "400", "impressions": "20000", "actions": _actions(leads=20, link_clicks=300)}],
             platform=[{"publisher_platform": "facebook", "platform_position": "feed", "spend": "1500", "impressions": "60000",
                        "actions": _actions(leads=80, link_clicks=900)},
                       {"publisher_platform": "instagram", "platform_position": "instagram_stories", "spend": "500", "impressions": "20000",
                        "actions": _actions(leads=20, link_clicks=300)}],
             region=[{"region": "Punjab region", "spend": "1200", "impressions": "50000", "clicks": "700"},
                     {"region": "Uttar Pradesh", "spend": "800", "impressions": "30000", "clicks": "500"}],
             created="2026-09-10T08:00:00+0530")
    # W1: website ad; Audience Network takes 40% of spend.
    w1 = _ad("9003", campaign_id="w-1", account="Test Account A", objective="OUTCOME_TRAFFIC", spend=3000.0, impressions=60000, reach=50000,
             link_clicks=900, lpv=400, leads=0, pins=[],
             setup={"age_min": 18, "age_max": 65, "genders": [], "publisher_platforms": ["facebook", "audience_network"], "advantage_audience": True,
                    "categories": {}},
             interests="Advantage+ Audience only (Meta finds the audience)", leads_data=[],
             platform=[{"publisher_platform": "facebook", "platform_position": "feed", "spend": "1800", "impressions": "30000",
                        "actions": _actions(link_clicks=500, lpv=250)},
                       {"publisher_platform": "audience_network", "platform_position": "an_classic", "spend": "1200", "impressions": "30000",
                        "actions": _actions(link_clicks=400, lpv=150)}],
             region=[{"region": "Haryana", "spend": "3000", "impressions": "60000", "clicks": "900"}],
             created="2026-09-05T08:00:00+0530")
    # Z: never spent — excluded from Performance.
    z = _ad("9004", campaign_id="c-9", account="Test Account B", objective="LEAD_GENERATION", spend=0, impressions=0, reach=0,
            link_clicks=0, lpv=0, leads=0, pins=["125001"], setup={}, interests="Not available", leads_data=[], status="PAUSED")
    return [a1, a2, w1, z]


def make_signups() -> list[dict]:
    def su(i, tier, campaign="", verdict="", source="fb"):
        return {"id": str(500 + i), "mobile": f"900000{i:04d}", "name": f"Signup Person {i}", "submitted_at": f"2026-09-{10 + i:02d}T09:00:00",
                "qualification_verdict": verdict, "shop_address": f"Shop {i}, Test Village", "attribution_tier": tier,
                "matched_campaign_id": campaign or None, "matched_campaign_name": None, "utm_source": source, "utm_medium": "paid",
                "utm_campaign": campaign}
    return [su(1, "campaign_matched", "w-1", "STRONG_QUALIFY"), su(2, "campaign_matched", "w-1", "STRONG_QUALIFY"),
            su(3, "campaign_matched", "w-1", "NOT_QUALIFY"), su(4, "campaign_matched", "w-1"),
            su(5, "fbclid_only", verdict="STRONG_QUALIFY"), su(6, "none", source="", verdict="NOT_QUALIFY")]


def make_creatives() -> dict:
    return {
        "9001": {"type": "image", "primary_text": "Kiosk Operator बनें। निवेश: ₹5,00,000", "headline": "Kiosk Operator बनें", "cta": "SIGN_UP",
                 "image_hash": "hash-a", "image_file": "9001.jpg"},
        "9002": {"type": "carousel", "primary_text": "Earn commission every month with an SBI kiosk", "headline": "Bank Sakhi", "cta": "LEARN_MORE",
                 "image_hash": "hash-b", "image_file": ""},
    }


ALL_STATUS = {"sbi_strong": 4, "esaf_strong": 6, "esaf_pitch": 119, "needs_info": 7, "not_qualified": 4}


def w1_status_zero(row):
    return row["status_counts"] == {"sbi_strong": 0, "esaf_strong": 0, "esaf_pitch": 0, "needs_info": 0, "not_qualified": 0}


# ------------------------------------------------------------------------------------------- helpers
def test_status_of_records_without_a_status():
    assert performance.lead_status({"qualified": True}) == "sbi_strong"
    assert performance.lead_status({"qualified": False}) == "needs_info"
    assert performance.lead_status({"qualification_status": "esaf_pitch", "qualified": False}) == "esaf_pitch"
    assert performance.status_counts([{"qualification_status": "not_qualified"}, {}])["not_qualified"] == 1


def test_state_for_pincode_and_settings_helpers():
    assert performance.state_for_pincode("125001") == "Haryana"
    assert performance.state_for_pincode("141001") == "Punjab"
    assert performance.state_for_pincode("244901") == "Uttar Pradesh"
    assert performance.state_for_pincode("999999") == "Other"
    assert performance.state_for_pincode("12A") is None
    assert performance.gender_setting({"genders": [2], "advantage_audience": True}) == "Women only (suggestion only, Advantage+ on)"
    assert performance.gender_setting({"genders": []}) == "All genders"
    assert performance.age_setting({"age_range": [21, 55], "age_min": 18, "age_max": 65}) == "21-55"
    assert performance.age_setting_note({"age_range": [21, 55], "age_min": 18, "age_max": 65, "advantage_audience": True}) == "Meta may widen to 18-65"
    assert performance.placement_setting({"publisher_platforms": []}) == "Automatic (Advantage+ placements)"
    assert performance.geography_bucket(0, ["India (country-wide)"]) == "Whole country"
    assert performance.audience_type("Rate-limited by Meta") == "Unknown"
    # Meta reports the same lead under two action types: take the max, never the sum.
    assert performance._action_value(_actions(leads=7), performance._LEAD_ACTIONS) == 7


# ------------------------------------------------------------------------------------------- performance
def test_performance_rows_channels_and_quality():
    r = performance.build(make_ads(), make_signups())
    by_id = {row["ad_id"]: row for row in r["rows"]}
    assert set(by_id) == {"9001", "9002", "9003"}  # zero spend excluded
    a1, a2, w1 = by_id["9001"], by_id["9002"], by_id["9003"]
    assert (a1["channel"], a2["channel"], w1["channel"]) == ("Lead Form", "Lead Form", "Website")  # OUTCOME_LEADS is a lead form
    assert (a1["results"], a1["quality"], a1["fully_qualified"], a1["cost_per_quality"]) == (40, 12, 7, 100.0)
    assert a1["status_counts"] == {"sbi_strong": 3, "esaf_strong": 4, "esaf_pitch": 26, "needs_info": 3, "not_qualified": 4}
    assert w1_status_zero(by_id["9003"])
    assert (a2["results"], a2["quality"], a2["cost_per_quality"]) == (100, 5, 400.0)
    # Website result = signups whose utm_campaign names the campaign; quality = STRONG_QUALIFY.
    assert (w1["results"], w1["quality"], w1["cost_per_lpv"]) == (4, 2, 7.5)
    assert a2["gender_setting"].startswith("Women only") and a2["delivered_gender"] == "actually reached 80% men, 20% women"
    assert a1["age_setting"] == "21-55" and a1["geo_bucket"] == "1-15 pincodes" and a2["geo_bucket"] == "46+ pincodes"
    assert a1["target_states"] == ["Haryana"] and a1["n_pincodes"] == 10
    assert a2["interest_items"] == ["Interests: Personal finance", "Behaviors: Small business owners"]
    # Sorted by cost per quality result.
    assert [row["ad_id"] for row in r["rows"]] == ["9001", "9002", "9003"]
    assert r["channels"]["Lead Form"]["results"] == 140 and r["channels"]["Website"]["results"] == 4
    assert r["channels"]["Lead Form"]["status_counts"] == ALL_STATUS and r["channels"]["Lead Form"]["fully_qualified"] == 10
    geo = {g["group"]: g for g in r["by_geo"] if g["channel"] == "Lead Form"}
    assert geo["46+ pincodes"]["status_counts"] == {"sbi_strong": 1, "esaf_strong": 2, "esaf_pitch": 93, "needs_info": 4, "not_qualified": 0}
    assert r["status_labels"]["esaf_pitch"] == "Pitch ESAF"
    assert r["unattributed_signups"] == 2 and r["total_signups"] == 6


def test_performance_awards_respect_volume_thresholds():
    r = performance.build(make_ads(), make_signups())
    aw = r["awards"]
    assert aw["best_overall"]["ad_id"] == "9001"            # ₹100 per quality lead vs ₹400
    assert aw["cheapest_result"]["ad_id"] == "9002"         # ₹20 per lead vs ₹30 (W1 has only 4 results: below the 10 floor)
    assert aw["most_results"]["ad_id"] == "9002"
    assert aw["most_quality"]["ad_id"] == "9001"
    assert aw["cheapest_lpv"]["ad_id"] == "9003"
    # One lucky result never wins: drop A1/A2 lead counts under the floor and the cost awards disappear.
    ads = make_ads()
    for a in ads[:2]:
        a["metrics"]["leads"] = 3
        a["leads_data"] = a["leads_data"][:3]
    r2 = performance.build(ads, [])
    assert r2["awards"]["best_overall"] is None and r2["awards"]["cheapest_result"] is None


def test_performance_states_pincodes_delivery_and_verdicts():
    r = performance.build(make_ads(), make_signups())
    states = {s["state"]: s for s in r["states"]}
    assert set(states) == {"Haryana", "Uttar Pradesh", "Punjab"}  # " region" suffix stripped; Lead Form only
    assert states["Uttar Pradesh"]["leads"] == 123 and states["Uttar Pradesh"]["matched"] == 0
    assert states["Haryana"]["matched"] == 12 and states["Haryana"]["cost_per_lead"] == 75.0
    assert states["Haryana"]["qualified"] == 3 and states["Haryana"]["status_counts"]["needs_info"] == 3
    assert states["Uttar Pradesh"]["status_counts"] == {"sbi_strong": 0, "esaf_strong": 6, "esaf_pitch": 113, "needs_info": 0, "not_qualified": 4}
    assert r["website_states"] == [{"state": "Haryana", "spend": 3000.0, "impressions": 60000, "ctr": 1.5}]
    assert r["pincodes_targeted"] == 60
    assert {p["pincode"] for p in r["top_pincodes"]} == set(HARYANA_PINS) | set(PUNJAB_PINS[:5])
    assert len(r["dead_pincodes"]) == 45
    web_platform = {row["group"]: row for row in r["delivered"]["Website|platform"]}
    assert web_platform["Audience Network"]["share_of_spend"] == 40.0
    assert {(t["channel"], t["dimension"]) for t in performance.delivered_tables(r["delivered"])} == {
        (c, d) for c in ("Lead Form", "Website") for d in ("age", "gender", "platform", "position")}
    dims = {(v["channel"], v["dimension"]) for v in r["verdicts"]}
    assert ("Lead Form", "Number of pincodes") in dims and ("Website", "Platform") in dims
    geo = next(v for v in r["verdicts"] if v["dimension"] == "Number of pincodes")
    assert geo["winner"]["group"] == "1-15 pincodes" and geo["basis"] == "cost per quality result"


def test_performance_tolerates_partial_records_and_empty_input():
    empty = performance.build([], [])
    assert empty["rows"] == [] and empty["awards"]["best_overall"] is None and empty["channels"]["Website"]["ads"] == 0
    partial = {"ad_id": "1", "campaign_id": "c", "objective": "LEAD_GENERATION", "metrics": {"spend": "50", "leads": None}}
    r = performance.build([partial], [])
    assert r["rows"][0]["spend"] == 50.0 and r["rows"][0]["results"] == 0 and r["rows"][0]["geo_bucket"] == "Unknown"


def test_builders_do_not_mutate_input_records():
    ads = make_ads()
    before = copy.deepcopy(ads)
    performance.build(ads, make_signups())
    overview.build(ads, make_signups())
    assert ads == before


# ------------------------------------------------------------------------------------------- experiments
def _experiments(creatives=None, labels=None, opt=None):
    ads, signups = make_ads(), make_signups()
    report = performance.build(ads, signups)
    return experiments.build(report, overview.dashboard_totals(ads), opt or {}, creatives, labels)


def test_experiments_cards_tables_and_verdicts():
    out = _experiments()
    ids = [e["id"] for e in out["experiments"]]
    assert ids == ["geo", "audience", "channel", "women", "age", "placements", "accounts", "states", "budget", "screening", "tracking", "optimisation"]
    for e in out["experiments"]:
        assert e["verdict"] in experiments.VERDICTS and e["verdict_label"] == experiments.VERDICTS[e["verdict"]]
        assert e["confidence"] in ("High", "Medium", "Low") and e["confidence_why"]
        for row in e["rows"]:
            assert len(row) == len(e["columns"]), e["id"]
            assert all(c is None or isinstance(c, (str, int, float)) for c in row)
        assert all(col["kind"] in ("text", "count", "money", "percent") for col in e["columns"])
    exp = {e["id"]: e for e in out["experiments"]}
    # Women only: 80% of spend reached men → "Didn't work" with a mistake to avoid.
    assert exp["women"]["verdict"] == "didnt" and "About 80% of the money still reached men" in exp["women"]["learning"][0]
    # Pincode lists: narrow list is best on quality, broad list is cheapest → mixed.
    assert exp["geo"]["verdict"] == "mixed" and exp["geo"]["rows"][exp["geo"]["best_row"]][0] == "1-15 pincodes"
    assert exp["geo"]["rows"][0][2] == 1200.0  # money cells are numbers, not "₹1,200"
    assert "₹100" in exp["geo"]["learning"][0]  # sentences keep AdMarketer's ₹ wording
    # Screening: totals from all ads (140 leads, 17 in a targeted pincode, 10 strongly qualified) + one row per status.
    rows = exp["screening"]["rows"]
    assert rows[1][1:] == [17, 12.1] and rows[2] == ["Strongly qualified (SBI or ESAF)", 10, 7.1] and exp["screening"]["verdict"] == "problem"
    assert [r[0] for r in rows[3:]] == ["Status: Strongly qualified · SBI", "Status: Strongly qualified · ESAF", "Status: Pitch ESAF",
                                        "Status: Check details", "Status: Not qualified"]
    assert [r[1] for r in rows[3:]] == [4, 6, 119, 7, 4]
    assert "4 are strongly qualified for SBI; 10 leads in all" in exp["screening"]["learning"][0]
    assert "franchise" not in (exp["screening"]["did"] + exp["screening"]["question"] + " ".join(exp["screening"]["learning"])).lower()
    assert out["lead_status_counts"] == ALL_STATUS and out["status_labels"]["sbi_strong"] == "Strongly qualified · SBI"
    assert exp["states"]["columns"][-1]["label"] == "Strongly qualified"
    assert exp["tracking"]["rows"][0][1] == 4 and exp["tracking"]["verdict"] == "worked"
    assert exp["optimisation"]["verdict"] == "unclear" and exp["optimisation"]["rows"][0][1] == "not recorded"
    assert "Test Account A" in exp["accounts"]["did"] and "Test Account B" in exp["accounts"]["did"]
    assert {m["experiment_id"] for m in out["mistakes"]} >= {"geo", "women", "accounts", "screening", "tracking", "placements"}
    assert sum(out["verdict_counts"].values()) == 12


def test_experiments_budget_sentence_uses_numbers():
    assert experiments._budget_sentence([30.0, 20.0, 10.0]) == "Cost per lead fell as the ad's total spend rose."
    assert experiments._budget_sentence([10.0, 20.0, 30.0]) == "Cost per lead rose as the ad's total spend rose."
    assert experiments._budget_sentence([10.0, None, 30.0]) == "Not enough spend tiers to see a pattern."
    assert experiments._budget_sentence([10.0, 20.0]) == "Not enough spend tiers to see a pattern."


def test_experiments_optimisation_goal_from_ad_sets():
    out = _experiments(opt={"w-1": {"optimization_goal": "LINK_CLICKS"}, "c-1": {"optimization_goal": "LEAD_GENERATION"}})
    exp = {e["id"]: e for e in out["experiments"]}["optimisation"]
    assert exp["verdict"] == "notyet" and exp["dont_repeat"]
    assert ["Website", "LINK_CLICKS", 1, 3000.0, 4, 750.0, 2] in exp["rows"]


def test_experiments_point_in_time_text_carries_its_date():
    out = _experiments()
    assert out["competitors_as_of"] == "2026-10-19" and "19 Oct 2026" in out["competitors_as_of_note"]
    groups = {g["name"]: g for g in out["idea_groups"]}
    assert groups["Creative: from your own pictures and captions"]["as_of"] == "2026-10-19"
    assert all(i["as_of"] for i in groups["Creative: from your own pictures and captions"]["items"] if "13 of" in i["why"] or "44 ads" in i["why"])
    assert groups["Aim the money better"]["as_of"] is None  # computed from live data
    assert out["n_ideas"] == sum(len(g["items"]) for g in out["idea_groups"])
    assert all(c["url"].startswith("https://") for c in out["competitors"])


def test_experiments_creative_analysis():
    out = _experiments(creatives=make_creatives(), labels={"hash-a": {"image_type": "Real photo"}})
    cr = out["creative"]
    assert cr["pending"] is False and cr["n_ads"] == 3 and cr["n_covered"] == 2
    assert {g["ad_id"] for g in cr["groups"]} == {"9001", "9002"}
    g1 = next(g for g in cr["groups"] if g["ad_id"] == "9001")
    assert g1["has_image"] is True and g1["image_type"] == "Real photo" and g1["cta"] == "Sign Up"
    traits = {t["title"]: t for t in cr["trait_tables"]}
    # Both captions mention money, so that trait has one value per channel and no table (AdMarketer rule).
    assert "Mentions money or earnings" not in traits and "Image type (labelled)" in traits
    assert {r[1] for r in traits["Mentions the investment"]["rows"]} == {"Yes", "No"}
    assert {r[1] for r in traits["Language"]["rows"]} == {"Hindi + English", "English"}
    assert cr["verdict"] == "worked" and cr["confidence"] in ("High", "Medium", "Low")
    assert any("Creative details are saved for 2 of 3 ads" in t for t in cr["learning"])


def test_experiments_empty_and_no_creatives():
    e = experiments.empty()
    assert e["experiments"] == [] and e["creative"]["pending"] is True and e["competitors"]
    cr = _experiments()["creative"]
    assert cr["pending"] is True and cr["confidence"] == "Low" and cr["verdict_label"] == "Can't tell yet"


# ------------------------------------------------------------------------------------------- overview
def test_overview_counts_both_channels():
    o = overview.build(make_ads(), make_signups())
    assert o == {
        "has_ad_data": True,
        "form_leads": 140, "form_qualified": 10, "form_pincode_qualified": 17,
        "form_status_counts": ALL_STATUS, "status_labels": performance.STATUS_LABELS,
        "form_pincode_checkable": 140,  # leads on ads whose pincode check worked (A1 + A2; Z has none)
        "url_signups_total": 6, "url_signups_facebook": 5, "url_strong_qualify": 3, "url_not_qualify": 2,
        "overall_total": 146,
    }
    assert overview.build([], [])["overall_total"] == 0


def test_dashboard_and_signup_totals():
    t = overview.dashboard_totals(make_ads())
    assert (t["leads"], t["pincode_qualified_leads"], t["qualified_leads"], t["spend"]) == (140, 17, 10, 6200.0)
    assert t["lead_status_counts"] == ALL_STATUS
    assert (t["active_count"], t["other_count"]) == (3, 1)
    st = overview.signup_totals(make_signups(), make_ads())
    assert st == {"total_signups": 6, "campaign_matched": 4, "fbclid_only": 1, "not_facebook": 1, "strong_qualify": 3,
                  "facebook_lead_form_leads": 140, "facebook_attributed": 5}


@pytest.mark.parametrize("objective,expected", [("LEAD_GENERATION", True), ("OUTCOME_LEADS", True), ("OUTCOME_TRAFFIC", False), ("LINK_CLICKS", False)])
def test_channel_rule(objective, expected):
    assert performance.is_form({"objective": objective}) is expected
