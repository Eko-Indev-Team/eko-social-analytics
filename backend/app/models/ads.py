"""Ads module (port of the AdMarketer Flask app): Meta paid ads, lead-form leads, creatives, website signups,
reference datasets, sync runs and Ad Studio drafts.

Every table is workspace-owned (the tenant filter in ``app.core.tenancy`` applies) and holds data for exactly one
workspace — the one that owns the Meta / Eko credentials configured in ``backend/.env``. Provider identifiers
(Meta ``ad_id``, ``campaign_id``, lead ids, signup ids) are unique *per workspace*, never globally.

PII lives only in ``ads_leads`` (answers, name, phone) and ``ads_website_signups`` (mobile, name, shop address);
the API masks those columns for roles without the ``ads:leads`` permission.

The report builders never read these models directly — they use the dict shapes returned by
``app.services.ads.records`` (identical to AdMarketer's in-memory records).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, LargeBinary, String, Text, UniqueConstraint,
    func, text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, WorkspaceOwned

AD_CHANNELS = ("lead_form", "website", "other")
SYNC_KINDS = ("meta", "signups")
SYNC_STATUSES = ("queued", "running", "succeeded", "failed")
ACTIVE_SYNC_STATUSES = ("queued", "running")
QUALIFICATION_STATUSES = ("sbi_strong", "esaf_strong", "esaf_pitch", "needs_info", "not_qualified")
QUALIFICATION_CHECK = "qualification_status IN ('sbi_strong', 'esaf_strong', 'esaf_pitch', 'needs_info', 'not_qualified')"


class AdsMetaAd(WorkspaceOwned, TimestampMixin, Base):
    """One Meta ad (AdMarketer practice: one campaign = one ad). Rows are upserted by a successful pull and are
    never deleted by a failed or empty one. Metric/creative/breakdown/targeting payloads keep AdMarketer's
    ad-record field names so ``records.load_ad_records`` can rebuild the exact record dict."""

    __tablename__ = "ads_meta_ads"
    __table_args__ = (
        UniqueConstraint("workspace_id", "ad_id"),
        CheckConstraint("channel IN ('lead_form', 'website', 'other')", name="channel_values"),
        Index("ix_ads_meta_ads_workspace_campaign", "workspace_id", "campaign_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ad_id: Mapped[str] = mapped_column(String(64))
    account_id: Mapped[str | None] = mapped_column(String(64))
    account_name: Mapped[str | None] = mapped_column(String(300))
    campaign_id: Mapped[str] = mapped_column(String(64))
    campaign_name: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(String(64))
    objective: Mapped[str | None] = mapped_column(String(64))
    channel: Mapped[str] = mapped_column(String(16), server_default="other")
    # Meta's own ISO strings (e.g. "2026-08-27T12:01:02+0530"), kept verbatim: the report builders slice them.
    created_time: Mapped[str | None] = mapped_column(String(40))
    first_impression_date: Mapped[str | None] = mapped_column(String(10))
    first_impression_hour: Mapped[str | None] = mapped_column(String(16))
    ad_name: Mapped[str | None] = mapped_column(Text)
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
    creative: Mapped[dict[str, Any]] = mapped_column(server_default=text("'{}'::jsonb"))
    metrics: Mapped[dict[str, Any]] = mapped_column(server_default=text("'{}'::jsonb"))
    breakdowns: Mapped[dict[str, Any]] = mapped_column(server_default=text("'{}'::jsonb"))
    # AdMarketer's ``targeting_summary`` with ``targeted_pincodes`` stored as a sorted list.
    targeting: Mapped[dict[str, Any]] = mapped_column(server_default=text("'{}'::jsonb"))
    lead_form_id: Mapped[str | None] = mapped_column(String(64))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AdsTargetingRecord(WorkspaceOwned, TimestampMixin, Base):
    """Durable per-campaign targeting (port of ``ad_targeted_pincodes.json``). The only record of what old ads
    targeted: the sync upserts it only from a *successful* targeting fetch and never deletes it."""

    __tablename__ = "ads_targeting_records"
    __table_args__ = (UniqueConstraint("workspace_id", "campaign_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    campaign_id: Mapped[str] = mapped_column(String(64))
    campaign_name: Mapped[str | None] = mapped_column(Text)
    ad_name: Mapped[str | None] = mapped_column(Text)
    account_name: Mapped[str | None] = mapped_column(String(300))
    pincodes: Mapped[list[Any]] = mapped_column(server_default=text("'[]'::jsonb"))
    locations: Mapped[list[Any]] = mapped_column(server_default=text("'[]'::jsonb"))
    interests_behaviors: Mapped[str] = mapped_column(Text, server_default="")
    setup: Mapped[dict[str, Any]] = mapped_column(server_default=text("'{}'::jsonb"))


class AdsLead(WorkspaceOwned, TimestampMixin, Base):
    """A lead-form submission (**PII**: answers, name, phone). ``ad_id`` is the ad the lead was *assigned* to by
    the shared-form reconstruction (NULL = fetched from a shared form but not attributed to any ad)."""

    __tablename__ = "ads_leads"
    __table_args__ = (
        UniqueConstraint("workspace_id", "meta_lead_id"),
        Index("ix_ads_leads_workspace_ad", "workspace_id", "ad_id"),
        CheckConstraint("esaf_response IS NULL OR esaf_response IN ('yes', 'no')", name="esaf_values"),
        CheckConstraint("esaf_response_source IS NULL OR esaf_response_source IN ('form', 'staff')", name="esaf_source_values"),
        CheckConstraint(QUALIFICATION_CHECK, name="qualification_values"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    meta_lead_id: Mapped[str] = mapped_column(String(64))
    ad_id: Mapped[str | None] = mapped_column(String(64))
    form_id: Mapped[str | None] = mapped_column(String(64))
    created_time: Mapped[str | None] = mapped_column(String(40))
    # {question label: answer text} exactly as AdMarketer builds it (labels from the form's questions).
    answers: Mapped[dict[str, Any]] = mapped_column(server_default=text("'{}'::jsonb"))
    name: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(64))
    submitted_pincode: Mapped[str | None] = mapped_column(String(6))
    pincode_qualified: Mapped[bool | None] = mapped_column(Boolean)
    # = can_invest AND education_ok (qualification rules of 2026-11-18); ``qualified`` = status sbi_strong / esaf_strong.
    passes_screening: Mapped[bool] = mapped_column(Boolean, server_default="false")
    qualified: Mapped[bool] = mapped_column(Boolean, server_default="false")
    # Qualification inputs (True / False / NULL = unknown) and outcome — see app.services.qualification.
    pincode_match: Mapped[bool | None] = mapped_column(Boolean)
    education_answer: Mapped[str | None] = mapped_column(Text)
    education_level: Mapped[str | None] = mapped_column(String(32))
    education_ok: Mapped[bool | None] = mapped_column(Boolean)
    can_invest: Mapped[bool | None] = mapped_column(Boolean)
    esaf_response: Mapped[str | None] = mapped_column(String(3))
    # "form" (lead-form answer) or "staff" (set after a call; wins over the form and survives syncs).
    esaf_response_source: Mapped[str | None] = mapped_column(String(8))
    qualification_status: Mapped[str] = mapped_column(String(16), server_default="needs_info", index=True)


class AdsCreative(WorkspaceOwned, TimestampMixin, Base):
    """Caption text and picture metadata each ad ran with (port of ``ad_creatives.json``). Text is never blanked
    by a thinner later read."""

    __tablename__ = "ads_creatives"
    __table_args__ = (UniqueConstraint("workspace_id", "ad_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ad_id: Mapped[str] = mapped_column(String(64))
    campaign_id: Mapped[str | None] = mapped_column(String(64))
    account_name: Mapped[str | None] = mapped_column(String(300))
    built: Mapped[str | None] = mapped_column(String(10))
    type: Mapped[str] = mapped_column(String(16), server_default="unknown")
    primary_text: Mapped[str] = mapped_column(Text, server_default="")
    headline: Mapped[str] = mapped_column(Text, server_default="")
    description: Mapped[str] = mapped_column(Text, server_default="")
    cta: Mapped[str] = mapped_column(String(64), server_default="")
    image_hash: Mapped[str] = mapped_column(String(128), server_default="")
    image_full: Mapped[bool] = mapped_column(Boolean, server_default="false")


class AdsCreativeImage(WorkspaceOwned, TimestampMixin, Base):
    """The ad's picture, downloaded because Meta's image links expire within days."""

    __tablename__ = "ads_creative_images"
    __table_args__ = (UniqueConstraint("workspace_id", "ad_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ad_id: Mapped[str] = mapped_column(String(64))
    content_type: Mapped[str] = mapped_column(String(32))
    byte_size: Mapped[int] = mapped_column(Integer)
    is_full: Mapped[bool] = mapped_column(Boolean, server_default="false")
    data: Mapped[bytes] = mapped_column(LargeBinary, deferred=True)


class AdsCreativeLabel(WorkspaceOwned, TimestampMixin, Base):
    """Hand label of a picture (``creative_labels.json``): image_hash → image_type."""

    __tablename__ = "ads_creative_labels"
    __table_args__ = (UniqueConstraint("workspace_id", "image_hash"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    image_hash: Mapped[str] = mapped_column(String(128))
    image_type: Mapped[str] = mapped_column(Text)


class AdsOptimization(WorkspaceOwned, TimestampMixin, Base):
    """What each campaign's ad set optimises for (``ad_optimization.json``; the sync also fills it)."""

    __tablename__ = "ads_optimization"
    __table_args__ = (UniqueConstraint("workspace_id", "campaign_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    campaign_id: Mapped[str] = mapped_column(String(64))
    optimization_goal: Mapped[str | None] = mapped_column(String(64))
    bid_strategy: Mapped[str | None] = mapped_column(String(64))
    pixel_id: Mapped[str | None] = mapped_column(String(64))
    custom_event_type: Mapped[str | None] = mapped_column(String(64))
    # Meta returns budgets as strings in the account currency's minor unit; kept verbatim.
    daily_budget: Mapped[str | None] = mapped_column(String(32))
    lifetime_budget: Mapped[str | None] = mapped_column(String(32))


class AdsWebsiteSignup(WorkspaceOwned, TimestampMixin, Base):
    """A signup from the Eko signup admin API, matched to an ad (**PII**: mobile, name, shop address)."""

    __tablename__ = "ads_website_signups"
    __table_args__ = (
        UniqueConstraint("workspace_id", "signup_id"),
        CheckConstraint("attribution_tier IN ('campaign_matched', 'fbclid_only', 'none')", name="tier_values"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    signup_id: Mapped[str] = mapped_column(String(64))
    mobile: Mapped[str | None] = mapped_column(String(64))
    name: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[str | None] = mapped_column(String(40))
    qualification_verdict: Mapped[str | None] = mapped_column(String(64))
    shop_address: Mapped[str | None] = mapped_column(Text)
    attribution_tier: Mapped[str] = mapped_column(String(32), server_default="none")
    matched_campaign_id: Mapped[str | None] = mapped_column(String(64))
    matched_campaign_name: Mapped[str | None] = mapped_column(Text)
    utm_source: Mapped[str] = mapped_column(Text, server_default="")
    utm_medium: Mapped[str] = mapped_column(Text, server_default="")
    utm_campaign: Mapped[str] = mapped_column(Text, server_default="")
    # Any further keys the signup fetcher returns (kept so the dict round-trips unchanged).
    extra: Mapped[dict[str, Any]] = mapped_column(server_default=text("'{}'::jsonb"))


class AdsReferenceDataset(WorkspaceOwned, TimestampMixin, Base):
    """Read-only reference data used by Ad Studio targeting (CSP / village / district locations). Not PII."""

    __tablename__ = "ads_reference_datasets"
    __table_args__ = (UniqueConstraint("workspace_id", "name"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64))
    source_file: Mapped[str | None] = mapped_column(String(200))
    row_count: Mapped[int] = mapped_column(Integer, server_default="0")
    data: Mapped[Any] = mapped_column(JSONB, deferred=True)


class AdsSyncRun(WorkspaceOwned, Base):
    """One Meta or signup sync (job + history). At most one queued/running run per workspace and kind (partial
    unique index), so repeated clicks and scheduler ticks cannot pile up. Error fields hold our own safe codes
    and redacted messages, never tokens or provider payloads."""

    __tablename__ = "ads_sync_runs"
    __table_args__ = (
        Index("uq_ads_sync_runs_one_active", "workspace_id", "kind", unique=True,
              postgresql_where=text("status IN ('queued', 'running')")),
        Index("ix_ads_sync_runs_workspace_kind_queued", "workspace_id", "kind", "queued_at"),
        CheckConstraint("kind IN ('meta', 'signups')", name="kind_values"),
        CheckConstraint("status IN ('queued', 'running', 'succeeded', 'failed')", name="status_values"),
        CheckConstraint("trigger IN ('manual', 'scheduled', 'import')", name="trigger_values"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    kind: Mapped[str] = mapped_column(String(16))
    trigger: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16))
    triggered_by_member_id: Mapped[str | None] = mapped_column(ForeignKey("team_members.id", ondelete="SET NULL"))
    queued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    counts: Mapped[dict[str, Any]] = mapped_column(server_default=text("'{}'::jsonb"))
    error_code: Mapped[str | None] = mapped_column(String(64))
    error_message: Mapped[str | None] = mapped_column(Text)


class AdsStudioDraft(WorkspaceOwned, TimestampMixin, Base):
    """An Ad Studio run: the brief, generated copy, targeting, guardrails, picture and the payload that would be
    (dry run) or was (live) sent to Meta, with the resulting Meta ids."""

    __tablename__ = "ads_studio_drafts"
    __table_args__ = (
        CheckConstraint("mode IN ('dry_run', 'live')", name="mode_values"),
        CheckConstraint("status IN ('draft', 'built', 'active', 'failed')", name="status_values"),
        Index("ix_ads_studio_drafts_workspace_created", "workspace_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    brief: Mapped[dict[str, Any]] = mapped_column(server_default=text("'{}'::jsonb"))
    copy: Mapped[dict[str, Any]] = mapped_column(server_default=text("'{}'::jsonb"))
    targeting: Mapped[dict[str, Any]] = mapped_column(server_default=text("'{}'::jsonb"))
    guardrails: Mapped[dict[str, Any]] = mapped_column(server_default=text("'{}'::jsonb"))
    image: Mapped[bytes | None] = mapped_column(LargeBinary, deferred=True)
    image_content_type: Mapped[str | None] = mapped_column(String(32))
    payload: Mapped[dict[str, Any]] = mapped_column(server_default=text("'{}'::jsonb"))
    # Anything else a run produces (insights snapshot, optimizer actions, …).
    result: Mapped[dict[str, Any]] = mapped_column(server_default=text("'{}'::jsonb"))
    mode: Mapped[str] = mapped_column(String(16), server_default="dry_run")
    status: Mapped[str] = mapped_column(String(16), server_default="draft")
    meta_ids: Mapped[dict[str, Any]] = mapped_column(server_default=text("'{}'::jsonb"))
    created_by_member_id: Mapped[str | None] = mapped_column(ForeignKey("team_members.id", ondelete="SET NULL"))
    error: Mapped[str | None] = mapped_column(Text)
