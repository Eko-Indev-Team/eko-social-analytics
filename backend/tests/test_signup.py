"""Self sign-up with Owner/Admin approval, and the email-domain restriction on sign-up, sign-in and invitations."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.main import create_app
from app.models import TeamMember, User

from .conftest import TEST_PASSWORD, UNREACHABLE_DB, api, make_settings

NEW_EMAIL = "new.joiner@eko.co.in"
STRONG = "Correct-Horse-Battery-42"


def restricted_app(connection, db_url: str, **overrides):
    overrides.setdefault("allowed_email_domains", ["eko.co.in"])
    overrides.setdefault("signup_workspace_id", "ws-eko-india")
    app = create_app(make_settings(db_url, **overrides))
    app.state.session_factory = sessionmaker(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    return app


@pytest.fixture
def eko_client(connection, db_url: str) -> Iterator[TestClient]:
    with TestClient(restricted_app(connection, db_url)) as test_client:
        yield test_client


def signup(client, email=NEW_EMAIL, password=STRONG, name="New Joiner"):
    return client.post(api("/auth/signup"), json={"name": name, "email": email, "password": password})


def login(client, email=NEW_EMAIL, password=STRONG):
    return client.post(api("/auth/login"), json={"email": email, "password": password})


def pending_member(db_session, email=NEW_EMAIL) -> TeamMember | None:
    return db_session.scalar(select(TeamMember).where(TeamMember.email == email))


# ------------------------------------------------------------------------------------------ settings
def test_allowed_domains_are_parsed_and_normalised():
    settings = make_settings(UNREACHABLE_DB, allowed_email_domains=" @Eko.co.in , partner.com ")
    assert settings.allowed_email_domains == ["eko.co.in", "partner.com"]
    assert settings.email_domain_allowed("Someone@EKO.co.in") and settings.email_domain_allowed("a@partner.com")
    assert not settings.email_domain_allowed("someone@eko.co.in.evil.com") and not settings.email_domain_allowed("x@gmail.com")
    assert make_settings(UNREACHABLE_DB, allowed_email_domains="").email_domain_allowed("x@gmail.com")  # empty = any domain


# ------------------------------------------------------------------------------------------ sign-up
def test_signup_rejects_other_domains(eko_client, db_session):
    response = signup(eko_client, email="someone@gmail.com")
    assert response.status_code == 403, response.text
    assert response.json()["error"]["message"] == "Only @eko.co.in email addresses can sign up."
    assert pending_member(db_session, "someone@gmail.com") is None


def test_signup_creates_a_pending_viewer_that_cannot_sign_in(eko_client, db_session):
    response = signup(eko_client)
    assert response.status_code == 202, response.text
    assert response.json()["status"] == "pending" and "approves" in response.json()["message"]
    member = pending_member(db_session)
    assert member is not None and member.status == "pending" and member.access == "Viewer" and member.workspace_id == "ws-eko-india"
    user = db_session.get(User, member.user_id)
    assert user.name == "New Joiner" and user.password_hash.startswith("$argon2id$") and STRONG not in user.password_hash

    blocked = login(eko_client)
    assert blocked.status_code == 403
    assert "waiting for approval" in blocked.json()["error"]["message"]
    assert "set-cookie" not in blocked.headers


def test_signup_does_not_reveal_existing_addresses(eko_client, db_session):
    first, again = signup(eko_client), signup(eko_client, password="Another-Strong-Pass-77")
    assert first.status_code == again.status_code == 202 and first.json() == again.json()
    assert len(db_session.scalars(select(TeamMember).where(TeamMember.email == NEW_EMAIL)).all()) == 1


def test_signup_enforces_the_password_policy(eko_client, db_session):
    response = signup(eko_client, password="short")
    assert response.status_code == 422 and response.json()["error"]["details"]["field"] == "password"
    assert pending_member(db_session) is None


def test_signup_can_be_disabled(connection, db_url):
    with TestClient(restricted_app(connection, db_url, signup_enabled=False)) as test_client:
        assert signup(test_client).status_code == 403


def test_signup_needs_a_target_workspace_when_several_exist(connection, db_url, db_session):
    from app.models import Workspace

    if len(db_session.scalars(select(Workspace)).all()) < 2:
        pytest.skip("the test database has a single workspace")
    with TestClient(restricted_app(connection, db_url, signup_workspace_id=None)) as test_client:
        response = signup(test_client)
    assert response.status_code == 403 and "not configured" in response.json()["error"]["message"]


# ------------------------------------------------------------------------------------------ approval
def test_owner_approves_a_signup_and_the_account_can_sign_in(eko_client, client, db_session):
    assert signup(eko_client).status_code == 202
    member = pending_member(db_session)
    approved = client.post(api(f"/workspace/members/{member.id}/approve"))
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "active" and approved.json()["access"] == "Viewer"
    signed_in = login(eko_client)
    assert signed_in.status_code == 200, signed_in.text
    assert signed_in.json()["role"] == "Viewer" and signed_in.json()["user"]["email"] == NEW_EMAIL


def test_only_pending_members_can_be_approved(client):
    response = client.post(api("/workspace/members/usr-rahul/approve"))
    assert response.status_code == 409


def test_viewers_cannot_approve(eko_client, viewer_client, db_session):
    assert signup(eko_client).status_code == 202
    member = pending_member(db_session)
    assert viewer_client.post(api(f"/workspace/members/{member.id}/approve")).status_code == 403
    assert pending_member(db_session).status == "pending"


def test_declining_removes_the_request_and_the_unused_account(eko_client, client, db_session):
    assert signup(eko_client).status_code == 202
    member = pending_member(db_session)
    user_id = member.user_id
    assert client.delete(api(f"/workspace/members/{member.id}")).status_code == 200
    db_session.expire_all()
    assert pending_member(db_session) is None and db_session.get(User, user_id) is None
    assert signup(eko_client).status_code == 202 and pending_member(db_session) is not None  # may apply again


# ------------------------------------------------------------------------------------------ domain restriction
def test_sign_in_is_restricted_to_allowed_domains(eko_client):
    response = login(eko_client, email="rahul.verma@eko.example", password=TEST_PASSWORD)
    assert response.status_code == 403
    assert response.json()["error"]["message"] == "Only @eko.co.in email addresses can sign in."


def test_invitations_are_restricted_to_allowed_domains(connection, db_url):
    from .conftest import sign_in

    app = restricted_app(connection, db_url)
    with TestClient(app) as test_client:
        owner = sign_in(app, test_client, connection, user_id="usr_test_usr-mansi")
        rejected = owner.post(api("/workspace/members"), json={"email": "friend@gmail.com", "access": "Viewer"})
        accepted = owner.post(api("/workspace/members"), json={"email": "colleague@eko.co.in", "access": "Viewer"})
    assert rejected.status_code == 422 and "@eko.co.in" in rejected.json()["error"]["message"]
    assert accepted.status_code == 201, accepted.text
