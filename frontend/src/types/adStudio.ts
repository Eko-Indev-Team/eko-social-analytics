/**
 * Ad Studio (/ads/studio/...). Mirrors backend/app/schemas/ads_studio.py.
 * Meta request bodies (`payload`, `metaTargeting`) keep Meta's own snake_case keys.
 */

export type StudioAngle = 'general_opportunity' | 'women_first' | 'shop_owner';
export type StudioObjective = 'leads' | 'sales' | 'traffic' | 'awareness' | 'engagement';
export type CopySource = 'locked_caption' | 'ai' | 'locked_caption_fallback' | 'custom';
export type DraftStatus = 'draft' | 'built' | 'active' | 'failed';
export type DraftMode = 'dry_run' | 'live';
export type StudioGender = 'all' | 'male' | 'female';
export type StudioPlacements = 'advantage' | 'manual';
export type StudioLanguage = 'hindi' | 'english';

export interface CopyGuardrails {
  ok: boolean;
  violations: string[];
  removedPhrases: string[];
  ctaReplaced: boolean;
}

export interface AdCopy {
  headlineLine1: string;
  headlineLine2: string;
  subheading: string;
  primaryText: string;
  description: string;
  bullets: string[];
  ctaText: string;
  cta: string;
  headline: string;
  angle: string;
  source: CopySource;
  captionIndex: number | null;
  aiModel: string | null;
  note: string | null;
  guardrails: CopyGuardrails;
}

export interface StudioVillage {
  code: string;
  village: string | null;
  tehsil: string | null;
  district: string;
  state: string | null;
  pincode: string | null;
  pincodeMatchLevel: 'village' | 'tehsil' | 'district' | null;
}

export interface StudioAnchor {
  district: string;
  tehsil: string | null;
  anchor: string | null;
  state: string | null;
  lat: number;
  lon: number;
  radiusKm: number;
  matchPrecision: string | null;
  source: string;
}

export interface StudioTargeting {
  districts: string[];
  removed: string[];
  anchors: StudioAnchor[];
  villages: StudioVillage[];
  pincodes: string[];
  unresolvedDistricts: string[];
  ageMin: number;
  ageMax: number;
  gender: StudioGender | string;
  dailyBudget: number;
  scheduleDays: number;
  placements: StudioPlacements | string;
  metaTargeting: Record<string, unknown>;
  notes: string[];
}

export interface MetaIds {
  campaignId: string | null;
  adSetId: string | null;
  imageHash: string | null;
  creativeId: string | null;
  adId: string | null;
}

export interface DraftSummary {
  id: string;
  status: DraftStatus;
  mode: DraftMode;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
  headline: string;
  angle: string;
  objective: string;
  copySource: CopySource;
  districts: string[];
  pincodeCount: number;
  dailyBudget: number;
  hasImage: boolean;
  imageUrl: string | null;
  metaIds: MetaIds;
  error: string | null;
}

export interface DraftBrief {
  product: string;
  description: string;
  objective: StudioObjective | string;
  tone: string;
  visual_style: string;
  language: StudioLanguage | string;
  angle: StudioAngle | string;
}

export interface DraftPayload {
  campaign: Record<string, unknown>;
  ad_set: Record<string, unknown>;
  ad_creative: Record<string, unknown>;
  ad: Record<string, unknown>;
  ad_image?: { upload: string | null };
  review: {
    unresolved_districts: string[];
    placements: string;
    schedule_days: number;
    schedule_note: string;
    call_whatsapp_number: string | null;
  };
}

export interface Draft extends DraftSummary {
  brief: DraftBrief;
  copy: AdCopy;
  targeting: StudioTargeting;
  destination: { type: string; url: string; number: string | null };
  guardrails: { maxDailySpend: number | null; targetCpa: number | null };
  imageSource: 'upload' | 'pollinations' | null;
  payload: DraftPayload;
  canPublish: boolean;
  canActivate: boolean;
  publishedAt: string | null;
  activatedAt: string | null;
  /** "@username", "server" (the server's Meta token), or null for a dry run. */
  publishedWith: string | null;
  notes: string[];
}

export interface InsightAdvice {
  action: 'pause' | 'increase_budget' | 'flag_fatigue' | 'hold' | string;
  reason: string;
  tone: 'good' | 'warn' | string;
  text: string;
}

export interface DraftInsights {
  draftId: string;
  mode: DraftMode;
  available: boolean;
  source: 'live' | 'none';
  metrics: {
    reach: number;
    impressions: number;
    frequency: number;
    clicks: number;
    ctr: number;
    cpc: number;
    cpm: number;
    spend: number;
    leads: number;
    cpa: number | null;
  } | null;
  advice: InsightAdvice[];
  guardrails: { maxDailySpend: number | null; targetCpa: number | null };
  fetchedAt: string | null;
  note: string;
}

export interface StudioOptionItem {
  id: string;
  label: string;
  description: string | null;
}

export interface StudioDistrict {
  name: string;
  state: string | null;
  anchorCount: number;
  villageCount: number;
  sources: string[];
  excluded: boolean;
  excludedReason: string | null;
}

export interface LockedCaption {
  index: number;
  text: string;
  hook: string;
  body: string;
  ctaText: string;
  cta: string;
}

export interface StudioOptions {
  angles: StudioOptionItem[];
  ctas: { text: string; metaType: string }[];
  bannedPhrases: string[];
  lockedCaptions: LockedCaption[];
  objectives: StudioOptionItem[];
  genders: string[];
  placements: string[];
  languages: string[];
  districts: StudioDistrict[];
  referenceDataLoaded: boolean;
  defaults: {
    brief: Partial<DraftBrief>;
    targeting: { ageMin: number; ageMax: number; gender: StudioGender; dailyBudget: number; scheduleDays: number; placements: StudioPlacements };
    destinationUrl: string;
    targetCpa: number;
  };
  capabilities: {
    aiCopy: boolean;
    aiProvider: string | null;
    imageGeneration: boolean;
    imageProvider: string;
    imageUpload: boolean;
    maxImageBytes: number;
    acceptedImageTypes: string[];
    livePublish: boolean;
    livePublishMissing: string[];
    /** Instagram accounts connected with Meta login that have ads_management: ads can be published with their token (Instagram placements only). */
    instagramPublishAccounts: { id: string; username: string }[];
    canEdit: boolean;
    canPublish: boolean;
  };
  notes: string[];
}

/** Request bodies (camelCase). */
export interface BriefInput {
  product?: string;
  description?: string;
  objective?: StudioObjective;
  tone?: string;
  visualStyle?: string;
  language?: StudioLanguage;
  angle?: StudioAngle;
}

export interface CopyRequest {
  mode: 'locked' | 'generate';
  captionIndex?: number;
  brief: BriefInput;
}

export interface TargetingInput {
  districts: string[];
  villageCodes: string[];
  ageMin: number;
  ageMax: number;
  gender: StudioGender;
  dailyBudget: number;
  scheduleDays: number;
  placements: StudioPlacements;
}

export interface DraftCreateInput {
  brief: BriefInput;
  copy: Omit<AdCopy, 'headline' | 'cta' | 'angle' | 'note' | 'guardrails'> & { headline?: string | null };
  targeting: TargetingInput;
  destination: { url: string; number: string | null };
  targetCpa: number | null;
}
