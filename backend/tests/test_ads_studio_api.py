"""Ad Studio HTTP API against PostgreSQL: dry-run drafts, guardrails, pictures, permissions, and the live publish /
activate / insights paths against a *mocked* Meta (httpx.MockTransport). No network, no paid APIs."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.main import create_app
from app.models import AdsReferenceDataset, AdsStudioDraft
from app.services.ads.studio import rules

from .conftest import DEV_WORKSPACE, api, make_settings, sign_in
from .test_ads_studio_rules import DATASETS, JPEG, PNG, TOKEN, FakeMeta
from .test_ai import AI, FakeProvider

pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")

LIVE = dict(meta_ads_access_token=TOKEN, meta_ads_publish_account_id="act_42", meta_ads_page_id="page_1")


@pytest.fixture
def studio(connection, db_url):
    """Factory: studio(member_id, **settings) → signed-in client; the app has a fake Meta + fake AI provider attached."""
    opened = []

    def _make(member_id="usr-mansi", meta: FakeMeta | None = None, provider: FakeProvider | None = None, **overrides):
        app = create_app(make_settings(db_url, **overrides))
        app.state.session_factory = sessionmaker(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
        app.state.ads_studio_meta_transport = (meta or FakeMeta()).transport
        if provider is not None:
            app.state.ads_studio_ai_provider_factory = lambda: provider
        client = TestClient(app)
        client.__enter__()
        opened.append(client)
        return sign_in(app, client, connection, user_id=f"usr_test_{member_id}")

    yield _make
    for c in opened:
        c.__exit__(None, None, None)


@pytest.fixture
def reference(connection):
    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:
        for name, data in DATASETS.items():
            s.add(AdsReferenceDataset(workspace_id=DEV_WORKSPACE, name=name, source_file=f"{name}.json", row_count=len(data), data=data))
        s.commit()


def draft_body(**over):
    copy = rules.caption_to_copy(3)
    body = {
        "brief": {"objective": "leads", "angle": "women_first"},
        "copy": {"headlineLine1": copy["headline_line1"], "headlineLine2": "", "subheading": copy["subheading"], "primaryText": copy["primary_text"],
                 "description": copy["description"], "bullets": copy["bullets"], "ctaText": copy["cta_text"], "source": "locked_caption", "captionIndex": 3},
        "targeting": {"districts": ["Testpur", "Kheri"], "villageCodes": ["V-001"], "dailyBudget": 400, "gender": "female"},
        "destination": {"url": "kiosk.eko.in/signup", "number": "+91 70000 00000"},
        "targetCpa": 150,
    }
    for k, v in over.items():
        body[k] = {**body[k], **v} if isinstance(v, dict) and isinstance(body.get(k), dict) else v
    return body


def make_draft(client, **over) -> dict:
    r = client.post(api("/ads/studio/drafts"), json=draft_body(**over))
    assert r.status_code == 201, r.text
    return r.json()


# ------------------------------------------------------------------------------------------------ options
def test_options_for_a_viewer(viewer_client, reference):
    r = viewer_client.get(api("/ads/studio/options"))
    assert r.status_code == 200, r.text
    o = r.json()
    assert [a["id"] for a in o["angles"]] == rules.APPROVED_ANGLES and [c["text"] for c in o["ctas"]] == rules.APPROVED_CTAS
    assert len(o["lockedCaptions"]) == 5 and "Check Eligibility" in o["bannedPhrases"] and o["referenceDataLoaded"]
    assert {d["name"] for d in o["districts"]} >= {"Testpur", "Samplegarh", "Kheri"}
    caps = o["capabilities"]
    assert caps == {**caps, "aiCopy": False, "imageGeneration": False, "livePublish": False, "canEdit": False, "canPublish": False}
    assert caps["livePublishMissing"] == ["META_ADS_ACCESS_TOKEN", "META_ADS_PUBLISH_ACCOUNT_ID", "META_ADS_PAGE_ID"]
    v = viewer_client.get(api("/ads/studio/villages"), params={"district": "Villagedist"}).json()
    assert [x["code"] for x in v] == ["V-001", "V-002", "V-002~2"] and v[0]["pincode"] == "140001"


def test_options_without_reference_data_say_so(client):
    o = client.get(api("/ads/studio/options")).json()
    assert o["referenceDataLoaded"] is False and any("import_admarketer_reference" in n for n in o["notes"])
    assert o["capabilities"]["canPublish"] is True and o["capabilities"]["canEdit"] is True


# ---------------------------------------------------------------------------------------------------- copy
def test_copy_locked_and_labelled_fallback_without_ai(client):
    r = client.post(api("/ads/studio/copy"), json={"mode": "locked", "captionIndex": 5, "brief": {"angle": "shop_owner"}})
    assert r.status_code == 200 and r.json()["source"] == "locked_caption" and r.json()["cta"] == "LEARN_MORE" and r.json()["captionIndex"] == 5
    g = client.post(api("/ads/studio/copy"), json={"mode": "generate"}).json()
    assert g["source"] == "locked_caption_fallback" and g["aiModel"] is None and g["note"].startswith("Not AI-written")


def test_copy_generated_by_the_configured_ai_provider(studio):
    provider = FakeProvider([{"headline_line1": "नया अवसर", "headline_line2": "आपके गांव में", "subheading": "Check Eligibility today",
                              "primary_text": "कियोस्क चलाएं", "description": "जानें", "bullets": ["a", "b"], "cta_text": "Sign up"}])
    owner = studio(provider=provider, **AI)
    g = owner.post(api("/ads/studio/copy"), json={"mode": "generate", "brief": {"angle": "women_first"}}).json()
    assert g["source"] == "ai" and g["aiModel"] == "test-model-1" and g["ctaText"] == rules.APPROVED_CTAS[0]
    assert g["guardrails"]["ctaReplaced"] and g["guardrails"]["removedPhrases"] == ["Check Eligibility"] and "Eligibility" not in g["subheading"]
    assert provider.calls[0]["schema_name"] == "StudioAdCopyDraft"


def test_viewer_cannot_generate_copy_or_build(viewer_client):
    assert viewer_client.post(api("/ads/studio/copy"), json={"mode": "locked"}).status_code == 403
    assert viewer_client.post(api("/ads/studio/drafts"), json=draft_body()).status_code == 403


def test_targeting_preview(viewer_client, reference):
    r = viewer_client.post(api("/ads/studio/targeting"), json={"districts": ["Testpur", "Kheri"], "villageCodes": ["V-002"]})
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["districts"] == ["Testpur"] and t["removed"] == ["Kheri"] and t["pincodes"] == ["140002"] and len(t["anchors"]) == 2
    assert t["metaTargeting"]["geo_locations"]["zips"] == [{"key": "IN:140002"}]
    assert viewer_client.post(api("/ads/studio/targeting"), json={"ageMin": 50, "ageMax": 30}).status_code == 422


# -------------------------------------------------------------------------------------------------- drafts
def test_dry_run_draft_stores_the_exact_payload_and_sends_nothing(studio, reference):
    meta = FakeMeta()
    editor = studio("usr-ananya", meta=meta)
    d = make_draft(editor)
    assert d["mode"] == "dry_run" and d["status"] == "built" and d["copySource"] == "locked_caption" and d["createdByName"]
    assert d["targeting"]["removed"] == ["Kheri"] and d["dailyBudget"] == 400 and d["guardrails"] == {"maxDailySpend": 400, "targetCpa": 150}
    p = d["payload"]
    assert p["campaign"]["status"] == p["ad_set"]["status"] == p["ad"]["status"] == "PAUSED" and p["ad_set"]["daily_budget"] == 40000
    assert p["ad_set"]["targeting"]["genders"] == [2] and p["ad_creative"]["object_story_spec"]["link_data"]["link"] == "https://kiosk.eko.in/signup"
    assert d["destination"]["number"] == "+91 70000 00000" and d["canPublish"] is False and d["canActivate"] is False
    assert any("Dry run" in n for n in d["notes"]) and meta.requests == []
    assert editor.get(api(f"/ads/studio/drafts/{d['id']}")).json()["payload"] == p
    listed = editor.get(api("/ads/studio/drafts")).json()
    assert listed[0]["id"] == d["id"] and "payload" not in listed[0]
    ins = editor.get(api(f"/ads/studio/drafts/{d['id']}/insights")).json()
    assert ins["available"] is False and ins["metrics"] is None and ins["advice"] == [] and "does not show example numbers" in ins["note"]


@pytest.mark.parametrize("copy_override,needle", [
    ({"primaryText": "अभी Check Eligibility करें"}, "eligibility"),
    ({"bullets": ["पात्रता जांचें"]}, "eligibility"),
    ({"ctaText": "Click here"}, "call-to-action"),
])
def test_drafts_breaking_the_locked_rules_are_rejected(client, copy_override, needle):
    r = client.post(api("/ads/studio/drafts"), json=draft_body(copy=copy_override))
    assert r.status_code == 422
    assert any(needle in v for v in r.json()["error"]["details"]["violations"])


def test_edited_locked_caption_is_labelled_custom(client):
    d = make_draft(client, copy={"primaryText": "अपना कियोस्क खोलें"})
    assert d["copySource"] == "custom" and "not one of the pre-approved" in d["copy"]["note"]


def test_bad_destination_and_csrf(client):
    assert client.post(api("/ads/studio/drafts"), json=draft_body(destination={"url": "javascript:alert(1)"})).status_code == 422
    client.headers.pop("X-CSRF-Token")
    r = client.post(api("/ads/studio/drafts"), json=draft_body())
    assert r.status_code == 403


# ------------------------------------------------------------------------------------------------- picture
def test_picture_upload_validation_download_and_delete(client):
    d = make_draft(client)
    url = api(f"/ads/studio/drafts/{d['id']}/image")
    assert client.put(url, content=b"<svg/>" * 50, headers={"content-type": "image/svg+xml"}).status_code == 422
    assert client.put(url, content=PNG, headers={"content-type": "image/jpeg"}).status_code == 422
    big = b"\xff\xd8\xff" + b"\x00" * (8 * 1024 * 1024)
    assert client.put(url, content=big, headers={"content-type": "image/jpeg"}).status_code == 413
    r = client.put(url, content=PNG, headers={"content-type": "image/png"})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["hasImage"] and out["imageSource"] == "upload" and out["imageUrl"] == f"/api/v1/ads/studio/drafts/{d['id']}/image"
    assert out["payload"]["ad_image"] == {"upload": "the draft's picture"}
    g = client.get(url)
    assert g.status_code == 200 and g.content == PNG and g.headers["content-type"] == "image/png" and "private" in g.headers["cache-control"]
    assert client.delete(url).json()["hasImage"] is False
    assert client.get(url).status_code == 404


def test_picture_generation_is_off_unless_enabled(studio):
    owner = studio()
    d = make_draft(owner)
    r = owner.post(api(f"/ads/studio/drafts/{d['id']}/image/generate"))
    assert r.status_code == 409 and r.json()["error"]["code"] == "not_configured"


def test_picture_generation_with_pollinations(studio):
    import httpx

    owner = studio(ad_studio_image_provider="pollinations")
    owner.app.state.ads_studio_image_transport = httpx.MockTransport(lambda r: httpx.Response(200, content=JPEG))
    d = make_draft(owner)
    r = owner.post(api(f"/ads/studio/drafts/{d['id']}/image/generate"))
    assert r.status_code == 200, r.text
    assert r.json()["imageSource"] == "pollinations" and owner.get(api(f"/ads/studio/drafts/{d['id']}/image")).content == JPEG


def test_delete_dry_run_draft(client):
    d = make_draft(client)
    assert client.delete(api(f"/ads/studio/drafts/{d['id']}")).status_code == 204
    assert client.get(api(f"/ads/studio/drafts/{d['id']}")).status_code == 404


# ---------------------------------------------------------------------------------------------------- live
def test_live_publish_needs_configuration_and_ads_manage(studio):
    owner = studio()
    d = make_draft(owner)
    r = owner.post(api(f"/ads/studio/drafts/{d['id']}/publish"))
    assert r.status_code == 409 and r.json()["error"]["details"]["missing"] == ["META_ADS_ACCESS_TOKEN", "META_ADS_PUBLISH_ACCOUNT_ID", "META_ADS_PAGE_ID"]
    editor = studio("usr-ananya", **LIVE)
    assert editor.post(api(f"/ads/studio/drafts/{d['id']}/publish")).status_code == 403
    assert editor.post(api(f"/ads/studio/drafts/{d['id']}/activate"), json={"confirmDailyBudget": 400}).status_code == 403


def test_live_publish_activate_and_insights_with_mocked_meta(studio, reference, connection):
    meta = FakeMeta()
    admin = studio("usr-rahul", meta=meta, **LIVE)
    d = make_draft(admin)
    # A dry run has nothing on Meta to activate; a picture is required to publish.
    assert admin.post(api(f"/ads/studio/drafts/{d['id']}/activate"), json={"confirmDailyBudget": 400}).status_code == 409
    assert admin.post(api(f"/ads/studio/drafts/{d['id']}/publish")).status_code == 422
    assert admin.put(api(f"/ads/studio/drafts/{d['id']}/image"), content=PNG, headers={"content-type": "image/png"}).json()["canPublish"] is True

    r = admin.post(api(f"/ads/studio/drafts/{d['id']}/publish"))
    assert r.status_code == 200, r.text
    pub = r.json()
    assert pub["mode"] == "live" and pub["status"] == "built" and pub["error"] is None and pub["canActivate"] is True
    assert pub["metaIds"] == {"campaignId": "id_campaigns", "adSetId": "id_adsets", "imageHash": "hash123", "creativeId": "id_adcreatives", "adId": "id_ads"}
    assert any("not been tested against real Meta" in n for n in pub["notes"])
    assert [x[1] for x in meta.requests] == ["act_42/campaigns", "act_42/adsets", "act_42/adimages", "act_42/adcreatives", "act_42/ads"]
    assert all(x[2]["status"] == "PAUSED" for x in meta.requests if x[2] and "status" in x[2])
    assert pub["payload"]["ad"]["adset_id"] == "id_adsets"
    assert admin.post(api(f"/ads/studio/drafts/{d['id']}/publish")).status_code == 409  # never twice
    assert admin.put(api(f"/ads/studio/drafts/{d['id']}/image"), content=PNG, headers={"content-type": "image/png"}).status_code == 409
    assert admin.delete(api(f"/ads/studio/drafts/{d['id']}")).status_code == 409

    # Activation needs the daily budget confirmed.
    bad = admin.post(api(f"/ads/studio/drafts/{d['id']}/activate"), json={"confirmDailyBudget": 4000})
    assert bad.status_code == 422 and bad.json()["error"]["details"]["dailyBudget"] == 400
    meta.requests.clear()
    act = admin.post(api(f"/ads/studio/drafts/{d['id']}/activate"), json={"confirmDailyBudget": 400})
    assert act.status_code == 200 and act.json()["status"] == "active" and act.json()["activatedAt"]
    assert [(x[1], x[2]) for x in meta.requests] == [(i, {"status": "ACTIVE"}) for i in ("id_campaigns", "id_adsets", "id_ads")]
    assert admin.post(api(f"/ads/studio/drafts/{d['id']}/activate"), json={"confirmDailyBudget": 400}).status_code == 409

    ins = admin.get(api(f"/ads/studio/drafts/{d['id']}/insights")).json()
    assert ins["available"] and ins["source"] == "live" and ins["metrics"]["leads"] == 3 and ins["metrics"]["cpa"] == 50
    assert [a["action"] for a in ins["advice"]] == ["increase_budget"]
    with Session(bind=connection) as s:
        row = s.scalar(select(AdsStudioDraft).where(AdsStudioDraft.id == d["id"]))
        assert row.status == "active" and row.created_by_member_id == "usr-rahul"


def test_failed_live_publish_is_recorded_with_leftovers(studio):
    meta = FakeMeta(fail_on="adcreatives")
    owner = studio(meta=meta, **LIVE)
    d = make_draft(owner, targeting={"districts": [], "villageCodes": []})
    owner.put(api(f"/ads/studio/drafts/{d['id']}/image"), content=PNG, headers={"content-type": "image/png"})
    r = owner.post(api(f"/ads/studio/drafts/{d['id']}/publish"))
    assert r.status_code == 200
    out = r.json()
    assert out["status"] == "failed" and out["mode"] == "live" and out["canActivate"] is False
    assert "Already created (paused, no spend)" in out["error"] and TOKEN not in out["error"]
    assert out["metaIds"]["campaignId"] == "id_campaigns" and out["metaIds"]["adId"] is None
    assert owner.post(api(f"/ads/studio/drafts/{d['id']}/activate"), json={"confirmDailyBudget": 400}).status_code == 409
