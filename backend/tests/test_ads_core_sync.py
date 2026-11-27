"""Ads core — Meta sync persisted into Postgres (mocked Meta transport), durability rules, runs, scheduler and the
AdMarketer reference import. Synthetic data only."""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.tenancy import bind_workspace
from app.models import (
    AdsCreative, AdsCreativeImage, AdsCreativeLabel, AdsLead, AdsMetaAd, AdsOptimization, AdsReferenceDataset, AdsSyncRun,
    AdsTargetingRecord, AdsWebsiteSignup,
)
from app.services.ads import records, sync
from app.services.ads.importer import import_reference
from app.services.ads.meta.client import MetaAdsClient, MetaNotConfiguredError

from .conftest import DEV_WORKSPACE, UNREACHABLE_DB, make_settings

JPEG = b"\xff\xd8\xff\xe0" + b"0" * 64
INV = "Can you invest minimum Rs 5,00,000?"
EDU = "Highest education qualification"
FR = "Do you have a franchise background?"
QUESTIONS = [{"key": "full_name", "label": "Full name"}, {"key": "phone_number", "label": "Phone number"},
             {"key": "pin", "label": "Pin code"}, {"key": "inv", "label": INV}, {"key": "edu", "label": EDU}, {"key": "fr", "label": FR}]


def meta_lead(lead_id: str, created: str, pin: str, inv: str = "Yes", edu: str = "Graduate") -> dict:
    values = {"full_name": f"Test Person {lead_id}", "phone_number": f"+91000000{lead_id[-4:]:0>4}", "pin": pin, "inv": inv, "edu": edu, "fr": "No"}
    return {"id": lead_id, "created_time": created, "field_data": [{"name": k, "values": [v]} for k, v in values.items()]}


class FakeMeta:
    """Routes Graph paths to canned synthetic responses. ``fail`` maps a path to an error code (sent every time)."""

    def __init__(self) -> None:
        self.calls: list[str] = []
        self.fail: dict[str, int] = {}
        self.accounts = [{"id": "act_1", "name": "Test Account"}]
        self.leads = [meta_lead("9004", "2026-09-04T10:00:00+0000", "400001"), meta_lead("9003", "2026-09-03T10:00:00+0000", "999999"),
                      meta_lead("9002", "2026-09-02T10:00:00+0000", "110001"),
                      meta_lead("9001", "2026-09-01T10:00:00+0000", "560001", edu="10th")]
        self.campaigns = {
            "1001": {"name": "Narrow", "pins": ["110001"], "leads": 1, "objective": "OUTCOME_LEADS", "form": "F1", "hash": "h1"},
            "1002": {"name": "Broad", "pins": ["110001", "560001", "400001"], "leads": 2, "objective": "OUTCOME_LEADS", "form": "F1", "hash": "h2"},
            "1003": {"name": "Website", "pins": [], "leads": 0, "objective": "OUTCOME_TRAFFIC", "form": None, "hash": "h3"},
        }

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if request.url.host == "cdn.example":
            return httpx.Response(200, content=JPEG, headers={"content-type": "image/jpeg"})
        path = request.url.path.split("/v26.0/", 1)[-1]
        params = request.url.params
        self.calls.append(path)
        if path in self.fail:
            return httpx.Response(400, json={"error": {"code": self.fail[path],
                                                        "message": f"Error validating access token: Session has expired {request.url}"}})
        if path == "me/adaccounts":
            return httpx.Response(200, json={"data": self.accounts})
        if path == "act_1/campaigns":
            return httpx.Response(200, json={"data": [
                {"id": cid, "name": c["name"], "effective_status": "ACTIVE", "objective": c["objective"], "created_time": f"2026-09-0{i}T00:00:00+0000"}
                for i, (cid, c) in enumerate(self.campaigns.items(), start=1)]})
        if path == "act_1/adimages":
            return httpx.Response(200, json={"data": [{"hash": h, "url": f"https://cdn.example/{h}.jpg"} for h in json.loads(params["hashes"])]})
        if path == "F1":
            return httpx.Response(200, json={"questions": QUESTIONS})
        if path == "F1/leads":
            return httpx.Response(200, json={"data": self.leads})
        cid, _, kind = path.partition("/")
        c = self.campaigns.get(cid)
        if c is None:
            return httpx.Response(404, json={"error": {"code": 100, "message": "Unknown path"}})
        if kind == "ads":
            cta = {"type": "SIGN_UP", "value": {"lead_gen_form_id": c["form"]}} if c["form"] else {"type": "LEARN_MORE"}
            return httpx.Response(200, json={"data": [{"id": f"5{cid}", "name": f"Ad {c['name']}", "creative": {
                "thumbnail_url": "https://cdn.example/thumb.jpg",
                "object_story_spec": {"link_data": {"message": f"Body {cid}", "name": f"Head {cid}", "image_hash": c["hash"], "call_to_action": cta}}}}]})
        if kind == "adsets":
            return httpx.Response(200, json={"data": [{"targeting": {
                "geo_locations": {"zips": [{"key": f"IN:{p}", "name": p} for p in c["pins"]]} if c["pins"] else {"countries": ["IN"]},
                "age_min": 21, "age_max": 45}, "optimization_goal": "LEAD_GENERATION", "daily_budget": "50000"}]})
        if kind == "insights":
            if params.get("breakdowns", "").startswith("hourly"):
                return httpx.Response(200, json={"data": [{"impressions": "5", "hourly_stats_aggregated_by_advertiser_time_zone": "09:00:00 - 09:59:59"}]})
            if params.get("breakdowns"):
                return httpx.Response(200, json={"data": [{"region": "Punjab", "impressions": "10", "reach": "8", "clicks": "1", "spend": "12.5"}]})
            return httpx.Response(200, json={"data": [{
                "impressions": "1000", "reach": "800", "clicks": "50", "ctr": "5", "cpc": "2", "cpm": "100", "spend": "100.00",
                "date_start": "2026-09-02", "actions": [{"action_type": "lead", "value": str(c["leads"])},
                                                        {"action_type": "onsite_conversion.lead_grouped", "value": str(c["leads"])}]}]})
        return httpx.Response(404, json={"error": {"code": 100}})


