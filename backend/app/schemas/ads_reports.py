"""Response schemas for the Ads reports (Performance, Experiments, Signups, Overview). camelCase JSON.

Money values are plain numbers in INR (the frontend formats them); percentages are numbers 0-100.
Explanatory sentences and labels are text, kept word for word from AdMarketer.
"""

from __future__ import annotations

from typing import Literal

from app.schemas.base import ApiModel

Channel = Literal["Lead Form", "Website"]
Cell = str | int | float | None


class StatusCountsOut(ApiModel):
    """Lead-form leads per qualification status (rule of 2026-11-18). sbiStrong + esafStrong = "strongly qualified"."""

    sbi_strong: int
    esaf_strong: int
    esaf_pitch: int
    needs_info: int
    not_qualified: int


class StatusLabelsOut(ApiModel):
    sbi_strong: str
    esaf_strong: str
    esaf_pitch: str
    needs_info: str
    not_qualified: str


# ------------------------------------------------------------------------------------ performance
class PerfRowOut(ApiModel):
    ad_id: str
    campaign_id: str
    ad_name: str
    account: str
    status: str
    built: str
    channel: Channel
    spend: float
    impressions: int
    reach: int
    ctr: float | None
    link_clicks: int
    cpc: float | None
    landing_page_views: int
    cost_per_lpv: float | None
    results: int
    cost_per_result: float | None
    results_per_thousand_reach: float | None
    quality: int
    quality_rate: float | None
    cost_per_quality: float | None
    fully_qualified: int          # Lead Form: strongly qualified leads; Website: STRONG_QUALIFY signups
    status_counts: StatusCountsOut  # Lead Form leads per status (all zero for Website ads)
    n_pincodes: int
    target_states: list[str]
    geo_bucket: str
    audience_type: str
    audience_detail: str
    age_setting: str
    age_note: str
    gender_setting: str
    placement_setting: str
    interest_items: list[str]
    delivered_gender: str
    pincodes: list[str]
    categories: dict[str, list[str]]
    advantage_on: bool | None
    top_age: str


class SummaryOut(ApiModel):
    ads: int
    spend: float
    impressions: int
    link_clicks: int
    ctr: float | None
    results: int
    cost_per_result: float | None
    quality: int
    quality_rate: float | None
    cost_per_quality: float | None
    landing_page_views: int
    fully_qualified: int
    status_counts: StatusCountsOut


class GroupOut(SummaryOut):
    channel: Channel
    group: str
    bundle_size: int | None = None  # only on byInterest rows


class ChannelsOut(ApiModel):
    lead_form: SummaryOut
    website: SummaryOut


class DeliveryRowOut(ApiModel):
    group: str
    spend: float
    impressions: int
    ctr: float | None
    results: int
    cost_per_result: float | None
    share_of_spend: float


class DeliveryTableOut(ApiModel):
    channel: Channel
    dimension: Literal["age", "gender", "platform", "position"]
    rows: list[DeliveryRowOut]


class VerdictEntryOut(ApiModel):
    """A winning/losing group: a setup group (``delivery=false``: has ads/quality fields) or a delivery row
    (``delivery=true``: has shareOfSpend). Fields that do not apply are null."""

    group: str
    spend: float
    results: int
    cost_per_result: float | None
    ctr: float | None = None
    ads: int | None = None
    quality: int | None = None
    quality_rate: float | None = None
    cost_per_quality: float | None = None
    share_of_spend: float | None = None


class VerdictOut(ApiModel):
    channel: Channel
    dimension: str
    winner: VerdictEntryOut
    worst: VerdictEntryOut | None
    basis: str
    compared: int
    delivery: bool


class AwardsOut(ApiModel):
    best_overall: PerfRowOut | None
    cheapest_result: PerfRowOut | None
    most_results: PerfRowOut | None
    most_quality: PerfRowOut | None
    best_ctr: PerfRowOut | None
    cheapest_lpv: PerfRowOut | None


class StateOut(ApiModel):
    state: str
    spend: float
    impressions: int
    ctr: float | None
    leads: int
    cost_per_lead: float | None
    matched: int
    qualified: int
    status_counts: StatusCountsOut


class StateLeadsOut(ApiModel):
    state: str
    leads: int
    matched: int
    qualified: int


class WebsiteStateOut(ApiModel):
    state: str
    spend: float
    impressions: int
    ctr: float | None


class PincodeOut(ApiModel):
    pincode: str
    state: str | None
    ads: int
    est_spend: float
    matched: int
    qualified: int
    status_counts: StatusCountsOut  # over the matched leads from this pincode
    est_cost_per_match: float | None


class ThresholdsOut(ApiModel):
    min_results_for_cost_award: int
    min_quality_for_best_overall: int
    min_impressions_for_ctr_award: int
    min_lpv_for_lpv_award: int


