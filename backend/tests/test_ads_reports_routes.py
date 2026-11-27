"""Ads reports HTTP routes: shapes (camelCase), empty/not-configured behaviour, PII masking by role, tenancy.

Ad records, leads and signups are written into Postgres through the core models (synthetic data from
``test_ads_reports_builders``), so the routes run through the real ``records`` loaders.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy.orm import Session

from .conftest import DEV_WORKSPACE, api
from .test_ads_reports_builders import make_ads, make_creatives, make_signups

pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")

PATHS = ["/ads/performance", "/ads/experiments", "/ads/signups", "/ads/overview"]


def seed_ads(connection, workspace_id: str = DEV_WORKSPACE) -> None:
    from app.models import AdsCreative, AdsCreativeImage, AdsCreativeLabel, AdsLead, AdsMetaAd, AdsOptimization, AdsWebsiteSignup

    now = datetime.now(timezone.utc)
    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:
        for a in make_ads():
            ts = dict(a["targeting_summary"])
            ts["targeted_pincodes"] = sorted(ts["targeted_pincodes"])
            s.add(AdsMetaAd(workspace_id=workspace_id, ad_id=a["ad_id"], account_id=a["account_id"], account_name=a["account_name"],
                            campaign_id=a["campaign_id"], campaign_name=a["campaign_name"], status=a["status"], objective=a["objective"],
                            channel="lead_form" if a["objective"] in ("LEAD_GENERATION", "OUTCOME_LEADS") else "website",
                            created_time=a["created_time"], ad_name=a["ad_name"], creative=a["creative"], metrics=a["metrics"],
                            breakdowns=a["breakdowns"], targeting=ts, last_seen_at=now))
            for lead in a["leads_data"]:
                s.add(AdsLead(workspace_id=workspace_id, meta_lead_id=lead["id"], ad_id=a["ad_id"], created_time=lead["created_time"],
                              answers=lead["answers"], name=lead["answers"]["full_name"], phone=lead["answers"]["phone_number"],
                              submitted_pincode=lead["submitted_pincode"], pincode_qualified=lead["pincode_qualified"],
                              passes_screening=lead["passes_screening_questions"], qualified=lead["qualified"],
                              pincode_match=lead["pincode_qualified"], education_level=lead["education_level"], education_ok=lead["education_ok"],
                              can_invest=lead["can_invest"], esaf_response=lead["esaf_response"],
                              qualification_status=lead["qualification_status"]))
        for su in make_signups():
            s.add(AdsWebsiteSignup(workspace_id=workspace_id, signup_id=su["id"], mobile=su["mobile"], name=su["name"], submitted_at=su["submitted_at"],
                                   qualification_verdict=su["qualification_verdict"], shop_address=su["shop_address"],
                                   attribution_tier=su["attribution_tier"], matched_campaign_id=su["matched_campaign_id"],
                                   utm_source=su["utm_source"], utm_medium=su["utm_medium"], utm_campaign=su["utm_campaign"]))
        for ad_id, c in make_creatives().items():
            s.add(AdsCreative(workspace_id=workspace_id, ad_id=ad_id, type=c["type"], primary_text=c["primary_text"], headline=c["headline"],
                              cta=c["cta"], image_hash=c["image_hash"]))
        s.add(AdsCreativeImage(workspace_id=workspace_id, ad_id="9001", content_type="image/jpeg", byte_size=3, is_full=True, data=b"abc"))
        s.add(AdsCreativeLabel(workspace_id=workspace_id, image_hash="hash-a", image_type="Real photo"))
        s.add(AdsOptimization(workspace_id=workspace_id, campaign_id="w-1", optimization_goal="LINK_CLICKS"))
        s.commit()


# ----------------------------------------------------------------------------------------- empty
@pytest.mark.parametrize("path", PATHS)
def test_reports_require_a_session(anon_client, path):
    assert anon_client.get(api(path)).status_code == 401


def test_empty_workspace_reports_are_empty_not_invented(empty_client):
    perf = empty_client.get(api("/ads/performance")).json()
    assert perf["configured"] is False and perf["hasData"] is False and perf["rows"] == []
    assert perf["awards"]["bestOverall"] is None and len(perf["delivered"]) == 8
    exp = empty_client.get(api("/ads/experiments")).json()
    assert exp["experiments"] == [] and exp["creative"]["pending"] is True and exp["competitorsAsOf"] == "2026-10-19"
    sig = empty_client.get(api("/ads/signups")).json()
    assert sig["signupsConfigured"] is False and sig["signups"] == [] and sig["totals"]["totalSignups"] == 0
    ov = empty_client.get(api("/ads/overview")).json()
    assert ov["hasAdData"] is False and ov["overallTotal"] == 0


# ----------------------------------------------------------------------------------------- with data
def test_performance_payload(client, connection):
    seed_ads(connection)
    body = client.get(api("/ads/performance")).json()
    assert body["hasData"] is True
    assert [r["adId"] for r in body["rows"]] == ["9001", "9002", "9003"]
    row = body["rows"][0]
    assert row["costPerQuality"] == 100 and row["channel"] == "Lead Form" and row["targetStates"] == ["Haryana"]
    assert body["awards"]["bestOverall"]["adId"] == "9001" and body["awards"]["cheapestLpv"]["adId"] == "9003"
    assert body["channels"]["leadForm"]["results"] == 140 and body["channels"]["website"]["results"] == 4
    assert {t["dimension"] for t in body["delivered"]} == {"age", "gender", "platform", "position"}
    assert body["thresholds"] == {"minResultsForCostAward": 10, "minQualityForBestOverall": 3, "minImpressionsForCtrAward": 5000, "minLpvForLpvAward": 100}
    assert body["verdicts"] and {"winner", "worst", "basis", "compared", "delivery"} <= set(body["verdicts"][0])
    assert body["byInterest"][0]["bundleSize"] >= 1
    assert set(row["statusCounts"]) == {"sbiStrong", "esafStrong", "esafPitch", "needsInfo", "notQualified"}
    assert sum(body["channels"]["leadForm"]["statusCounts"].values()) == 140 and body["channels"]["leadForm"]["fullyQualified"] == 10
    assert body["statusLabels"]["sbiStrong"] == "Strongly qualified · SBI"


def test_experiments_payload(client, connection):
    seed_ads(connection)
    body = client.get(api("/ads/experiments")).json()
    assert len(body["experiments"]) == 12 and body["nIdeas"] > 20
    women = next(e for e in body["experiments"] if e["id"] == "women")
    assert women["verdict"] == "didnt" and women["verdictLabel"] == "Didn't work" and women["confidence"] in ("High", "Medium")
    assert women["columns"][2] == {"label": "Spend", "kind": "money"} and women["rows"][0][2] == 2000
    opt = next(e for e in body["experiments"] if e["id"] == "optimisation")
    assert opt["verdict"] == "notyet"
    cr = body["creative"]
    assert cr["pending"] is False
    g = next(g for g in cr["groups"] if g["adId"] == "9001")
    assert g["imageUrl"] == "/api/v1/ads/9001/image" and g["imageType"] == "Real photo"
    assert next(g for g in cr["groups"] if g["adId"] == "9002")["imageUrl"] is None
    assert body["mistakes"][0].keys() == {"fromExperiment", "experimentId", "text"}


def test_overview_payload_has_no_pii(client, connection):
    seed_ads(connection)
    body = client.get(api("/ads/overview")).json()
    assert body["formLeads"] == 140 and body["formPincodeQualified"] == 17 and body["urlSignupsTotal"] == 6 and body["overallTotal"] == 146
    sc = body["formStatusCounts"]
    assert set(sc) == {"sbiStrong", "esafStrong", "esafPitch", "needsInfo", "notQualified"} and sum(sc.values()) == 140
    assert body["formQualified"] == 10 == sc["sbiStrong"] + sc["esafStrong"]  # strongly qualified = SBI strong + ESAF strong
    assert body["statusLabels"]["needsInfo"] == "Check details"
    text = str(body)
    assert "Signup Person" not in text and "Test Person" not in text


def test_signups_unmasked_for_ads_leads_roles(client_as, connection):
    seed_ads(connection)
    for member in ("usr-mansi", "usr-rahul", "usr-ananya"):  # Owner, Admin, Editor
        body = client_as(member).get(api("/ads/signups")).json()
        assert body["piiVisible"] is True
        s1 = next(s for s in body["signups"] if s["id"] == "501")
        assert s1["name"] == "Signup Person 1" and s1["mobile"] == "9000000001" and s1["shopAddress"] == "Shop 1, Test Village"
        assert s1["matchedCampaignName"] == "Campaign w-1"  # filled from the stored ads


def test_signups_masked_for_viewer(viewer_client, connection):
    seed_ads(connection)
    body = viewer_client.get(api("/ads/signups")).json()
    assert body["piiVisible"] is False and len(body["signups"]) == 6
    for s in body["signups"]:
        assert s["name"] is None and s["shopAddress"] is None
        assert s["mobile"].startswith("•••••• ") and len(s["mobile"]) == len("•••••• ") + 4
    assert "Signup Person" not in str(body) and "9000000001" not in str(body)
    # Counts are not PII: viewers still see them.
    assert body["totals"] == {"totalSignups": 6, "campaignMatched": 4, "fbclidOnly": 1, "notFacebook": 1, "facebookAttributed": 5,
                              "strongQualify": 3, "facebookLeadFormLeads": 140}
    # Reports never carry lead/signup PII for anyone.
    for path in ("/ads/performance", "/ads/experiments", "/ads/overview"):
        text = viewer_client.get(api(path)).text
        assert "Test Person" not in text and "Signup Person" not in text and "+91000000" not in text


def test_signups_filters(client, connection):
    seed_ads(connection)
    body = client.get(api("/ads/signups?tier=campaign_matched")).json()
    assert body["tier"] == "campaign_matched" and len(body["signups"]) == 4 and body["totals"]["totalSignups"] == 6
    body = client.get(api("/ads/signups?verdict=strong_qualify")).json()
    assert body["verdict"] == "STRONG_QUALIFY" and {s["id"] for s in body["signups"]} == {"501", "502", "505"}
    body = client.get(api("/ads/signups?tier=campaign_matched&verdict=STRONG_QUALIFY")).json()
    assert {s["id"] for s in body["signups"]} == {"501", "502"}
    assert [s["submittedAt"] for s in client.get(api("/ads/signups")).json()["signups"]] == sorted(
        [s["submitted_at"] for s in make_signups()], reverse=True)
    assert client.get(api("/ads/signups?tier=bogus")).status_code == 422
    assert client.get(api("/ads/signups?verdict=<script>")).status_code == 422


def test_reports_are_workspace_isolated(client, connection):
    from datetime import date

    from app.models import Workspace

    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:
        s.add(Workspace(id="ws-other-ads", name="Other workspace", plan="Starter", timezone="UTC", currency="INR", reporting_start=date(2026, 9, 1),
                        reporting_end=date(2026, 9, 30), reporting_label="Sep", baseline_start=date(2026, 8, 1), baseline_end=date(2026, 8, 31),
                        baseline_label="Aug", last_synced_label="never"))
        s.commit()
    seed_ads(connection, "ws-other-ads")
    assert client.get(api("/ads/performance")).json()["rows"] == []
    assert client.get(api("/ads/signups")).json()["signups"] == []


def test_mask_phone():
    from app.api.routes.ads_reports import mask_phone

    assert mask_phone("+91 90000 01234") == "•••••• 1234"
    assert mask_phone("12") == "••••••"
    assert mask_phone("") is None and mask_phone(None) is None
