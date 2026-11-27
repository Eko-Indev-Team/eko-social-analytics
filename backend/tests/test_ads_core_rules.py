"""Ads core — AdMarketer business rules ported unchanged (no database, no network)."""

from __future__ import annotations

from datetime import datetime, timezone

import httpx
import pytest

from app.services.ads.meta import all_ads as r
from app.services.ads.meta.client import TOKEN_EXPIRED, MetaAdsClient, MetaApiError, clean_error

from .conftest import UNREACHABLE_DB, make_settings

MARKERS = r.Markers()
INV = "Can you invest minimum ₹5,00,000? / क्या आप ₹5,00,000 निवेश कर सकते हैं?"
FR = "Do you have a franchise background?"


def lead(lead_id: str, created: str, pin: str, inv: str = "Yes", fr: str = "Yes") -> dict:
    return {"id": lead_id, "created_time": created, "answers": {"Full name": f"Test {lead_id}", "Phone number": "+910000000000",
                                                                  "Pin code/पिन कोड": pin, INV: inv, FR: fr}}


def campaign(cid: str, pins: set[str], count: int, ok: bool = True) -> dict:
    return {"campaign_id": cid, "_campaign_lead_count": count,
            "targeting_summary": {"targeted_pincodes": pins, "pincode_check_ok": ok}}


# ----------------------------------------------------------------------------- qualification
@pytest.mark.parametrize(("inv", "fr", "expected"), [
    ("Yes", "yes", True), ("हाँ", "हां", True), ("ha", "Y", True), (" YES ", "y", True),
    ("No", "Yes", False), ("Yes", "", False), ("maybe", "yes", False),
])
def test_screening_needs_both_questions_answered_yes(inv, fr, expected):
    assert r.passes_screening_questions(lead("1", "", "110001", inv, fr)["answers"], MARKERS) is expected


def test_screening_markers_are_configurable():
    answers = {"Will you put in at least 5 lakh?": "yes", FR: "yes"}
    assert not r.passes_screening_questions(answers, MARKERS)
    assert r.passes_screening_questions(answers, r.Markers(investment="at least 5 lakh", franchise="franchise background"))


def test_pincode_is_found_by_label_then_any_answer():
    assert r.extract_pincode({"Pin code/पिन कोड": "my pin is 110001"}) == "110001"
    assert r.extract_pincode({"पिन": "560001", "Phone": "9876543210"}) == "560001"
    assert r.extract_pincode({"Address": "Sector 4, 400001 Mumbai"}) == "400001"
    assert r.extract_pincode({"Phone": "9876543210"}) is None  # 10 digits is not a 6-digit PIN


def test_final_qualification_uses_the_2026_11_18_rules():
    edu = "Highest education / शिक्षा"

    def with_edu(lead_id, pin, education, inv="Yes", esaf=None):
        x = lead(lead_id, "", pin, inv)
        x["answers"][edu] = education
        if esaf is not None:
            x["answers"]["Interested in ESAF zero-investment BC?"] = esaf
        return dict(x, submitted_pincode=pin or None)

    rec = {"campaign_id": "c1", "targeting_summary": {"targeted_pincodes": {"110001"}, "pincode_check_ok": True},
           "leads_data": [with_edu("a", "110001", "Graduate"), with_edu("b", "110001", "12th", inv="No"),
                          with_edu("c", "999999", "BA", esaf="Yes"), with_edu("d", "110001", "10th"),
                          dict(lead("e", "", "110001", fr="No"), submitted_pincode="110001"), with_edu("f", "", "MA")]}
    r.remark_qualified_with_ad_pincode_db([rec], {}, MARKERS)
    got = {x["id"]: (x["qualification_status"], x["qualified"]) for x in rec["leads_data"]}
    assert got == {"a": ("sbi_strong", True), "b": ("esaf_pitch", False), "c": ("esaf_strong", True), "d": ("not_qualified", False),
                   "e": ("needs_info", False), "f": ("needs_info", False)}
    a, b, _, d, e, f = rec["leads_data"]
    assert a["passes_screening_questions"] and not b["passes_screening_questions"]  # = can_invest AND education_ok
    assert d["sbi_reasons"] == ["education_below_12th"] and e["sbi_reasons"] == ["education_unknown"]
    assert f["pincode_match"] is None and f["pincode_qualified"] is False and "pincode_unknown" in f["sbi_reasons"]
    assert e["education_answer"] is None and a["education_level"] == "Graduate" and a["can_invest"] is True
    # The franchise answer no longer matters (e answered No and is only missing education).
    with_staff = dict(with_edu("g", "999999", "BA"))
    r.qualify_lead(with_staff, {"110001"}, MARKERS, staff_esaf="no")
    assert (with_staff["qualification_status"], with_staff["esaf_response_source"]) == ("not_qualified", "staff")