class PerformanceOut(ApiModel):
    configured: bool
    signups_configured: bool
    has_data: bool
    rows: list[PerfRowOut]
    awards: AwardsOut
    channels: ChannelsOut
    verdicts: list[VerdictOut]
    by_age: list[GroupOut]
    by_gender: list[GroupOut]
    by_placement: list[GroupOut]
    by_interest: list[GroupOut]
    by_audience: list[GroupOut]
    by_geo: list[GroupOut]
    delivered: list[DeliveryTableOut]
    states: list[StateOut]
    leads_outside_delivery: list[StateLeadsOut]
    website_states: list[WebsiteStateOut]
    top_pincodes: list[PincodeOut]
    dead_pincodes: list[PincodeOut]
    pincodes_targeted: int
    unattributed_signups: int
    total_signups: int
    unknown_targeting: int
    min_quality: int
    min_results: int
    thresholds: ThresholdsOut
    status_labels: StatusLabelsOut


# ------------------------------------------------------------------------------------ experiments
VerdictCode = Literal["worked", "didnt", "mixed", "unclear", "notyet", "problem"]
ConfidenceLevel = Literal["High", "Medium", "Low"]


class TableColumnOut(ApiModel):
    label: str
    kind: Literal["text", "count", "money", "percent"]


class ExperimentOut(ApiModel):
    id: str
    title: str
    question: str
    did: str
    columns: list[TableColumnOut]
    rows: list[list[Cell]]
    learning: list[str]
    verdict: VerdictCode
    verdict_label: str
    confidence: ConfidenceLevel
    confidence_why: str
    dont_repeat: str | None
    best_row: int | None
    note: str | None


class MistakeOut(ApiModel):
    from_experiment: str
    experiment_id: str
    text: str


class IdeaOut(ApiModel):
    priority: Literal["High", "Medium", "Low"]
    title: str
    basis: str
    why: str
    how: str
    measure: str
    effort: str
    as_of: str | None


class IdeaGroupOut(ApiModel):
    name: str
    intro: str
    as_of: str | None
    items: list[IdeaOut]


class CreativeGroupOut(ApiModel):
    channel: Channel
    ad_id: str
    ads: int
    spend: float
    results: int
    cost_per_result: float | None
    quality: int
    quality_rate: float | None
    cost_per_quality: float | None
    has_image: bool
    image_url: str | None
    primary_text: str
    headline: str
    cta: str
    type: str
    image_type: str
    built: str


class TraitTableOut(ApiModel):
    title: str
    columns: list[TableColumnOut]
    rows: list[list[Cell]]


class CreativeAnalysisOut(ApiModel):
    pending: bool
    n_ads: int
    n_covered: int
    groups: list[CreativeGroupOut]
    trait_tables: list[TraitTableOut]
    verdict: VerdictCode
    verdict_label: str
    learning: list[str]
    confidence: ConfidenceLevel
    confidence_why: str


class CompetitorOut(ApiModel):
    who: str
    does: str
    means: str
    url: str
    label: str


class ExperimentsOut(ApiModel):
    configured: bool
    signups_configured: bool
    has_data: bool
    experiments: list[ExperimentOut]
    mistakes: list[MistakeOut]
    idea_groups: list[IdeaGroupOut]
    n_ideas: int
    verdict_counts: dict[str, int]
    verdict_names: dict[str, str]
    creative: CreativeAnalysisOut
    competitors: list[CompetitorOut]
    competitor_caveats: list[str]
    competitors_as_of: str
    competitors_as_of_note: str
    lead_status_counts: StatusCountsOut
    status_labels: StatusLabelsOut


# ------------------------------------------------------------------------------------ signups
AttributionTier = Literal["campaign_matched", "fbclid_only", "none"]


class SignupOut(ApiModel):
    id: str | None
    name: str | None          # null without ads:leads
    mobile: str | None        # "•••••• 1234" without ads:leads
    shop_address: str | None  # null without ads:leads
    submitted_at: str | None
    qualification_verdict: str
    attribution_tier: AttributionTier
    matched_campaign_id: str | None
    matched_campaign_name: str | None
    utm_source: str
    utm_medium: str
    utm_campaign: str


class SignupTotalsOut(ApiModel):
    total_signups: int
    campaign_matched: int
    fbclid_only: int
    not_facebook: int
    facebook_attributed: int
    strong_qualify: int
    facebook_lead_form_leads: int


class SignupsOut(ApiModel):
    signups_configured: bool
    configured: bool
    has_ad_data: bool
    pii_visible: bool
    tier: AttributionTier | None
    verdict: str | None
    totals: SignupTotalsOut
    signups: list[SignupOut]


# ------------------------------------------------------------------------------------ overview
class OverviewOut(ApiModel):
    configured: bool
    signups_configured: bool
    has_ad_data: bool
    form_leads: int
    form_qualified: int
    form_status_counts: StatusCountsOut
    status_labels: StatusLabelsOut
    form_pincode_qualified: int
    form_pincode_checkable: int
    url_signups_total: int
    url_signups_facebook: int
    url_strong_qualify: int
    url_not_qualify: int
    overall_total: int
