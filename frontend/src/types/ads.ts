/** Ads module (Meta / Facebook + Instagram paid ads). Mirrors backend `app/schemas/ads.py` (camelCase). */
import type { EsafResponse, QualificationStatus, SbiReason } from '@/lib/qualification';

export type { EsafResponse, QualificationStatus, SbiReason };

export type QualificationCounts = Record<QualificationStatus, number>;

export type AdsErrorCode = 'TOKEN_EXPIRED' | 'meta_error' | 'empty_pull' | 'not_configured' | 'signups_error' | 'worker_lost' | 'internal_error';

/** GET /ads/status */
export interface AdsStatus {
  configured: boolean;
  signupsConfigured: boolean;
  studioPublishConfigured: boolean;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
  lastErrorCode: AdsErrorCode | string | null;
  lastErrorMessage: string | null;
  tokenExpired: boolean;
  currentJob: { id: string; status: string; kind: string } | null;
  adCount: number;
  leadCount: number;
  canSync: boolean;
  canSeeLeads: boolean;
}

/** POST /ads/sync → 202 */
export interface AdsSyncResult {
  jobId: string;
  status: string;
  kind: string;
  deduplicated: boolean;
}

/** GET /ads/summary */
export interface AdsSummary {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  landingPageViews: number;
  leads: number;
  pincodeQualifiedLeads: number;
  qualifiedLeads: number;
  websiteSignups: number;
  strongSignups: number;
  adCount: number;
  activeAdCount: number;
  completedAdCount: number;
  qualificationCounts: QualificationCounts;
  costPerLead: number | null;
  costPerQualifiedLead: number | null;
  currency: string;
}

export type AdChannel = 'lead_form' | 'website' | 'other';

export interface AdCreative {
  type: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  imageHash: string | null;
  /** `/api/v1/ads/{id}/image` when a stored picture exists (API mode), a local path in demo mode, else null. */
  imageUrl: string | null;
  imageType: string | null;
}

export interface AdMetrics {
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  spend: number;
  linkClicks: number;
  landingPageViews: number;
  leads: number;
}

export interface AdTargeting {
  locations: string[];
  pincodeCount: number;
  interestsBehaviors: string | null;
  ageRange: string | null;
  genders: string | null;
  placements: string[];
  advantageAudience: boolean | null;
  restoredFromDb: boolean;
  pincodeCheckOk: boolean;
}

/** GET /ads → AdRow[] */
export interface AdRow {
  id: string;
  campaignId: string;
  campaignName: string | null;
  adName: string | null;
  accountName: string | null;
  status: string | null;
  objective: string | null;
  channel: AdChannel;
  createdTime: string | null;
  firstImpressionDate: string | null;
  firstImpressionHour: string | null;
  creative: AdCreative;
  metrics: AdMetrics;
  leadCounts: { total: number; pincodeQualified: number; qualified: number };
  targeting: AdTargeting;
}

export interface AdBreakdownRow {
  age?: string | null;
  gender?: string | null;
  publisherPlatform?: string | null;
  platformPosition?: string | null;
  region?: string | null;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  leads: number;
}

/** GET /ads/{adId} */
export interface AdDetail extends Omit<AdRow, 'targeting'> {
  targeting: AdTargeting & { pincodes: string[]; categories: Record<string, string[]>; suggestedAgeRange?: unknown };
  breakdowns: { ageGender: AdBreakdownRow[]; platform: AdBreakdownRow[]; region: AdBreakdownRow[] };
  leadFormId: string | null;
}

/** GET /ads/leads, GET /ads/{adId}/leads. `name`/`answers` are null and `phone` masked without `ads:leads`. */
export interface AdLead {
  id: string;
  adId: string | null;
  adName: string | null;
  campaignName: string | null;
  createdTime: string | null;
  name: string | null;
  phone: string | null;
  submittedPincode: string | null;
  pincodeQualified: boolean | null;
  passesScreening: boolean;
  qualified: boolean;
  qualificationStatus: QualificationStatus;
  sbiReasons: SbiReason[];
  pincodeMatch: boolean | null;
  educationLevel: string | null;
  educationOk: boolean | null;
  canInvest: boolean | null;
  esafResponse: EsafResponse;
  esafResponseSource: 'form' | 'staff' | null;
  answers: Array<{ question: string; answer: string }> | null;
}

export type AdLeadStatusFilter = 'all' | 'pincode' | 'qualified' | QualificationStatus;

export interface AdLeadQuery {
  adId?: string;
  status?: AdLeadStatusFilter;
  q?: string;
}

/** GET /ads/creative-labels */
export interface CreativeLabel {
  imageHash: string;
  imageType: string | null;
  adIds: string[];
  imageUrl: string | null;
}