def ads_settings(db_url: str, **overrides):
    overrides.setdefault("meta_ads_access_token", "EAABtesttokenvalue1234567890")
    overrides.setdefault("meta_ads_workspace_id", DEV_WORKSPACE)
    return make_settings(db_url, **overrides)


@pytest.fixture
def meta() -> FakeMeta:
    return FakeMeta()


@pytest.fixture
def ws_db(connection) -> Session:
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    bind_workspace(session, DEV_WORKSPACE)
    yield session
    session.close()


def client_for(settings, meta: FakeMeta) -> MetaAdsClient:
    return MetaAdsClient(settings, transport=httpx.MockTransport(meta), sleep=lambda _s: None)


def run_sync(db: Session, db_url: str, meta: FakeMeta, **overrides) -> dict:
    settings = ads_settings(db_url, **overrides)
    with client_for(settings, meta) as client:
        counts = sync.run_meta_sync(db, settings, client)
    db.flush()
    return counts


def leads_by_id(db: Session) -> dict[str, AdsLead]:
    return {lead.meta_lead_id: lead for lead in db.scalars(select(AdsLead))}


# ------------------------------------------------------------------------------- full pull
def test_sync_persists_ads_leads_targeting_creatives_and_optimization(ws_db, db_url, meta):
    counts = run_sync(ws_db, db_url, meta)
    assert counts["ads"] == 3 and counts["newLeads"] == 3 and counts["imagesDownloaded"] == 3
    ads = {a.ad_id: a for a in ws_db.scalars(select(AdsMetaAd))}
    assert set(ads) == {"51001", "51002", "51003"}
    assert ads["51003"].channel == "website" and ads["51001"].channel == "lead_form"
    assert ads["51002"].metrics["leads"] == 2  # lead + lead_grouped deduplicated, not summed
    assert ads["51001"].targeting["targeted_pincodes"] == ["110001"] and ads["51001"].first_impression_hour == "09:00:00"

    leads = leads_by_id(ws_db)
    assert leads["9002"].ad_id == "51001"  # the narrow ad claims its own pincode first
    assert {leads["9004"].ad_id, leads["9001"].ad_id} == {"51002"}
    assert "9003" not in leads  # unattributed leads of the shared form are not stored
    assert leads["9002"].qualification_status == "sbi_strong" and leads["9002"].qualified
    assert leads["9001"].qualification_status == "not_qualified" and leads["9001"].education_level == "10th"
    assert leads["9002"].name == "Test Person 9002" and leads["9002"].phone.startswith("+91")

    assert ws_db.scalar(select(AdsTargetingRecord).where(AdsTargetingRecord.campaign_id == "1002")).pincodes == ["110001", "400001", "560001"]
    assert ws_db.scalar(select(AdsOptimization).where(AdsOptimization.campaign_id == "1001")).daily_budget == "50000"
    creative = ws_db.scalar(select(AdsCreative).where(AdsCreative.ad_id == "51001"))
    assert creative.headline == "Head 1001" and creative.image_full
    assert ws_db.scalar(select(func.count()).select_from(AdsCreativeImage)) == 3

    recs = records.load_ad_records(ws_db)
    assert [r["ad_id"] for r in recs] == ["51003", "51002", "51001"]  # newest first
    narrow = next(r for r in recs if r["ad_id"] == "51001")
    assert narrow["targeting_summary"]["targeted_pincodes"] == {"110001"}
    assert narrow["leads_data"][0]["qualification_status"] == "sbi_strong"
    assert set(narrow["leads_data"][0]) >= {"id", "created_time", "answers", "submitted_pincode", "pincode_qualified",
                                            "passes_screening_questions", "qualified"}
    assert records.load_creatives(ws_db)["51001"]["image_file"] == "51001.jpg"


