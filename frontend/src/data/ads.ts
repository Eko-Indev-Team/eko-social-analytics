import { parseEducation, qualifyLead, type EsafResponse } from '@/lib/qualification';
import type { AdBreakdownRow, AdChannel, AdDetail, AdLead, AdRow, AdsStatus } from '@/types/ads';

/**
 * DEMO DATA — synthetic Meta ads and lead-form leads for demo mode (VITE_DATA_SOURCE=demo).
 * Names and phone numbers are obviously fake ("Demo Lead 01", "+91 90000 000xx"). Nothing here is real.
 */

export const demoAdsStatus: AdsStatus = {
  configured: true,
  signupsConfigured: true,
  studioPublishConfigured: false,
  lastSyncedAt: '2026-11-18T06:30:00Z',
  lastSyncStatus: 'succeeded',
  lastErrorCode: null,
  lastErrorMessage: null,
  tokenExpired: false,
  currentJob: null,
  adCount: 12,
  leadCount: 40,
  canSync: true,
  canSeeLeads: true,
};

interface AdSeed {
  name: string;
  campaign: string;
  channel: AdChannel;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  imageType: string | null;
  locations: string[];
  pincodes: string[];
  headline: string;
  primaryText: string;
  created: string;
}

const PINCODES_UP = ['273001', '273002', '273151', '273158', '273165', '273209', '274001', '274149'];
const PINCODES_BR = ['842001', '842002', '843101', '843113', '844101'];
const PINCODES_MP = ['474001', '474002', '475001', '475110'];
const PINCODES_PB = ['141001', '141003', '144001', '147001', '148001', '151001'];