def test_failed_targeting_falls_back_to_the_durable_record_for_qualification():
    rec = {"campaign_id": "c1", "targeting_summary": {"targeted_pincodes": set(), "pincode_check_ok": False},
           "leads_data": [dict(lead("a", "", "110001"), submitted_pincode="110001")]}
    r.remark_qualified_with_ad_pincode_db([rec], {"c1": {"pincodes": ["110001"]}}, MARKERS)
    assert rec["leads_data"][0]["pincode_qualified"] is True and rec["leads_data"][0]["pincode_match"] is True


# --------------------------------------------------------------------------- lead assignment
def test_shared_form_leads_go_to_the_narrowest_targeting_first_then_by_recency():
    leads = [lead("L4", "2026-09-04", "400001"), lead("L3", "2026-09-03", "999999"),
             lead("L2", "2026-09-02", "110001"), lead("L1", "2026-09-01", "560001")]
    broad = campaign("broad", {"110001", "560001", "400001"}, 2)
    narrow = campaign("narrow", {"110001"}, 1)
    r.assign_leads([broad, narrow], leads)  # input order must not matter
    assert [x["id"] for x in narrow["leads_data"]] == ["L2"]
    assert [x["id"] for x in broad["leads_data"]] == ["L4", "L1"]
    assert all(x["pincode_qualified"] for x in narrow["leads_data"] + broad["leads_data"])


def test_remaining_slots_fill_by_recency_and_a_lead_is_never_given_twice():
    leads = [lead("L3", "2026-09-03", "999999"), lead("L2", "2026-09-02", "888888"), lead("L1", "2026-09-01", "110001")]
    a = campaign("a", {"110001"}, 2)
    b = campaign("b", set(), 1)  # no usable pincode list: recency leftovers only
    r.assign_leads([b, a], leads)
    assert [x["id"] for x in a["leads_data"]] == ["L1", "L3"]
    assert [x["id"] for x in b["leads_data"]] == ["L2"]
    assert b["leads_data"][0]["pincode_qualified"] is False


def test_rate_limited_targeting_marks_pincode_as_could_not_check():
    c = campaign("a", set(), 1, ok=False)
    r.assign_leads([c], [lead("L1", "2026-09-01", "110001")])
    assert c["leads_data"][0]["pincode_qualified"] is None


# --------------------------------------------------------------------------- targeting record
def test_targeting_restore_and_durable_record_rules():
    db = {"c1": {"pincodes": ["110001", "110002"], "locations": ["2 pincode(s): 110001, 110002"],
                 "interests_behaviors": "Interests: Banking", "setup": {"age_min": 21}}}
    failed = {"campaign_id": "c1", "campaign_name": "C1", "targeting_summary": r._failed_targeting(MetaApiError("x", code=17))}
    assert failed["targeting_summary"]["locations"] == ["Rate-limited by Meta -- refresh the dashboard in a few minutes"]
    fresh = {"campaign_id": "c2", "campaign_name": "C2", "ad_name": "A2", "account_name": "Acct",
             "targeting_summary": r.summarize_targeting({"geo_locations": {"zips": [{"key": "IN:560001", "name": "560001"}]}})}
    r.restore_targeting_from_db([failed, fresh], db)
    ts = failed["targeting_summary"]
    assert ts["restored_from_db"] and ts["pincode_check_ok"] and ts["targeted_pincodes"] == {"110001", "110002"}
    assert ts["interests_behaviors"] == "Interests: Banking"
    before = dict(db["c1"])
    changed = r.update_ad_pincode_db([failed, fresh], db)
    assert changed == {"c2"} and db["c1"] == before  # a restored copy never rewrites the record
    assert db["c2"]["pincodes"] == ["560001"]
    assert r.update_ad_pincode_db([fresh], db) == set()  # unchanged → no write