def test_resync_is_idempotent_and_keeps_staff_esaf(ws_db, db_url, meta):
    run_sync(ws_db, db_url, meta)
    lead = leads_by_id(ws_db)["9004"]  # pincode match, graduate, invests → SBI strong
    lead.esaf_response, lead.esaf_response_source = "no", "staff"
    ws_db.flush()
    counts = run_sync(ws_db, db_url, meta)
    assert counts["newLeads"] == 0 and counts["imagesDownloaded"] == 0  # full pictures are not fetched again
    lead = leads_by_id(ws_db)["9004"]
    assert lead.esaf_response == "no" and lead.esaf_response_source == "staff"
    assert ws_db.scalar(select(func.count()).select_from(AdsMetaAd)) == 3


# ------------------------------------------------------------------------ durability rules
def test_token_expired_fails_without_touching_stored_data(ws_db, db_url, meta, connection):
    run_sync(ws_db, db_url, meta)
    meta.fail["me/adaccounts"] = 190
    with pytest.raises(sync.SyncFailed) as info:
        run_sync(ws_db, db_url, meta)
    assert info.value.code == "TOKEN_EXPIRED" and "EAAB" not in info.value.message
    assert ws_db.scalar(select(func.count()).select_from(AdsMetaAd)) == 3


def test_empty_pull_never_overwrites(ws_db, db_url, meta):
    run_sync(ws_db, db_url, meta)
    meta.accounts = []
    with pytest.raises(sync.SyncFailed) as info:
        run_sync(ws_db, db_url, meta)
    assert info.value.code == "empty_pull"
    assert ws_db.scalar(select(func.count()).select_from(AdsLead)) == 3


def test_rate_limited_targeting_is_restored_from_the_durable_record(ws_db, db_url, meta):
    ws_db.add(AdsTargetingRecord(campaign_id="1001", campaign_name="Narrow", pincodes=["110001"], locations=["1 pincode(s): 110001"],
                                 interests_behaviors="Interests: Banking", setup={"age_min": 25, "age_max": 40}))
    ws_db.flush()
    meta.fail["1001/adsets"] = 17
    run_sync(ws_db, db_url, meta)
    ad = ws_db.scalar(select(AdsMetaAd).where(AdsMetaAd.ad_id == "51001"))
    assert ad.targeting["restored_from_db"] is True and ad.targeting["targeted_pincodes"] == ["110001"]
    assert ws_db.scalar(select(AdsTargetingRecord).where(AdsTargetingRecord.campaign_id == "1001")).interests_behaviors == "Interests: Banking"
    assert leads_by_id(ws_db)["9002"].qualification_status == "sbi_strong"
    assert meta.calls.count("1001/adsets") == 3  # code 17 retried twice


