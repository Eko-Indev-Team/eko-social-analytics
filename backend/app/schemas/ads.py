"""Ads module API schemas (camelCase JSON). Lead PII fields are null / masked for roles without ``ads:leads``."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import Field, model_validator

from .base import ApiModel


QualificationStatus = Literal["sbi_strong", "esaf_strong", "esaf_pitch", "needs_info", "not_qualified"]
LeadStatusFilter = Literal["all", "pincode", "qualified", "sbi_strong", "esaf_strong", "esaf_pitch", "needs_info", "not_qualified"]


class AdsJobRef(ApiModel):
    id: str
    status: str
    kind: str


class AdsStatusOut(ApiModel):
    configured: bool
    signups_configured: bool
    studio_publish_configured: bool
    last_synced_at: datetime | None
    last_sync_status: str | None
    last_error_code: str | None
    last_error_message: str | None
    token_expired: bool
    current_job: AdsJobRef | None
    ad_count: int
    lead_count: int
    can_sync: bool
    can_see_leads: bool


class AdsSyncIn(ApiModel):
    kind: Literal["meta", "signups"] = "meta"


class AdsSyncOut(ApiModel):
    job_id: str
    status: str
    kind: str
    deduplicated: bool


class AdsSummaryOut(ApiModel):
    spend: float
    impressions: int
    reach: int
    clicks: int
    link_clicks: int
    landing_page_views: int
    leads: int
    pincode_qualified_leads: int
    qualified_leads: int
    website_signups: int
    strong_signups: int
    ad_count: int
    active_ad_count: int
    completed_ad_count: int
    # Leads per qualification status (sbi_strong, esaf_strong, esaf_pitch, needs_info, not_qualified).
    qualification_counts: dict[str, int]
    cost_per_lead: float | None
    cost_per_qualified_lead: float | None
    currency: str = "INR"


class AdCreativeOut(ApiModel):
    type: str
    primary_text: str
    headline: str
    description: str
    cta: str
    image_hash: str | None
    image_url: str | None
    image_type: str | None


class AdMetricsOut(ApiModel):
    impressions: int
    reach: int
    clicks: int
    ctr: float
    cpc: float
    cpm: float
    spend: float
    link_clicks: int
    landing_page_views: int
    leads: int


class AdLeadCountsOut(ApiModel):
    total: int
    pincode_qualified: int
    qualified: int


class AdTargetingOut(ApiModel):
    locations: list[str]
    pincode_count: int
    interests_behaviors: str | None
    age_range: str | None
    genders: str | None
    placements: list[str]
    advantage_audience: bool | None
    restored_from_db: bool
    pincode_check_ok: bool


class AdTargetingDetailOut(AdTargetingOut):
    pincodes: list[str]
    categories: dict[str, list[str]]
    suggested_age_range: Any = None


class AdRowOut(ApiModel):
    id: str
    campaign_id: str
    campaign_name: str | None
    ad_name: str | None
    account_name: str | None
    status: str | None
    objective: str | None
    channel: Literal["lead_form", "website", "other"]
    created_time: str | None
    first_impression_date: str | None
    first_impression_hour: str | None
    creative: AdCreativeOut
    metrics: AdMetricsOut
    lead_counts: AdLeadCountsOut
    targeting: AdTargetingOut


class BreakdownRowOut(ApiModel):
    age: str | None = None
    gender: str | None = None
    publisher_platform: str | None = None
    platform_position: str | None = None
    region: str | None = None
    impressions: int
    reach: int
    clicks: int
    spend: float
    leads: int


class AdBreakdownsOut(ApiModel):
    age_gender: list[BreakdownRowOut]
    platform: list[BreakdownRowOut]
    region: list[BreakdownRowOut]


class AdDetailOut(AdRowOut):
    targeting: AdTargetingDetailOut
    breakdowns: AdBreakdownsOut
    lead_form_id: str | None


class LeadAnswerOut(ApiModel):
    question: str
    answer: str


class AdLeadOut(ApiModel):
    id: str
    ad_id: str | None
    ad_name: str | None
    campaign_name: str | None
    created_time: str | None
    name: str | None
    phone: str | None
    submitted_pincode: str | None
    pincode_qualified: bool | None
    passes_screening: bool
    qualified: bool
    qualification_status: QualificationStatus
    sbi_reasons: list[str]
    pincode_match: bool | None
    education_level: str | None
    education_ok: bool | None
    can_invest: bool | None
    esaf_response: Literal["yes", "no"] | None
    esaf_response_source: Literal["form", "staff"] | None
    answers: list[LeadAnswerOut] | None


class AdLeadPatchIn(ApiModel):
    """PATCH /ads/leads/{leadId}: staff record the answer to the ESAF pitch (null = clear, back to the lead form's answer)."""

    model_config = ApiModel.model_config | {"extra": "forbid"}
    esaf_response: Literal["yes", "no"] | None

    @model_validator(mode="after")
    def _present(self) -> AdLeadPatchIn:
        if "esaf_response" not in self.model_fields_set:
            raise ValueError("Provide esafResponse (\"yes\", \"no\" or null)")
        return self


class CreativeLabelOut(ApiModel):
    image_hash: str
    image_type: str | None
    ad_ids: list[str] = Field(default_factory=list)
    image_url: str | None = None


class CreativeLabelIn(ApiModel):
    image_type: str | None = Field(default=None, max_length=300)
