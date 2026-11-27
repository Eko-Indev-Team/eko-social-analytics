"""Ads core — HTTP routes: not-configured behaviour, PII masking / permissions, sync trigger, exports, pictures,
creative labels, ESAF edits, and the qualification fields on SocialBoard's own leads. Synthetic data only."""

from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.core.tenancy import bind_workspace
from app.main import create_app
from app.models import ActivityEvent, AdsReferenceDataset, AdsTargetingRecord

from .conftest import DEV_WORKSPACE, TEST_PASSWORD, api, sign_in
from .test_ads_core_sync import FakeMeta, ads_settings, run_sync

pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")


@pytest.fixture
def seeded(connection, db_url):
    """Run one mocked Meta sync into the dev workspace (inside the rolled-back test transaction)."""
    with Session(bind=connection, join_transaction_mode="create_savepoint") as db:
        bind_workspace(db, DEV_WORKSPACE)
        run_sync(db, db_url, FakeMeta())
        db.commit()


@pytest.fixture
def ads_as(connection, db_url):
    """Factory: a client for a seeded member, with Meta Ads configured and a recording dispatcher."""
    opened: list[TestClient] = []

    def _make(member: str, *, user_id: str | None = None, dispatcher: bool = True, **overrides) -> TestClient:
        app = create_app(ads_settings(db_url, **overrides))
        app.state.session_factory = sessionmaker(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
        app.state.dispatched = []
        app.state.job_dispatcher = (lambda job_id, countdown: app.state.dispatched.append(job_id)) if dispatcher else None
        c = TestClient(app)
        c.__enter__()
        opened.append(c)
        return sign_in(app, c, connection, user_id=user_id or f"usr_test_{member}")

    yield _make
    for c in opened:
        c.__exit__(None, None, None)


@pytest.fixture
def viewer(connection, ads_as):
    from app.models import TeamMember, User
    from app.services.auth import hash_password

    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:
        user = User(id="usr_test_adsviewer", email="adsviewer@eko.example", name="Ads Viewer", password_hash=hash_password(TEST_PASSWORD))
        s.add(user)
        s.flush()
        s.add(TeamMember(id="usr-adsviewer", workspace_id=DEV_WORKSPACE, user_id=user.id, name=user.name, email=user.email, role="Analyst",
                         access="Viewer", status="active", last_active_label="Active now", position=98))
        s.commit()
    return ads_as("usr-adsviewer", user_id="usr_test_adsviewer")


# --------------------------------------------------------------------------- not configured
def test_without_meta_credentials_everything_is_empty_and_sync_refuses(client):
    status = client.get(api("/ads/status")).json()
    assert status["configured"] is False and status["tokenExpired"] is False and status["currentJob"] is None
    assert status["adCount"] == 0 and status["canSync"] is True and status["canSeeLeads"] is True
    assert client.get(api("/ads")).json() == []
    assert client.get(api("/ads/leads")).json() == []
    summary = client.get(api("/ads/summary")).json()
    assert summary["spend"] == 0 and summary["costPerLead"] is None and summary["currency"] == "INR"
    response = client.post(api("/ads/sync"))
    assert response.status_code == 409 and response.json()["error"]["code"] == "ads_not_configured"
    assert "META_ADS_ACCESS_TOKEN" in response.json()["error"]["message"]
    assert client.get(api("/ads/export.xlsx")).status_code == 404
    assert client.get(api("/ads/123")).status_code == 404


# ------------------------------------------------------------------------------- read API
def test_ads_list_detail_summary_and_image(seeded, ads_as):
    owner = ads_as("usr-mansi")
    rows = owner.get(api("/ads")).json()
    assert [r["id"] for r in rows] == ["51003", "51002", "51001"]
    narrow = rows[2]
    assert narrow["channel"] == "lead_form" and narrow["leadCounts"] == {"total": 1, "pincodeQualified": 1, "qualified": 1}
    assert narrow["creative"]["imageUrl"] == "/api/v1/ads/51001/image" and narrow["targeting"]["pincodeCount"] == 1
    assert narrow["targeting"]["ageRange"] == "21-45"
    detail = owner.get(api("/ads/51001")).json()
    assert detail["targeting"]["pincodes"] == ["110001"] and detail["breakdowns"]["region"][0]["region"] == "Punjab"
    assert detail["leadFormId"] == "F1"
    image = owner.get(api("/ads/51001/image"))
    assert image.status_code == 200 and image.headers["content-type"] == "image/jpeg" and "private" in image.headers["cache-control"]
    assert owner.get(api("/ads/99999/image")).status_code == 404
    summary = owner.get(api("/ads/summary")).json()
    assert summary["adCount"] == 3 and summary["leads"] == 3 and summary["spend"] == 300
    assert summary["qualificationCounts"]["sbi_strong"] == 2 and summary["qualificationCounts"]["not_qualified"] == 1
    assert summary["qualifiedLeads"] == 2 and summary["costPerQualifiedLead"] == 150
    status = owner.get(api("/ads/status")).json()
    assert status["configured"] is True and status["adCount"] == 3 and status["leadCount"] == 3


def test_leads_are_masked_without_ads_leads(seeded, ads_as, viewer):
    owner = ads_as("usr-mansi")
    full = {lead["id"]: lead for lead in owner.get(api("/ads/leads")).json()}
    assert full["9002"]["name"] == "Test Person 9002" and full["9002"]["answers"][0]["question"]
    assert full["9002"]["qualificationStatus"] == "sbi_strong" and full["9002"]["sbiReasons"] == []
    assert full["9001"]["qualificationStatus"] == "not_qualified" and full["9001"]["sbiReasons"] == ["education_below_12th"]
    assert full["9001"]["educationLevel"] == "10th" and full["9001"]["canInvest"] is True
    editor = ads_as("usr-ananya")
    assert editor.get(api("/ads/leads")).json()[0]["name"]

    masked = {lead["id"]: lead for lead in viewer.get(api("/ads/leads")).json()}
    assert set(masked) == set(full)
    lead = masked["9002"]
    assert lead["name"] is None and lead["answers"] is None and lead["phone"].startswith("•••••• ") and lead["phone"][-4:] == full["9002"]["phone"][-4:]
    assert lead["qualificationStatus"] == "sbi_strong"  # counts and status stay visible
    assert viewer.get(api("/ads/leads"), params={"q": "Test Person"}).json() == []  # no PII search oracle
    assert len(owner.get(api("/ads/leads"), params={"q": "Test Person"}).json()) == 3
    assert viewer.get(api("/ads/export.xlsx")).status_code == 403
    assert viewer.get(api("/ads/51002/export.xlsx")).status_code == 403
    assert [x["id"] for x in owner.get(api("/ads/leads"), params={"status": "not_qualified"}).json()] == ["9001"]
    assert [x["id"] for x in owner.get(api("/ads/51001/leads")).json()] == ["9002"]


def test_excel_exports(seeded, ads_as):
    owner = ads_as("usr-mansi")
    response = owner.get(api("/ads/export.xlsx"))
    assert response.status_code == 200 and "All_Facebook_Form_Leads.xlsx" in response.headers["content-disposition"]
    ws = load_workbook(io.BytesIO(response.content)).active
    headers = [c.value for c in ws[1]]
    assert headers[:6] == ["Ad", "Account", "Submitted", "Lead ID", "Qualified", "Pincode qualified"]
    assert "Qualification" in headers and headers[-2:] == ["Phone number", "Full name"]
    assert ws.max_row == 4 and ws.cell(row=2, column=4).number_format == "@"
    qualified = owner.get(api("/ads/export.xlsx"), params={"filter": "qualified"})
    assert load_workbook(io.BytesIO(qualified.content)).active.max_row == 3
    assert owner.get(api("/ads/export.xlsx"), params={"from": "2030-01-01"}).status_code == 404
    one = owner.get(api("/ads/51002/export.xlsx"))
    assert one.status_code == 200 and "_leads.xlsx" in one.headers["content-disposition"]
    assert owner.get(api("/ads/51003/export.xlsx")).status_code == 404  # website ad: no leads


# ---------------------------------------------------------------------------------- writes
def test_sync_trigger_permissions_dedup_and_dispatch(ads_as):
    assert ads_as("usr-ananya").post(api("/ads/sync")).status_code == 403  # Editor: no ads:manage
    admin = ads_as("usr-rahul")
    first = admin.post(api("/ads/sync"))
    assert first.status_code == 202 and first.json()["status"] == "queued" and first.json()["deduplicated"] is False
    second = admin.post(api("/ads/sync")).json()
    assert second["jobId"] == first.json()["jobId"] and second["deduplicated"] is True
    assert admin.app.state.dispatched == [first.json()["jobId"]]
    assert admin.get(api("/ads/status")).json()["currentJob"]["id"] == first.json()["jobId"]
    assert ads_as("usr-mansi", dispatcher=False).post(api("/ads/sync")).status_code in (202, 503)
    no_csrf = ads_as("usr-rahul")
    del no_csrf.headers["X-CSRF-Token"]
    assert no_csrf.post(api("/ads/sync")).status_code == 403
    assert admin.post(api("/ads/sync"), json={"kind": "signups"}).status_code == 409  # signup admin not configured


def test_no_dispatcher_answers_503(ads_as):
    assert ads_as("usr-mansi", dispatcher=False).post(api("/ads/sync")).status_code == 503


def test_esaf_edit_recomputes_status_and_is_audited(seeded, ads_as, viewer, connection):
    editor = ads_as("usr-ananya")
    assert viewer.patch(api("/ads/leads/9004"), json={"esafResponse": "yes"}).status_code == 403
    assert editor.patch(api("/ads/leads/9004"), json={"esafResponse": "maybe"}).status_code == 422
    # 9001: pincode ok, invests, but 10th → not qualified even if ESAF is yes (education is required for ESAF too).
    body = editor.patch(api("/ads/leads/9001"), json={"esafResponse": "yes"}).json()
    assert body["esafResponse"] == "yes" and body["esafResponseSource"] == "staff" and body["qualificationStatus"] == "not_qualified"
    cleared = editor.patch(api("/ads/leads/9001"), json={"esafResponse": None}).json()
    assert cleared["esafResponse"] is None and cleared["esafResponseSource"] is None
    assert editor.patch(api("/ads/leads/12345"), json={"esafResponse": "no"}).status_code == 404
    with Session(bind=connection) as s:
        events = list(s.scalars(select(ActivityEvent).where(ActivityEvent.title == "Ad Lead Updated")))
    assert events and all("Test Person" not in e.summary for e in events)


def test_creative_labels(seeded, ads_as, viewer):
    editor = ads_as("usr-ananya")
    labels = {x["imageHash"]: x for x in editor.get(api("/ads/creative-labels")).json()}
    assert labels["h1"]["imageType"] is None and labels["h1"]["adIds"] == ["51001"] and labels["h1"]["imageUrl"]
    assert viewer.put(api("/ads/creative-labels/h1"), json={"imageType": "Photo"}).status_code == 403
    assert editor.put(api("/ads/creative-labels/h1"), json={"imageType": "Real photo"}).json()["imageType"] == "Real photo"
    rows = editor.get(api("/ads")).json()
    assert next(r for r in rows if r["id"] == "51001")["creative"]["imageType"] == "Real photo"
    assert editor.put(api("/ads/creative-labels/h1"), json={"imageType": None}).json()["imageType"] is None
    assert editor.put(api("/ads/creative-labels/bad%20hash"), json={"imageType": "x"}).status_code == 422


# ------------------------------------------------------------------ SocialBoard's own leads
def test_socialboard_lead_qualification_fields(client, connection):
    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:
        s.add(AdsTargetingRecord(workspace_id=DEV_WORKSPACE, campaign_id="3001", pincodes=["110001"], locations=[], setup={}))
        s.add(AdsReferenceDataset(workspace_id=DEV_WORKSPACE, name="csp_villages_geocoded", row_count=1, data=[{"pincode": "141001"}]))
        s.commit()
    before = client.get(api("/leads")).json()[0]
    assert "qualificationStatus" not in before and "pincode" not in before  # unchanged until staff record something
    lead_id = before["id"]
    body = client.patch(api(f"/leads/{lead_id}"), json={"pincode": "141001", "educationAnswer": "12th pass", "canInvest": True}).json()
    assert body["qualificationStatus"] == "sbi_strong" and body["educationLevel"] == "12th / Intermediate" and body["sbiReasons"] == []
    body = client.patch(api(f"/leads/{lead_id}"), json={"pincode": "999999"}).json()
    assert body["qualificationStatus"] == "esaf_pitch" and body["sbiReasons"] == ["pincode_mismatch"]
    body = client.patch(api(f"/leads/{lead_id}"), json={"esafResponse": "yes"}).json()
    assert body["qualificationStatus"] == "esaf_strong"
    body = client.patch(api(f"/leads/{lead_id}"), json={"educationAnswer": "10th"}).json()
    assert body["qualificationStatus"] == "not_qualified" and "education_below_12th" in body["sbiReasons"]
    assert client.patch(api(f"/leads/{lead_id}"), json={"pincode": "12"}).status_code == 422
    cleared = client.patch(api(f"/leads/{lead_id}"), json={"pincode": None, "educationAnswer": None, "canInvest": None, "esafResponse": None}).json()
    assert "qualificationStatus" not in cleared