def test_summarize_targeting_reads_every_detailed_category_and_advantage():
    t = r.summarize_targeting({
        "geo_locations": {"zips": [{"key": "IN:110001"}], "regions": [{"name": "Punjab"}], "custom_locations": [{}, {}]},
        "flexible_spec": [{"work_positions": [{"id": "1", "name": "Bank teller"}], "interests": [{"id": "2", "name": "Banking"}]}],
        "targeting_automation": {"advantage_audience": 1}, "age_min": 21, "age_max": 45, "genders": [2],
        "publisher_platforms": ["facebook", "instagram"],
    })
    assert t["targeted_pincodes"] == {"110001"}
    assert t["locations"] == ["1 pincode(s): 110001", "2 custom radius point(s)", "Punjab (state-level)"]
    assert t["interests_behaviors"].startswith("Job title: Bank teller; Interests: Banking (Advantage+ Audience also on")
    assert t["setup"]["advantage_audience"] is True and t["setup"]["genders"] == [2]


# ------------------------------------------------------------------------------------ misc
def test_lead_actions_are_deduplicated_not_summed():
    acts = [{"action_type": "lead", "value": "3"}, {"action_type": "onsite_conversion.lead_grouped", "value": "3"},
            {"action_type": "link_click", "value": "5"}, {"action_type": "link_click", "value": "2"}]
    assert r.extract_actions(acts) == {"leads": 3, "link_clicks": 7}


def test_active_past_stop_time_is_completed():
    now = datetime(2026, 10, 1, tzinfo=timezone.utc)
    assert r.display_status({"effective_status": "ACTIVE", "stop_time": "2026-09-20T10:00:00+0530"}, now) == "COMPLETED"
    assert r.display_status({"effective_status": "ACTIVE", "stop_time": "2026-10-20T10:00:00+0530"}, now) == "ACTIVE"
    assert r.display_status({"effective_status": "PAUSED"}, now) == "PAUSED"


def test_creative_extraction_and_lead_form_id():
    ad = {"creative": {"thumbnail_url": "https://t/x.jpg", "object_story_spec": {"link_data": {
        "message": "Body", "name": "Head", "image_hash": "h1", "call_to_action": {"type": "SIGN_UP", "value": {"lead_gen_form_id": "F1"}}}}}}
    c = r.extract_creative(ad["creative"])
    assert (c["type"], c["primary_text"], c["headline"], c["cta"], c["image_hash"]) == ("image", "Body", "Head", "SIGN_UP", "h1")
    assert r.extract_lead_form_id(ad) == "F1"
    assert r.channel_for("OUTCOME_LEADS") == "lead_form" and r.channel_for("LINK_CLICKS") == "website" and r.channel_for("REACH") == "other"


def test_clean_error_redacts_tokens_and_flags_expiry():
    assert clean_error("400 for url https://graph.facebook.com/v26.0/me?access_token=EAABsecret123&x=1") == \
        "400 for url https://graph.facebook.com/v26.0/me?access_token=REDACTED&x=1"
    assert clean_error("Error validating access token: Session has expired on Monday") == TOKEN_EXPIRED
    assert "EAAB" not in clean_error("token EAABxxxxxxxxxxxxxxxxxxxxxxxxxx leaked")


def test_client_retries_code_17_after_4_and_8_seconds_and_redacts():
    calls, sleeps = [], []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.params.get("access_token"))
        if len(calls) < 3:
            return httpx.Response(400, json={"error": {"code": 17, "message": "User request limit reached"}})
        return httpx.Response(200, json={"data": [{"id": "act_1"}]})

    settings = make_settings(UNREACHABLE_DB, meta_ads_access_token="EAABtesttokenvalue")
    with MetaAdsClient(settings, transport=httpx.MockTransport(handler), sleep=sleeps.append) as client:
        assert client.get("me/adaccounts")["data"] == [{"id": "act_1"}]
    assert sleeps == [4, 8] and len(calls) == 3

    def expired(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": {"code": 190, "message": f"Bad token {request.url}"}})

    with MetaAdsClient(settings, transport=httpx.MockTransport(expired), sleep=sleeps.append) as client:
        with pytest.raises(MetaApiError) as info:
            client.get("me/adaccounts")
    assert info.value.token_expired and "EAABtesttokenvalue" not in str(info.value)