const SEEDS: AdSeed[] = [
  { name: 'Demo ad · CSP shop owner (Hindi)', campaign: 'Demo · SBI CSP Gorakhpur', channel: 'lead_form', status: 'ACTIVE', spend: 18_450, impressions: 212_400, clicks: 4_120, leads: 96, imageType: 'Shop owner photo', locations: ['Gorakhpur, Uttar Pradesh'], pincodes: PINCODES_UP, headline: 'Apni dukaan mein bank kholiye', primaryText: 'Demo text: earn every month as a banking agent in your village.', created: '2026-10-02T09:00:00+0530' },
  { name: 'Demo ad · Earn from home banking', campaign: 'Demo · SBI CSP Gorakhpur', channel: 'lead_form', status: 'ACTIVE', spend: 12_900, impressions: 160_250, clicks: 2_870, leads: 61, imageType: 'Money / earnings', locations: ['Gorakhpur, Uttar Pradesh'], pincodes: PINCODES_UP, headline: 'Ghar baithe kamaai', primaryText: 'Demo text: start a banking point with Eko.', created: '2026-10-05T10:00:00+0530' },
  { name: 'Demo ad · Women agents', campaign: 'Demo · SBI CSP Muzaffarpur', channel: 'lead_form', status: 'ACTIVE', spend: 9_820, impressions: 118_900, clicks: 2_210, leads: 44, imageType: 'Woman agent', locations: ['Muzaffarpur, Bihar'], pincodes: PINCODES_BR, headline: 'Mahilaon ke liye CSP', primaryText: 'Demo text: women can run a banking point too.', created: '2026-10-09T11:00:00+0530' },
  { name: 'Demo ad · Kiosk carousel', campaign: 'Demo · SBI CSP Muzaffarpur', channel: 'lead_form', status: 'PAUSED', spend: 6_310, impressions: 84_100, clicks: 1_390, leads: 22, imageType: 'Kiosk / counter', locations: ['Muzaffarpur, Bihar'], pincodes: PINCODES_BR, headline: 'Banking kiosk kholiye', primaryText: 'Demo text: a carousel of kiosk photos.', created: '2026-09-21T09:30:00+0530' },
  { name: 'Demo ad · Website signup Gwalior', campaign: 'Demo · Website signups MP', channel: 'website', status: 'ACTIVE', spend: 7_450, impressions: 96_700, clicks: 1_980, leads: 0, imageType: 'Shop owner photo', locations: ['Gwalior, Madhya Pradesh'], pincodes: PINCODES_MP, headline: 'Sign up on the Eko website', primaryText: 'Demo text: apply online in two minutes.', created: '2026-10-12T08:00:00+0530' },
  { name: 'Demo ad · Website signup video', campaign: 'Demo · Website signups MP', channel: 'website', status: 'COMPLETED', spend: 5_120, impressions: 71_300, clicks: 1_240, leads: 0, imageType: null, locations: ['Gwalior, Madhya Pradesh'], pincodes: PINCODES_MP, headline: 'Watch how it works', primaryText: 'Demo text: a short video about the agent model.', created: '2026-09-02T08:00:00+0530' },
  { name: 'Demo ad · Punjab villages', campaign: 'Demo · SBI CSP Punjab', channel: 'lead_form', status: 'ACTIVE', spend: 14_300, impressions: 175_800, clicks: 3_050, leads: 58, imageType: 'Village scene', locations: ['Ludhiana, Punjab', 'Patiala, Punjab'], pincodes: PINCODES_PB, headline: 'Pind vich bank', primaryText: 'Demo text: bring banking to your village.', created: '2026-10-15T09:00:00+0530' },
  { name: 'Demo ad · Punjab earnings', campaign: 'Demo · SBI CSP Punjab', channel: 'lead_form', status: 'ACTIVE', spend: 8_760, impressions: 102_400, clicks: 1_720, leads: 31, imageType: 'Money / earnings', locations: ['Ludhiana, Punjab'], pincodes: PINCODES_PB, headline: 'Har mahine kamaai', primaryText: 'Demo text: monthly income as a banking agent.', created: '2026-10-20T09:00:00+0530' },
  { name: 'Demo ad · ESAF zero investment', campaign: 'Demo · ESAF BC Bihar', channel: 'lead_form', status: 'ACTIVE', spend: 4_980, impressions: 66_200, clicks: 1_310, leads: 27, imageType: 'Shop owner photo', locations: ['Bihar'], pincodes: [], headline: 'Bina nivesh ke banking agent', primaryText: 'Demo text: no investment needed.', created: '2026-11-01T09:00:00+0530' },
  { name: 'Demo ad · Old test (no form)', campaign: 'Demo · Awareness test', channel: 'other', status: 'COMPLETED', spend: 2_150, impressions: 48_900, clicks: 410, leads: 0, imageType: null, locations: ['India'], pincodes: [], headline: 'Eko: banking near you', primaryText: 'Demo text: awareness test.', created: '2026-08-14T09:00:00+0530' },
  { name: 'Demo ad · Gorakhpur reel', campaign: 'Demo · SBI CSP Gorakhpur', channel: 'lead_form', status: 'COMPLETED', spend: 10_400, impressions: 141_000, clicks: 2_480, leads: 47, imageType: 'Kiosk / counter', locations: ['Gorakhpur, Uttar Pradesh'], pincodes: PINCODES_UP, headline: 'Dekhiye kaise kaam karta hai', primaryText: 'Demo text: a reel from a banking point.', created: '2026-09-10T09:00:00+0530' },
  { name: 'Demo ad · Gwalior lead form', campaign: 'Demo · SBI CSP Gwalior', channel: 'lead_form', status: 'PAUSED', spend: 3_870, impressions: 52_600, clicks: 860, leads: 15, imageType: 'Woman agent', locations: ['Gwalior, Madhya Pradesh'], pincodes: PINCODES_MP, headline: 'Gwalior mein CSP', primaryText: 'Demo text: apply to run a banking point.', created: '2026-10-25T09:00:00+0530' },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

function buildRow(seed: AdSeed, index: number): AdRow {
  const id = String(120210000000000 + index * 1_111);
  const reach = Math.round(seed.impressions * 0.62);
  const linkClicks = Math.round(seed.clicks * 0.71);
  return {
    id,
    campaignId: String(120200000000000 + seed.campaign.length * 97),
    campaignName: seed.campaign,
    adName: seed.name,
    accountName: 'Demo ad account',
    status: seed.status,
    objective: seed.channel === 'lead_form' ? 'OUTCOME_LEADS' : seed.channel === 'website' ? 'OUTCOME_TRAFFIC' : 'OUTCOME_AWARENESS',
    channel: seed.channel,
    createdTime: seed.created,
    firstImpressionDate: seed.created.slice(0, 10),
    firstImpressionHour: '10',
    creative: {
      type: index === 3 ? 'carousel' : 'image',
      primaryText: seed.primaryText,
      headline: seed.headline,
      description: '',
      cta: seed.channel === 'website' ? 'LEARN_MORE' : 'SIGN_UP',
      imageHash: seed.imageType ? `demohash${String(index).padStart(2, '0')}` : null,
      imageUrl: null,
      imageType: seed.imageType,
    },
    metrics: {
      impressions: seed.impressions,
      reach,
      clicks: seed.clicks,
      ctr: round2((seed.clicks / seed.impressions) * 100),
      cpc: round2(seed.spend / seed.clicks),
      cpm: round2((seed.spend / seed.impressions) * 1000),
      spend: seed.spend,
      linkClicks,
      landingPageViews: seed.channel === 'website' ? Math.round(linkClicks * 0.8) : 0,
      leads: seed.leads,
    },
    leadCounts: { total: 0, pincodeQualified: 0, qualified: 0 },
    targeting: {
      locations: seed.locations,
      pincodeCount: seed.pincodes.length,
      interestsBehaviors: index % 3 === 0 ? 'Small business owners, Retail shop' : null,
      ageRange: '21-45',
      genders: index === 2 || index === 11 ? 'Women' : 'All',
      placements: ['Facebook feed', 'Instagram feed', index % 2 ? 'Instagram reels' : 'Facebook stories'],
      advantageAudience: index % 4 === 0 ? true : false,
      restoredFromDb: index % 5 === 0,
      pincodeCheckOk: seed.pincodes.length > 0,
    },
  };
}

const rows = SEEDS.map(buildRow);
const pincodesByAd = new Map(rows.map((r, i) => [r.id, SEEDS[i].pincodes]));

/* ----------------------------------- Leads ---------------------------------- */

const EDUCATION = ['Graduate', '12th pass', '10th', 'BA', 'Diploma', 'Intermediate', '8th', 'MA', '', 'B.Com'];
const leadAds = rows.filter((r) => r.channel === 'lead_form');

function buildLead(n: number): AdLead {
  const ad = leadAds[n % leadAds.length];
  const adPincodes = pincodesByAd.get(ad.id) ?? [];
  // Mostly matching pincodes, every fourth lead outside the ad's targeted list, every ninth unknown.
  const pincode = n % 9 === 8 ? null : n % 4 === 3 || adPincodes.length === 0 ? `5600${String(10 + n).padStart(2, '0')}` : adPincodes[n % adPincodes.length];
  const pincodeMatch = pincode === null || adPincodes.length === 0 ? null : adPincodes.includes(pincode);
  const educationAnswer = EDUCATION[n % EDUCATION.length];
  const eduOk = parseEducation(educationAnswer);
  const canInvest = n % 7 === 6 ? null : n % 3 !== 1;
  const esafResponse: EsafResponse = n % 5 === 0 ? 'yes' : n % 5 === 2 ? 'no' : null;
  const { status, reasons } = qualifyLead(pincodeMatch, eduOk.ok, canInvest, esafResponse);
  const num = String(n + 1).padStart(2, '0');
  const day = 18 - Math.floor(n / 3);
  const createdTime = `2026-11-${String(Math.max(day, 1)).padStart(2, '0')}T${String(9 + (n % 9)).padStart(2, '0')}:15:00+0530`;
  return {
    id: String(900000000000000 + n * 37),
    adId: ad.id,
    adName: ad.adName,
    campaignName: ad.campaignName,
    createdTime,
    name: `Demo Lead ${num}`,
    phone: `+91 90000 000${num}`,
    submittedPincode: pincode,
    pincodeQualified: pincodeMatch,
    passesScreening: canInvest === true && eduOk.ok === true,
    qualified: status === 'sbi_strong' || status === 'esaf_strong',
    qualificationStatus: status,
    sbiReasons: reasons,
    pincodeMatch,
    educationLevel: eduOk.level,
    educationOk: eduOk.ok,
    canInvest,
    esafResponse,
    esafResponseSource: esafResponse ? (n % 2 ? 'staff' : 'form') : null,
    answers: [
      { question: 'Full name', answer: `Demo Lead ${num}` },
      { question: 'Phone number', answer: `+91 90000 000${num}` },
      { question: 'Pincode', answer: pincode ?? '' },
      { question: 'Highest education', answer: educationAnswer },
      { question: 'Can you invest minimum ₹50,000?', answer: canInvest === null ? '' : canInvest ? 'Yes' : 'No' },
      { question: 'Do you have a franchise background?', answer: n % 2 ? 'No' : 'Yes' },
    ],
  };
}

export const demoAdLeads: AdLead[] = Array.from({ length: 40 }, (_, n) => buildLead(n));

for (const row of rows) {
  const own = demoAdLeads.filter((l) => l.adId === row.id);
  row.leadCounts = {
    total: own.length,
    pincodeQualified: own.filter((l) => l.pincodeQualified === true).length,
    qualified: own.filter((l) => l.qualified).length,
  };
  // Keep Meta's lead count in line with the sample leads so numbers agree across the demo screens.
  if (row.channel === 'lead_form') row.metrics.leads = own.length;
}

export const demoAds: AdRow[] = rows;

/* -------------------------------- Ad details -------------------------------- */

function share(total: number, parts: number[]): number[] {
  const sum = parts.reduce((a, b) => a + b, 0);
  return parts.map((p) => Math.round((total * p) / sum));
}

function breakdownRows(row: AdRow, keys: Array<Partial<AdBreakdownRow>>, weights: number[]): AdBreakdownRow[] {
  const imp = share(row.metrics.impressions, weights);
  const clicks = share(row.metrics.clicks, weights);
  const spend = share(row.metrics.spend, weights);
  const leads = share(row.metrics.leads, weights);
  return keys.map((k, i) => ({ ...k, impressions: imp[i], reach: Math.round(imp[i] * 0.62), clicks: clicks[i], spend: spend[i], leads: leads[i] }));
}

export const demoAdDetails: Record<string, AdDetail> = Object.fromEntries(
  rows.map((row, i) => {
    const seed = SEEDS[i];
    const detail: AdDetail = {
      ...row,
      targeting: {
        ...row.targeting,
        pincodes: seed.pincodes,
        categories: row.targeting.interestsBehaviors ? { Interests: ['Small business owners'], Behaviors: ['Retail shop'] } : {},
        suggestedAgeRange: null,
      },
      breakdowns: {
        ageGender: breakdownRows(
          row,
          [
            { age: '18-24', gender: 'male' },
            { age: '25-34', gender: 'male' },
            { age: '25-34', gender: 'female' },
            { age: '35-44', gender: 'male' },
            { age: '45-54', gender: 'male' },
          ],
          [18, 34, 12, 26, 10],
        ),
        platform: breakdownRows(
          row,
          [
            { publisherPlatform: 'facebook', platformPosition: 'feed' },
            { publisherPlatform: 'instagram', platformPosition: 'feed' },
            { publisherPlatform: 'instagram', platformPosition: 'reels' },
          ],
          [55, 25, 20],
        ),
        region: breakdownRows(row, seed.locations.map((l) => ({ region: l.split(', ').pop() ?? l })), seed.locations.map(() => 1)),
      },
      leadFormId: row.channel === 'lead_form' ? `demo-form-${i + 1}` : null,
    };
    return [row.id, detail];
  }),
);

/** Demo "SBI service pincodes" (the union of the demo ads' targeted pincodes), used to qualify SocialBoard leads in demo mode. */
export const demoServicePincodes: ReadonlySet<string> = new Set(SEEDS.flatMap((s) => s.pincodes));
