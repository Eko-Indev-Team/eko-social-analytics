"""Ad Studio request/response schemas (camelCase JSON). Contract documented in the ads-studio API note for the frontend.

Meta request bodies (``payload``, ``metaTargeting``) are passed through as-is: their keys are Meta's (snake_case).
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from .base import ApiModel

Angle = Literal["general_opportunity", "women_first", "shop_owner"]
Objective = Literal["leads", "sales", "traffic", "awareness", "engagement"]
Gender = Literal["all", "male", "female"]
Placements = Literal["advantage", "manual"]
CopySource = Literal["locked_caption", "ai", "locked_caption_fallback", "custom"]


# ------------------------------------------------------------------------------------------------- inputs
class BriefIn(ApiModel):
    product: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=600)
    objective: Objective = "leads"
    tone: str | None = Field(default=None, max_length=120)
    visual_style: str | None = Field(default=None, max_length=160)
    language: Literal["hindi", "english"] = "hindi"
    angle: Angle = "general_opportunity"


class CopyRequestIn(ApiModel):
    mode: Literal["locked", "generate"] = "locked"
    caption_index: int | None = Field(default=None, ge=1, le=5)
    brief: BriefIn = Field(default_factory=BriefIn)


class AdCopyIn(ApiModel):
    headline_line1: str = Field(min_length=1, max_length=120)
    headline_line2: str = Field(default="", max_length=120)
    subheading: str = Field(default="", max_length=200)
    primary_text: str = Field(min_length=1, max_length=500)
    description: str = Field(default="", max_length=200)
    bullets: list[str] = Field(default_factory=list, max_length=6)
    cta_text: str = Field(min_length=1, max_length=60)
    headline: str | None = Field(default=None, max_length=200)
    source: CopySource = "custom"
    caption_index: int | None = Field(default=None, ge=1, le=5)
    ai_model: str | None = Field(default=None, max_length=120)


class TargetingIn(ApiModel):
    districts: list[str] = Field(default_factory=list, max_length=60)
    village_codes: list[str] = Field(default_factory=list, max_length=500)
    age_min: int = Field(default=21, ge=18, le=65)
    age_max: int = Field(default=45, ge=18, le=65)
    gender: Gender = "all"
    daily_budget: float = Field(default=500, gt=0, le=1_000_000)
    schedule_days: int = Field(default=7, ge=1, le=90)
    placements: Placements = "advantage"


class DestinationIn(ApiModel):
    url: str | None = Field(default=None, max_length=500)
    number: str | None = Field(default=None, max_length=30, pattern=r"^[0-9+()\- ]*$")


class DraftCreateIn(ApiModel):
    brief: BriefIn = Field(default_factory=BriefIn)
    copy_: AdCopyIn = Field(alias="copy")
    targeting: TargetingIn = Field(default_factory=TargetingIn)
    destination: DestinationIn = Field(default_factory=DestinationIn)
    target_cpa: float | None = Field(default=150, gt=0, le=1_000_000)


class ActivateIn(ApiModel):
    confirm_daily_budget: float = Field(gt=0)


# ------------------------------------------------------------------------------------------------ outputs
class OptionItem(ApiModel):
    id: str
    label: str
    description: str | None = None


class CtaOut(ApiModel):
    text: str
    meta_type: str


class LockedCaptionOut(ApiModel):
    index: int
    text: str
    hook: str
    body: str
    cta_text: str
    cta: str


class DistrictOut(ApiModel):
    name: str
    state: str | None
    anchor_count: int
    village_count: int
    sources: list[str]
    excluded: bool
    excluded_reason: str | None


class VillageOut(ApiModel):
    code: str
    village: str | None
    tehsil: str | None
    district: str
    state: str | None
    pincode: str | None
    pincode_match_level: str | None


class InstagramPublishAccountOut(ApiModel):
    id: str
    username: str


class PublishIn(ApiModel):
    # Publish with this connected Instagram account's token (Instagram placements only); omitted = the server token.
    instagram_account_id: str | None = Field(default=None, max_length=64, pattern=r"^igc_[a-f0-9]+$")


class CapabilitiesOut(ApiModel):
    ai_copy: bool
    ai_provider: str | None
    image_generation: bool
    image_provider: str
    image_upload: bool
    max_image_bytes: int
    accepted_image_types: list[str]
    live_publish: bool
    live_publish_missing: list[str]
    # Connected Instagram accounts (Meta Unified login, ads_management) that can publish ads with their own token.
    instagram_publish_accounts: list[InstagramPublishAccountOut] = []
    can_edit: bool
    can_publish: bool


class StudioDefaultsOut(ApiModel):
    brief: dict[str, Any]
    targeting: dict[str, Any]
    destination_url: str
    target_cpa: float


class StudioOptionsOut(ApiModel):
    angles: list[OptionItem]
    ctas: list[CtaOut]
    banned_phrases: list[str]
    locked_captions: list[LockedCaptionOut]
    objectives: list[OptionItem]
    genders: list[str]
    placements: list[str]
    languages: list[str]
    districts: list[DistrictOut]
    reference_data_loaded: bool
    defaults: StudioDefaultsOut
    capabilities: CapabilitiesOut
    notes: list[str]


class CopyGuardrailsOut(ApiModel):
    ok: bool
    violations: list[str]
    removed_phrases: list[str]
    cta_replaced: bool


class AdCopyOut(ApiModel):
    headline_line1: str
    headline_line2: str
    subheading: str
    primary_text: str
    description: str
    bullets: list[str]
    cta_text: str
    cta: str
    headline: str
    angle: str
    source: CopySource
    caption_index: int | None
    ai_model: str | None
    note: str | None
    guardrails: CopyGuardrailsOut


class AnchorOut(ApiModel):
    district: str
    tehsil: str | None
    anchor: str | None
    state: str | None
    lat: float
    lon: float
    radius_km: float
    match_precision: str | None
    source: str


class TargetingOut(ApiModel):
    districts: list[str]
    removed: list[str]
    anchors: list[AnchorOut]
    villages: list[VillageOut]
    pincodes: list[str]
    unresolved_districts: list[str]
    age_min: int
    age_max: int
    gender: str
    daily_budget: float
    schedule_days: int
    placements: str
    meta_targeting: dict[str, Any]
    notes: list[str]


class DestinationOut(ApiModel):
    type: str
    url: str
    number: str | None


class DraftGuardrailsOut(ApiModel):
    max_daily_spend: float | None
    target_cpa: float | None


class MetaIdsOut(ApiModel):
    campaign_id: str | None = None
    ad_set_id: str | None = None
    image_hash: str | None = None
    creative_id: str | None = None
    ad_id: str | None = None


class DraftSummaryOut(ApiModel):
    id: str
    status: Literal["draft", "built", "active", "failed"]
    mode: Literal["dry_run", "live"]
    created_at: str
    updated_at: str
    created_by_name: str | None
    headline: str
    angle: str
    objective: str
    copy_source: str
    districts: list[str]
    pincode_count: int
    daily_budget: float
    has_image: bool
    image_url: str | None
    meta_ids: MetaIdsOut
    error: str | None


class DraftOut(DraftSummaryOut):
    brief: dict[str, Any]
    copy_: AdCopyOut = Field(alias="copy")
    targeting: TargetingOut
    destination: DestinationOut
    guardrails: DraftGuardrailsOut
    image_source: str | None
    payload: dict[str, Any]
    can_publish: bool
    can_activate: bool
    # "@username" when published with an Instagram account's token, "server" for the META_ADS_* token, None for a dry run.
    published_with: str | None = None
    published_at: str | None
    activated_at: str | None
    notes: list[str]


class AdviceOut(ApiModel):
    action: Literal["pause", "increase_budget", "flag_fatigue", "hold"]
    reason: str
    tone: Literal["good", "warn"]
    text: str


class InsightMetricsOut(ApiModel):
    reach: int
    impressions: int
    frequency: float
    clicks: int
    ctr: float
    cpc: float
    cpm: float
    spend: float
    leads: int
    cpa: float | None


class DraftInsightsOut(ApiModel):
    draft_id: str
    mode: str
    available: bool
    source: Literal["live", "none"]
    metrics: InsightMetricsOut | None
    advice: list[AdviceOut]
    guardrails: DraftGuardrailsOut
    fetched_at: str | None
    note: str