def test_a_lead_form_that_fails_keeps_its_stored_leads(ws_db, db_url, meta):
    run_sync(ws_db, db_url, meta)
    meta.fail["F1/leads"] = 2
    counts = run_sync(ws_db, db_url, meta)
    assert counts["failedLeadForms"] == 1
    assert {lead.meta_lead_id for lead in ws_db.scalars(select(AdsLead).where(AdsLead.ad_id.is_not(None)))} == {"9001", "9002", "9004"}


# --------------------------------------------------------------------------------- runs
def test_run_lifecycle_dedup_and_signups(connection, db_url, meta):
    settings = ads_settings(db_url, eko_signup_admin_base_url="https://signup.example", eko_signup_admin_user="u",
                            eko_signup_admin_password="pw-secret")
    factory = sessionmaker(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    with factory() as db:
        first = sync.enqueue(db, settings, DEV_WORKSPACE, member_id=None)
        second = sync.enqueue(db, settings, DEV_WORKSPACE, member_id=None)
        db.commit()
    assert first.created and not second.created and first.run.id == second.run.id

    def fetch_signups(_settings, known):
        assert known["1001"] == "Narrow"
        return [{"id": 77, "mobile": "+910000000077", "name": "Signup Person", "submitted_at": "2026-09-05", "qualification_verdict": "STRONG_QUALIFY",
                 "shop_address": "Somewhere", "attribution_tier": "campaign_matched", "matched_campaign_id": "1003",
                 "matched_campaign_name": "Website", "utm_source": "facebook", "utm_medium": "paid", "utm_campaign": "1003"}]

    status = sync.execute_run(factory, settings, first.run.id, client_factory=lambda: client_for(settings, meta), signup_fetcher=fetch_signups)
    assert status == "succeeded"
    assert sync.execute_run(factory, settings, first.run.id) == "skipped"  # duplicate delivery
    with factory() as db:
        bind_workspace(db, DEV_WORKSPACE)
        run = db.get(AdsSyncRun, first.run.id)
        assert run.counts["ads"] == 3 and run.counts["signups"]["newSignups"] == 1
        assert records.load_signups(db)[0]["id"] == "77"

    def broken(_settings, _known):
        raise RuntimeError("login failed for u with pw-secret")

    with factory() as db:
        run2 = sync.enqueue(db, settings, DEV_WORKSPACE, kind="signups")
        db.commit()
    assert sync.execute_run(factory, settings, run2.run.id, signup_fetcher=broken) == "failed"
    with factory() as db:
        bind_workspace(db, DEV_WORKSPACE)
        failed = db.get(AdsSyncRun, run2.run.id)
        assert failed.error_code == "signups_error" and "pw-secret" not in failed.error_message
        assert db.scalar(select(func.count()).select_from(AdsWebsiteSignup)) == 1


def test_token_expired_run_is_reported(connection, db_url, meta):
    settings = ads_settings(db_url)
    meta.fail["me/adaccounts"] = 190
    factory = sessionmaker(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    with factory() as db:
        run = sync.enqueue(db, settings, DEV_WORKSPACE).run
        db.commit()
    assert sync.execute_run(factory, settings, run.id, client_factory=lambda: client_for(settings, meta)) == "failed"
    with factory() as db:
        bind_workspace(db, DEV_WORKSPACE)
        assert db.get(AdsSyncRun, run.id).error_code == "TOKEN_EXPIRED"
        assert sync.last_finished(db, "meta").error_code == "TOKEN_EXPIRED"


def test_sync_refuses_without_credentials(ws_db, db_url):
    with pytest.raises(sync.AdsNotConfiguredError):
        sync.enqueue(ws_db, make_settings(db_url), DEV_WORKSPACE)
    assert sync.schedule_due(ws_db, make_settings(db_url), None) == 0
    with pytest.raises(MetaNotConfiguredError):
        MetaAdsClient(make_settings(UNREACHABLE_DB))


def test_scheduler_queues_once_per_interval(connection, db_url):
    settings = ads_settings(db_url)
    sent: list[str] = []
    with Session(bind=connection, join_transaction_mode="create_savepoint") as db:
        assert sync.schedule_due(db, settings, lambda run_id, _c: sent.append(run_id)) == 1
    with Session(bind=connection, join_transaction_mode="create_savepoint") as db:
        assert sync.schedule_due(db, settings, lambda run_id, _c: sent.append(run_id)) == 0
    assert len(sent) == 1 and sent[0].startswith("adsr_")


def test_stale_running_runs_are_reaped(connection, db_url):
    from datetime import timedelta

    from app.services.common import utcnow

    with Session(bind=connection, join_transaction_mode="create_savepoint") as db:
        db.add(AdsSyncRun(id="adsr_stale", workspace_id=DEV_WORKSPACE, kind="meta", trigger="manual", status="running",
                          started_at=utcnow() - timedelta(hours=2), lease_expires_at=utcnow() - timedelta(minutes=1), counts={}))
        db.commit()
        assert sync.reap_stale_runs(db) == 1
        assert db.get(AdsSyncRun, "adsr_stale").error_code == "worker_lost"


# ------------------------------------------------------------------------------- import
def write_reference(tmp: Path) -> Path:
    (tmp / "creatives").mkdir()
    (tmp / "creatives" / "777.jpg").write_bytes(JPEG)
    (tmp / "creatives" / "778.jpg").write_bytes(b"<svg>not an image</svg>")
    (tmp / "ad_targeted_pincodes.json").write_text(json.dumps({
        "2001": {"campaign_name": "Old", "ad_name": "Old ad", "account_name": "Acct", "pincodes": ["110001", "bad"], "locations": ["x"],
                 "interests_behaviors": "Interests: Banking", "setup": {"age_min": 21}},
        "../evil": {"pincodes": []}}), encoding="utf-8")
    (tmp / "ad_creatives.json").write_text(json.dumps({
        "777": {"campaign_id": "2001", "type": "image", "headline": "H", "image_hash": "hh1", "image_file": "777.jpg", "image_full": True},
        "778": {"campaign_id": "2001", "type": "image", "image_file": "778.jpg"},
        "779": {"campaign_id": "2001", "image_file": "../../secret.jpg"}}), encoding="utf-8")
    (tmp / "creative_labels.json").write_text(json.dumps({"hh1": {"image_type": "Real photo"}}), encoding="utf-8")
    (tmp / "ad_optimization.json").write_text(json.dumps({"2001": {"optimization_goal": "LEAD_GENERATION", "daily_budget": None}}), encoding="utf-8")
    (tmp / "csp_villages_geocoded.json").write_text(json.dumps([{"village_clean": "V", "pincode": "141001"}]), encoding="utf-8")
    return tmp


def test_import_reference_is_idempotent_and_safe(ws_db, tmp_path):
    directory = write_reference(tmp_path)
    report = import_reference(ws_db, directory)
    assert report.counts["ads_targeting_records"] == {"inserted": 1, "updated": 0, "unchanged": 0, "skipped": 1}
    assert report.counts["ads_creatives"]["inserted"] == 3
    assert report.counts["ads_creative_images"] == {"inserted": 1, "updated": 0, "unchanged": 0, "skipped": 2}  # svg + path escape
    assert report.counts["ads_creative_labels"]["inserted"] == 1 and report.counts["ads_optimization"]["inserted"] == 1
    assert report.counts["ads_reference_datasets"]["inserted"] == 1
    rec = ws_db.scalar(select(AdsTargetingRecord).where(AdsTargetingRecord.campaign_id == "2001"))
    assert rec.pincodes == ["110001"]
    assert records.load_creative_labels(ws_db) == {"hh1": {"image_type": "Real photo"}}
    assert records.load_optimization(ws_db)["2001"]["optimization_goal"] == "LEAD_GENERATION"
    assert ws_db.scalar(select(AdsReferenceDataset.row_count).where(AdsReferenceDataset.name == "csp_villages_geocoded")) == 1
    assert records.sbi_service_pincodes(ws_db) >= {"110001", "141001"}

    again = import_reference(ws_db, directory)
    assert all(c["inserted"] == 0 and c["updated"] == 0 for c in again.counts.values())
    assert ws_db.scalar(select(func.count()).select_from(AdsCreativeLabel)) == 1


def test_import_command_runs(monkeypatch, db_url, tmp_path, capsys):
    """The CLI wiring (argument parsing + workspace resolution), against a directory that does not exist."""
    from scripts import import_admarketer_reference as cli

    monkeypatch.setattr(cli, "get_settings", lambda: ads_settings(db_url))
    assert cli.main([str(tmp_path / "missing"), "--workspace", DEV_WORKSPACE]) == 1
    assert "is not a directory" in capsys.readouterr().err
