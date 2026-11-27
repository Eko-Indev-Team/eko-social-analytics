/**
 * Ads reports (GET /ads/performance, /ads/experiments, /ads/signups, /ads/overview).
 * Mirrors backend/app/schemas/ads_reports.py. Money is INR as a plain number; percentages are 0–100.
 */

export type AdsChannel = 'Lead Form' | 'Website';

/** Lead qualification statuses (rule of 2026-11-18). */
export type QualStatusKey = 'sbiStrong' | 'esafStrong' | 'esafPitch' | 'needsInfo' | 'notQualified';
export type StatusCounts = Record<QualStatusKey, number>;
export type StatusLabels = Record<QualStatusKey, string>;

export interface PerfRow {
  adId: string;
  campaignId: string;
  adName: string;
  account: string;
  status: string;
  built: string;
  channel: AdsChannel;
  spend: number;
  impressions: number;
  reach: number;
  ctr: number | null;
  linkClicks: number;
  cpc: number | null;
  landingPageViews: number;
  costPerLpv: number | null;
  results: number;
  costPerResult: number | null;
  resultsPerThousandReach: number | null;
  quality: number;
  qualityRate: number | null;
  costPerQuality: number | null;
  fullyQualified: number;
  statusCounts: StatusCounts;
  nPincodes: number;
  targetStates: string[];
  pincodes: string[];
  geoBucket: string;
  audienceType: string;
  audienceDetail: string;
  ageSetting: string;
  ageNote: string;
  genderSetting: string;
  placementSetting: string;
  interestItems: string[];
  deliveredGender: string;
  categories: Record<string, string[]>;
  advantageOn: boolean | null;
  topAge: string;
}

export interface PerfSummary {
  ads: number;
  spend: number;
  impressions: number;
  linkClicks: number;
  ctr: number | null;
  results: number;
  costPerResult: number | null;
  quality: number;
  qualityRate: number | null;
  costPerQuality: number | null;
  landingPageViews: number;
  fullyQualified: number;
  statusCounts: StatusCounts;
}

export interface PerfGroup extends PerfSummary {
  channel: AdsChannel;
  group: string;
  bundleSize: number | null;
}

export interface DeliveryRow {
  group: string;
  spend: number;
  impressions: number;
  ctr: number | null;
  results: number;
  costPerResult: number | null;
  shareOfSpend: number;
}

export interface DeliveryTable {
  channel: AdsChannel;
  dimension: 'age' | 'gender' | 'platform' | 'position';
  rows: DeliveryRow[];
}

export interface VerdictEntry {
  group: string;
  spend: number;
  results: number;
  costPerResult: number | null;
  ctr: number | null;
  ads: number | null;
  quality: number | null;
  qualityRate: number | null;
  costPerQuality: number | null;
  shareOfSpend: number | null;
}

export interface PerfVerdict {
  channel: AdsChannel;
  dimension: string;
  winner: VerdictEntry;
  worst: VerdictEntry | null;
  basis: string;
  compared: number;
  delivery: boolean;
}

export interface PerfState {
  state: string;
  spend: number;
  impressions: number;
  ctr: number | null;
  leads: number;
  costPerLead: number | null;
  matched: number;
  qualified: number;
  statusCounts: StatusCounts;
}

export interface StateLeads {
  state: string;
  leads: number;
  matched: number;
  qualified: number;
}

export interface WebsiteState {
  state: string;
  spend: number;
  impressions: number;
  ctr: number | null;
}

export interface PerfPincode {
  pincode: string;
  state: string | null;
  ads: number;
  estSpend: number;
  matched: number;
  qualified: number;
  statusCounts: StatusCounts;
  estCostPerMatch: number | null;
}

export type AwardKey = 'bestOverall' | 'cheapestResult' | 'mostResults' | 'mostQuality' | 'bestCtr' | 'cheapestLpv';

export interface PerformanceOut {
  configured: boolean;
  signupsConfigured: boolean;
  hasData: boolean;
  rows: PerfRow[];
  awards: Record<AwardKey, PerfRow | null>;
  channels: { leadForm: PerfSummary; website: PerfSummary };
  verdicts: PerfVerdict[];
  byAge: PerfGroup[];
  byGender: PerfGroup[];
  byPlacement: PerfGroup[];
  byInterest: PerfGroup[];
  byAudience: PerfGroup[];
  byGeo: PerfGroup[];
  delivered: DeliveryTable[];
  states: PerfState[];
  leadsOutsideDelivery: StateLeads[];
  websiteStates: WebsiteState[];
  topPincodes: PerfPincode[];
  deadPincodes: PerfPincode[];
  pincodesTargeted: number;
  unattributedSignups: number;
  totalSignups: number;
  unknownTargeting: number;
  minQuality: number;
  minResults: number;
  thresholds: { minResultsForCostAward: number; minQualityForBestOverall: number; minImpressionsForCtrAward: number; minLpvForLpvAward: number };
  statusLabels: StatusLabels;
}

/* -------------------------------- Experiments ------------------------------- */

export type ColumnKind = 'text' | 'count' | 'money' | 'percent';
export interface ReportColumn {
  label: string;
  kind: ColumnKind;
}
export type ReportCell = string | number | null;

export type ExperimentVerdict = 'worked' | 'didnt' | 'mixed' | 'unclear' | 'notyet' | 'problem';
export type Confidence = 'High' | 'Medium' | 'Low';

export interface Experiment {
  id: string;
  title: string;
  question: string;
  did: string;
  columns: ReportColumn[];
  rows: ReportCell[][];
  learning: string[];
  verdict: ExperimentVerdict;
  verdictLabel: string;
  confidence: Confidence;
  confidenceWhy: string;
  dontRepeat: string | null;
  bestRow: number | null;
  note: string | null;
}

export interface Idea {
  priority: Confidence;
  title: string;
  basis: string;
  why: string;
  how: string;
  measure: string;
  effort: string;
  asOf: string | null;
}

export interface IdeaGroup {
  name: string;
  intro: string;
  asOf: string | null;
  items: Idea[];
}

export interface CreativeGroup {
  channel: AdsChannel;
  adId: string;
  ads: number;
  spend: number;
  results: number;
  costPerResult: number | null;
  quality: number;
  qualityRate: number | null;
  costPerQuality: number | null;
  hasImage: boolean;
  imageUrl: string | null;
  primaryText: string;
  headline: string;
  cta: string;
  type: string;
  imageType: string;
  built: string;
}

export interface TraitTable {
  title: string;
  columns: ReportColumn[];
  rows: ReportCell[][];
}

export interface CreativeAnalysis {
  pending: boolean;
  nAds: number;
  nCovered: number;
  groups: CreativeGroup[];
  traitTables: TraitTable[];
  verdict: ExperimentVerdict;
  verdictLabel: string;
  learning: string[];
  confidence: Confidence;
  confidenceWhy: string;
}

export interface Competitor {
  who: string;
  does: string;
  means: string;
  url: string;
  label: string;
}

export interface ExperimentsOut {
  configured: boolean;
  signupsConfigured: boolean;
  hasData: boolean;
  experiments: Experiment[];
  mistakes: { fromExperiment: string; experimentId: string; text: string }[];
  ideaGroups: IdeaGroup[];
  nIdeas: number;
  verdictCounts: Record<string, number>;
  verdictNames: Record<string, string>;
  creative: CreativeAnalysis;
  competitors: Competitor[];
  competitorCaveats: string[];
  competitorsAsOf: string;
  competitorsAsOfNote: string;
  leadStatusCounts: StatusCounts;
  statusLabels: StatusLabels;
}

/* ---------------------------------- Signups --------------------------------- */

export type AttributionTier = 'campaign_matched' | 'fbclid_only' | 'none';

export interface Signup {
  id: string | null;
  name: string | null;
  mobile: string | null;
  shopAddress: string | null;
  submittedAt: string | null;
  qualificationVerdict: string;
  attributionTier: AttributionTier;
  matchedCampaignId: string | null;
  matchedCampaignName: string | null;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
}

export interface SignupTotals {
  totalSignups: number;
  campaignMatched: number;
  fbclidOnly: number;
  notFacebook: number;
  facebookAttributed: number;
  strongQualify: number;
  facebookLeadFormLeads: number;
}

export interface SignupsOut {
  signupsConfigured: boolean;
  configured: boolean;
  hasAdData: boolean;
  piiVisible: boolean;
  tier: AttributionTier | null;
  verdict: string | null;
  totals: SignupTotals;
  signups: Signup[];
}

export interface SignupFilters {
  tier?: AttributionTier | null;
  verdict?: string | null;
}

/* --------------------------------- Overview --------------------------------- */

export interface OverviewOut {
  configured: boolean;
  signupsConfigured: boolean;
  hasAdData: boolean;
  formLeads: number;
  formQualified: number;
  formStatusCounts: StatusCounts;
  statusLabels: StatusLabels;
  formPincodeQualified: number;
  formPincodeCheckable: number;
  urlSignupsTotal: number;
  urlSignupsFacebook: number;
  urlStrongQualify: number;
  urlNotQualify: number;
  overallTotal: number;
}
