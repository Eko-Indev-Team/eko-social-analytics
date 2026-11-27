/**
 * Synthetic demo data for the Ads reports (demo mode only, VITE_DATA_SOURCE=demo).
 * Every ad, person and number here is made up ("Demo Ad 01", "Demo Signup 01", 9999… phone numbers);
 * none of it comes from Meta or the signup site. Shapes follow GET /ads/performance, /experiments, /signups, /overview.
 */
import type {
  AdsChannel,
  CreativeGroup,
  DeliveryTable,
  Experiment,
  ExperimentsOut,
  OverviewOut,
  PerfGroup,
  PerformanceOut,
  PerfRow,
  PerfSummary,
  Signup,
  SignupsOut,
  StatusCounts,
  StatusLabels,
} from '@/types/adsReports';

export const demoStatusLabels: StatusLabels = {
  sbiStrong: 'Strongly qualified · SBI',
  esafStrong: 'Strongly qualified · ESAF',
  esafPitch: 'Pitch ESAF',
  needsInfo: 'Check details',
  notQualified: 'Not qualified',
};

const zero: StatusCounts = { sbiStrong: 0, esafStrong: 0, esafPitch: 0, needsInfo: 0, notQualified: 0 };
const sc = (sbiStrong: number, esafStrong: number, esafPitch: number, needsInfo: number, notQualified: number): StatusCounts => ({
  sbiStrong,
  esafStrong,
  esafPitch,
  needsInfo,
  notQualified,
});

const r2 = (v: number) => Math.round(v * 100) / 100;
const div = (a: number, b: number) => (b > 0 ? r2(a / b) : null);

interface Seed {
  n: number;
  channel: AdsChannel;
  status: string;
  built: string;
  spend: number;
  impressions: number;
  reach: number;
  linkClicks: number;
  lpv: number;
  results: number;
  quality: number;
  counts: StatusCounts;
  geoBucket: string;
  states: string[];
  nPincodes: number;
  audienceType: string;
  audienceDetail?: string;
  age: string;
  gender: string;
  placement: string;
  interests?: string[];
  deliveredGender?: string;
  topAge?: string;
}

const seeds: Seed[] = [
  { n: 1, channel: 'Lead Form', status: 'ACTIVE', built: '2026-09-01', spend: 4200, impressions: 120000, reach: 88000, linkClicks: 2100, lpv: 0, results: 140, quality: 46, counts: sc(9, 6, 92, 21, 12), geoBucket: '1-15 pincodes', states: ['Haryana'], nPincodes: 12, audienceType: 'Advantage+ (automatic)', age: '21-55', gender: 'All genders', placement: 'Facebook + Instagram', deliveredGender: 'actually reached 78% men, 22% women', topAge: '25-34 (54% of spend)' },
  { n: 2, channel: 'Lead Form', status: 'PAUSED', built: '2026-09-08', spend: 6100, impressions: 210000, reach: 150000, linkClicks: 3900, lpv: 0, results: 310, quality: 31, counts: sc(4, 5, 241, 38, 22), geoBucket: '46+ pincodes', states: ['Punjab', 'Haryana'], nPincodes: 58, audienceType: 'Advantage+ (automatic)', age: '21-55', gender: 'All genders', placement: 'Automatic (Advantage+ placements)', deliveredGender: 'actually reached 83% men, 17% women', topAge: '18-24 (47% of spend)' },
  { n: 3, channel: 'Lead Form', status: 'COMPLETED', built: '2026-09-15', spend: 2500, impressions: 64000, reach: 51000, linkClicks: 900, lpv: 0, results: 48, quality: 19, counts: sc(5, 3, 26, 9, 5), geoBucket: '16-30 pincodes', states: ['Uttar Pradesh'], nPincodes: 24, audienceType: 'Manual interests / job titles', audienceDetail: 'Small business owners', age: '25-45', gender: 'Women only (suggestion only, Advantage+ on)', placement: 'Facebook + Instagram', interests: ['Interests: Small business', 'Job titles: Shopkeeper'], deliveredGender: 'actually reached 61% men, 39% women', topAge: '25-34 (49% of spend)' },
  { n: 4, channel: 'Lead Form', status: 'ACTIVE', built: '2026-10-02', spend: 1800, impressions: 52000, reach: 40000, linkClicks: 700, lpv: 0, results: 36, quality: 4, counts: sc(1, 1, 24, 6, 4), geoBucket: 'Cities / radius', states: ['Uttar Pradesh'], nPincodes: 0, audienceType: 'Advantage+ (automatic)', age: '21-55', gender: 'All genders', placement: 'Facebook + Instagram', deliveredGender: 'actually reached 80% men, 20% women', topAge: '25-34 (51% of spend)' },
  { n: 5, channel: 'Website', status: 'ACTIVE', built: '2026-10-05', spend: 3600, impressions: 98000, reach: 70000, linkClicks: 2600, lpv: 1400, results: 9, quality: 4, counts: zero, geoBucket: '31-45 pincodes', states: ['Punjab'], nPincodes: 40, audienceType: 'Manual interests / job titles', audienceDetail: 'Personal finance', age: '21-55', gender: 'All genders', placement: 'Facebook + Instagram', interests: ['Interests: Personal finance'], topAge: '25-34 (44% of spend)' },
  { n: 6, channel: 'Website', status: 'PAUSED', built: '2026-10-12', spend: 2200, impressions: 81000, reach: 66000, linkClicks: 1900, lpv: 610, results: 3, quality: 1, counts: zero, geoBucket: 'Whole country', states: [], nPincodes: 0, audienceType: 'Advantage+ (automatic)', age: '21-55', gender: 'All genders', placement: 'Automatic (Advantage+ placements)', topAge: '18-24 (52% of spend)' },
];

const demoPincodes = (n: number, start: number) => Array.from({ length: n }, (_, i) => String(start + i * 3));

const allRows: PerfRow[] = seeds.map((s) => ({
  adId: `demo-ad-${String(s.n).padStart(2, '0')}`,
  campaignId: `demo-campaign-${String(s.n).padStart(2, '0')}`,
  adName: `Demo Ad ${String(s.n).padStart(2, '0')}`,
  account: s.n % 2 ? 'Demo Account A' : 'Demo Account B',
  status: s.status,
  built: s.built,
  channel: s.channel,
  spend: s.spend,
  impressions: s.impressions,
  reach: s.reach,
  ctr: div(s.linkClicks * 100, s.impressions),
  linkClicks: s.linkClicks,
  cpc: div(s.spend, s.linkClicks),
  landingPageViews: s.lpv,
  costPerLpv: div(s.spend, s.lpv),
  results: s.results,
  costPerResult: div(s.spend, s.results),
  resultsPerThousandReach: div(s.results * 1000, s.reach),
  quality: s.quality,
  qualityRate: div(s.quality * 100, s.results),
  costPerQuality: div(s.spend, s.quality),
  fullyQualified: s.channel === 'Lead Form' ? s.counts.sbiStrong + s.counts.esafStrong : s.quality,
  statusCounts: s.counts,
  nPincodes: s.nPincodes,
  targetStates: s.states,
  pincodes: demoPincodes(Math.min(s.nPincodes, 6), 100000 + s.n * 1000),
  geoBucket: s.geoBucket,
  audienceType: s.audienceType,
  audienceDetail: s.audienceDetail ?? '',
  ageSetting: s.age,
  ageNote: s.audienceType.startsWith('Advantage') ? 'Meta may widen to 18-65' : '',
  genderSetting: s.gender,
  placementSetting: s.placement,
  interestItems: s.interests ?? [],
  deliveredGender: s.deliveredGender ?? '',
  categories: {},
  advantageOn: s.audienceType.startsWith('Advantage'),
  topAge: s.topAge ?? '',
}));

const sortedRows = [...allRows].sort((a, b) => (a.costPerQuality ?? Infinity) - (b.costPerQuality ?? Infinity) || b.results - a.results);

function summarise(rows: PerfRow[]): PerfSummary {
  const sum = (k: 'spend' | 'impressions' | 'linkClicks' | 'results' | 'quality' | 'landingPageViews' | 'fullyQualified') => rows.reduce((a, r) => a + r[k], 0);
  const spend = sum('spend');
  const results = sum('results');
  const quality = sum('quality');
  const impressions = sum('impressions');
  const counts = { ...zero };
  for (const r of rows) for (const k of Object.keys(counts) as (keyof StatusCounts)[]) counts[k] += r.statusCounts[k];
  return {
    ads: rows.length,
    spend,
    impressions,
    linkClicks: sum('linkClicks'),
    ctr: div(sum('linkClicks') * 100, impressions),
    results,
    costPerResult: div(spend, results),
    quality,
    qualityRate: div(quality * 100, results),
    costPerQuality: div(spend, quality),
    landingPageViews: sum('landingPageViews'),
    fullyQualified: sum('fullyQualified'),
    statusCounts: counts,
  };
}

function groupBy(key: (r: PerfRow) => string[]): PerfGroup[] {
  const out: PerfGroup[] = [];
  for (const channel of ['Lead Form', 'Website'] as AdsChannel[]) {
    const groups = new Map<string, PerfRow[]>();
    for (const r of allRows.filter((x) => x.channel === channel)) for (const g of key(r)) groups.set(g, [...(groups.get(g) ?? []), r]);
    for (const [group, rows] of groups) out.push({ channel, group, bundleSize: null, ...summarise(rows) });
  }
  return out;
}

const delivered: DeliveryTable[] = (['Lead Form', 'Website'] as AdsChannel[]).flatMap((channel) => {
  const lf = channel === 'Lead Form';
  return [
    { channel, dimension: 'age' as const, rows: [
      { group: '18-24', spend: lf ? 4100 : 2100, impressions: lf ? 140000 : 70000, ctr: 1.6, results: lf ? 190 : 900, costPerResult: lf ? 21.58 : 2.33, shareOfSpend: lf ? 28.1 : 36.2 },
      { group: '25-34', spend: lf ? 7300 : 2500, impressions: lf ? 220000 : 78000, ctr: 1.9, results: lf ? 260 : 820, costPerResult: lf ? 28.08 : 3.05, shareOfSpend: lf ? 50.0 : 43.1 },
      { group: '35-44', spend: lf ? 3200 : 1200, impressions: lf ? 86000 : 31000, ctr: 1.4, results: lf ? 84 : 290, costPerResult: lf ? 38.1 : 4.14, shareOfSpend: lf ? 21.9 : 20.7 },
    ] },
    { channel, dimension: 'gender' as const, rows: [
      { group: 'Men', spend: lf ? 11700 : 4500, impressions: lf ? 360000 : 140000, ctr: 1.7, results: lf ? 450 : 1680, costPerResult: lf ? 26 : 2.68, shareOfSpend: lf ? 80.1 : 77.6 },
      { group: 'Women', spend: lf ? 2900 : 1300, impressions: lf ? 86000 : 39000, ctr: 1.5, results: lf ? 84 : 330, costPerResult: lf ? 34.52 : 3.94, shareOfSpend: lf ? 19.9 : 22.4 },
    ] },
    { channel, dimension: 'platform' as const, rows: [
      { group: 'Facebook', spend: lf ? 10900 : 3900, impressions: lf ? 330000 : 120000, ctr: 1.8, results: lf ? 420 : 1350, costPerResult: lf ? 25.95 : 2.89, shareOfSpend: lf ? 74.7 : 67.2 },
      { group: 'Instagram', spend: lf ? 3700 : 1900, impressions: lf ? 116000 : 59000, ctr: 1.3, results: lf ? 114 : 660, costPerResult: lf ? 32.46 : 2.88, shareOfSpend: lf ? 25.3 : 32.8 },
    ] },
    { channel, dimension: 'position' as const, rows: [
      { group: 'Feed', spend: lf ? 9800 : 3600, impressions: lf ? 290000 : 110000, ctr: 1.9, results: lf ? 400 : 1300, costPerResult: lf ? 24.5 : 2.77, shareOfSpend: lf ? 67.1 : 62.1 },
      { group: 'Reels', spend: lf ? 4800 : 2200, impressions: lf ? 156000 : 69000, ctr: 1.2, results: lf ? 134 : 710, costPerResult: lf ? 35.82 : 3.1, shareOfSpend: lf ? 32.9 : 37.9 },
    ] },
  ];
});

const lead = allRows.filter((r) => r.channel === 'Lead Form');
const web = allRows.filter((r) => r.channel === 'Website');

export const demoPerformance: PerformanceOut = {
  configured: false,
  signupsConfigured: false,
  hasData: true,
  rows: sortedRows,
  awards: {
    bestOverall: sortedRows[0],
    cheapestResult: allRows[1],
    mostResults: allRows[1],
    mostQuality: allRows[0],
    bestCtr: allRows[4],
    cheapestLpv: allRows[4],
  },
  channels: { leadForm: summarise(lead), website: summarise(web) },
  verdicts: [
    { channel: 'Lead Form', dimension: 'Pincodes targeted', winner: { group: '1-15 pincodes', spend: 4200, results: 140, costPerResult: 30, ctr: 1.75, ads: 1, quality: 46, qualityRate: 32.86, costPerQuality: 91.3, shareOfSpend: null }, worst: { group: 'Cities / radius', spend: 1800, results: 36, costPerResult: 50, ctr: 1.35, ads: 1, quality: 4, qualityRate: 11.11, costPerQuality: 450, shareOfSpend: null }, basis: 'cost per quality result', compared: 4, delivery: false },
    { channel: 'Lead Form', dimension: 'Age range set on the ad', winner: { group: '25-45', spend: 2500, results: 48, costPerResult: 52.08, ctr: 1.41, ads: 1, quality: 19, qualityRate: 39.58, costPerQuality: 131.58, shareOfSpend: null }, worst: { group: '21-55', spend: 12100, results: 486, costPerResult: 24.9, ctr: 1.76, ads: 3, quality: 81, qualityRate: 16.67, costPerQuality: 149.38, shareOfSpend: null }, basis: 'cost per quality result', compared: 2, delivery: false },
    { channel: 'Lead Form', dimension: 'Platform', winner: { group: 'Facebook', spend: 10900, results: 420, costPerResult: 25.95, ctr: 1.8, ads: null, quality: null, qualityRate: null, costPerQuality: null, shareOfSpend: 74.7 }, worst: { group: 'Instagram', spend: 3700, results: 114, costPerResult: 32.46, ctr: 1.3, ads: null, quality: null, qualityRate: null, costPerQuality: null, shareOfSpend: 25.3 }, basis: 'cost per lead', compared: 2, delivery: true },
    { channel: 'Website', dimension: 'Pincodes targeted', winner: { group: '31-45 pincodes', spend: 3600, results: 9, costPerResult: 400, ctr: 2.65, ads: 1, quality: 4, qualityRate: 44.44, costPerQuality: 900, shareOfSpend: null }, worst: null, basis: 'cost per result', compared: 2, delivery: false },
  ],
  byAge: groupBy((r) => [r.ageSetting]),
  byGender: groupBy((r) => [r.genderSetting]),
  byPlacement: groupBy((r) => [r.placementSetting]),
  byInterest: groupBy((r) => r.interestItems).map((g) => ({ ...g, bundleSize: 1 })),
  byAudience: groupBy((r) => [r.audienceType]),
  byGeo: groupBy((r) => [r.geoBucket]),
  delivered,
  states: [
    { state: 'Punjab', spend: 3400, impressions: 120000, ctr: 1.8, leads: 170, costPerLead: 20, matched: 18, qualified: 6, statusCounts: sc(3, 3, 130, 20, 14) },
    { state: 'Haryana', spend: 6000, impressions: 180000, ctr: 1.8, leads: 260, costPerLead: 23.08, matched: 58, qualified: 14, statusCounts: sc(9, 5, 190, 32, 24) },
    { state: 'Uttar Pradesh', spend: 4300, impressions: 116000, ctr: 1.4, leads: 84, costPerLead: 51.19, matched: 23, qualified: 10, statusCounts: sc(6, 4, 50, 15, 9) },
  ],
  leadsOutsideDelivery: [
    { state: 'Rajasthan', leads: 12, matched: 0, qualified: 2 },
    { state: 'No pincode given', leads: 8, matched: 0, qualified: 0 },
  ],
  websiteStates: [
    { state: 'Punjab', spend: 3600, impressions: 98000, ctr: 2.65 },
    { state: 'Maharashtra', spend: 900, impressions: 31000, ctr: 2.1 },
  ],
  topPincodes: [
    { pincode: '101000', state: 'Haryana', ads: 1, estSpend: 350, matched: 9, qualified: 3, statusCounts: sc(2, 1, 4, 1, 1), estCostPerMatch: 38.89 },
    { pincode: '101003', state: 'Haryana', ads: 1, estSpend: 350, matched: 7, qualified: 2, statusCounts: sc(1, 1, 3, 1, 1), estCostPerMatch: 50 },
    { pincode: '103000', state: 'Uttar Pradesh', ads: 1, estSpend: 104, matched: 5, qualified: 2, statusCounts: sc(1, 1, 2, 1, 0), estCostPerMatch: 20.8 },
  ],
  deadPincodes: [
    { pincode: '102006', state: 'Punjab', ads: 1, estSpend: 105, matched: 0, qualified: 0, statusCounts: zero, estCostPerMatch: null },
    { pincode: '102009', state: 'Punjab', ads: 1, estSpend: 105, matched: 0, qualified: 0, statusCounts: zero, estCostPerMatch: null },
  ],
  pincodesTargeted: 134,
  unattributedSignups: 4,
  totalSignups: 16,
  unknownTargeting: 0,
  minQuality: 3,
  minResults: 10,
  thresholds: { minResultsForCostAward: 10, minQualityForBestOverall: 3, minImpressionsForCtrAward: 5000, minLpvForLpvAward: 100 },
  statusLabels: demoStatusLabels,
};

/* -------------------------------- Experiments ------------------------------- */

const optionColumns = [
  { label: 'Option', kind: 'text' as const },
  { label: 'Ads', kind: 'count' as const },
  { label: 'Spend', kind: 'money' as const },
  { label: 'Results', kind: 'count' as const },
  { label: 'Cost / result', kind: 'money' as const },
  { label: 'Quality results', kind: 'count' as const },
  { label: 'Quality %', kind: 'percent' as const },
  { label: 'Cost / quality result', kind: 'money' as const },
];

const experiments: Experiment[] = [
  {
    id: 'geo',
    title: 'Narrow vs. broad pincode lists',
    question: 'Does targeting fewer pincodes bring better leads than targeting many?',
    did: 'Demo Lead Form ads ran with pincode lists from a handful of pincodes up to 55+.',
    columns: optionColumns,
    rows: [
      ['1-15 pincodes', 1, 4200, 140, 30, 46, 32.86, 91.3],
      ['16-30 pincodes', 1, 2500, 48, 52.08, 19, 39.58, 131.58],
      ['46+ pincodes', 1, 6100, 310, 19.68, 31, 10, 196.77],
      ['Cities / radius', 1, 1800, 36, 50, 4, 11.11, 450],
    ],
    learning: [
      'Cheapest leads came from 46+ pincodes (₹19.68 each). Best leads in the target area came from 1-15 pincodes (₹91.30 per lead from a targeted pincode).',
      '46+ pincodes cost 2.2x as much per quality lead as 1-15 pincodes.',
    ],
    verdict: 'mixed',
    verdictLabel: 'Mixed result',
    confidence: 'High',
    confidenceWhy: 'smallest group has 36 results',
    dontRepeat: 'Judging a pincode list by cost per lead alone. Broad lists always look cheapest but bring the most out-of-area leads.',
    bestRow: 0,
    note: null,
  },
  {
    id: 'women',
    title: 'Ads aimed at women',
    question: 'Do ads set to "women only" actually reach women?',
    did: 'One demo ad was set to women only while Advantage+ Audience was on.',
    columns: [
      { label: 'Ad', kind: 'text' },
      { label: 'Set to', kind: 'text' },
      { label: 'Women reached', kind: 'percent' },
      { label: 'Spend', kind: 'money' },
    ],
    rows: [['Demo Ad 03', 'Women only (suggestion only, Advantage+ on)', 39, 2500]],
    learning: ['With Advantage+ on, Meta treats gender as a suggestion: most of the spend still reached men.'],
    verdict: 'problem',
    verdictLabel: 'Problem found',
    confidence: 'Medium',
    confidenceWhy: 'one ad only',
    dontRepeat: 'Setting "women only" while Advantage+ Audience is on.',
    bestRow: null,
    note: 'Turn Advantage+ Audience off when the gender must be a hard limit.',
  },
  {
    id: 'screening',
    title: 'The screening questions as free text',
    question: 'How many leads pass each step of the screening?',
    did: 'Every demo Lead Form lead was checked against its pincode, the investment answer and the education answer.',
    columns: [
      { label: 'Stage', kind: 'text' },
      { label: 'Leads', kind: 'count' },
      { label: '% of all leads', kind: 'percent' },
    ],
    rows: [
      ['All leads', 534, 100],
      ['In a targeted pincode', 100, 18.73],
      ['Strongly qualified (SBI or ESAF)', 34, 6.37],
      ['Status: Strongly qualified · SBI', 19, 3.56],
      ['Status: Strongly qualified · ESAF', 15, 2.81],
      ['Status: Pitch ESAF', 383, 71.72],
      ['Status: Check details', 74, 13.86],
      ['Status: Not qualified', 43, 8.05],
    ],
    learning: ['Most leads miss the SBI pincode or investment rule: pitching ESAF to them is the biggest opportunity.'],
    verdict: 'unclear',
    verdictLabel: "Can't tell yet",
    confidence: 'Low',
    confidenceWhy: 'ESAF has not been pitched to most leads yet',
    dontRepeat: null,
    bestRow: null,
    note: null,
  },
  {
    id: 'tracking',
    title: 'Website signups traced to ads',
    question: 'Can every website signup be traced back to the ad that brought it?',
    did: 'Demo website ads used campaign tags on their links.',
    columns: [
      { label: 'Signups', kind: 'text' },
      { label: 'Count', kind: 'count' },
      { label: 'Share', kind: 'percent' },
    ],
    rows: [
      ['Matched to an ad', 12, 75],
      ['From Facebook, ad unknown', 2, 12.5],
      ['Not from Facebook', 2, 12.5],
    ],
    learning: ['Three out of four signups carry the campaign tag.'],
    verdict: 'worked',
    verdictLabel: 'Clear result',
    confidence: 'Medium',
    confidenceWhy: 'smallest group has 2 signups',
    dontRepeat: 'Website links without campaign tags.',
    bestRow: 0,
    note: null,
  },
];

const creativeGroups: CreativeGroup[] = allRows.slice(0, 4).map((r, i) => ({
  channel: r.channel,
  adId: r.adId,
  ads: 1,
  spend: r.spend,
  results: r.results,
  costPerResult: r.costPerResult,
  quality: r.quality,
  qualityRate: r.qualityRate,
  costPerQuality: r.costPerQuality,
  hasImage: false,
  imageUrl: null,
  primaryText: ['Demo caption: become a banking point in your village.', 'Demo caption: start a kiosk at your shop.', 'Demo caption: a respected local job for women.', 'Demo caption: serve your neighbours.'][i],
  headline: `Demo headline ${i + 1}`,
  cta: i % 2 ? 'Learn More' : 'Sign Up',
  type: 'Image',
  imageType: ['Real photo', 'Illustration', 'Real photo', ''][i],
  built: r.built,
}));

export const demoExperiments: ExperimentsOut = {
  configured: false,
  signupsConfigured: false,
  hasData: true,
  experiments,
  mistakes: experiments.filter((e) => e.dontRepeat).map((e) => ({ fromExperiment: e.title, experimentId: e.id, text: e.dontRepeat! })),
  ideaGroups: [
    {
      name: 'Targeting',
      intro: 'Ideas drawn from the demo pincode and audience results.',
      asOf: null,
      items: [
        { priority: 'High', title: 'Keep pincode lists short', basis: 'Your data', why: 'Short lists brought the cheapest quality leads.', how: 'Build new ads with 15 pincodes or fewer.', measure: 'Cost per quality result.', effort: '1 hour', asOf: null },
        { priority: 'Medium', title: 'Pitch ESAF to leads outside the pincode list', basis: 'Your data + a hunch', why: 'Most leads are "Pitch ESAF".', how: 'Call them and record their answer on the lead.', measure: 'Share of leads that become ESAF strong.', effort: '1 day', asOf: null },
      ],
    },
    {
      name: 'Creative',
      intro: 'Demo ideas about pictures and captions.',
      asOf: '2026-10-19',
      items: [
        { priority: 'Low', title: 'Try a real photo of a kiosk', basis: 'Untested hunch', why: 'Real photos look more trustworthy.', how: 'Run two ads that differ only in the picture.', measure: 'Cost per quality result.', effort: '2 hours', asOf: '2026-10-19' },
      ],
    },
  ],
  nIdeas: 3,
  verdictCounts: { mixed: 1, problem: 1, unclear: 1, worked: 1 },
  verdictNames: { worked: 'Clear result', didnt: "Didn't work", mixed: 'Mixed result', unclear: "Can't tell yet", notyet: 'Not tried yet', problem: 'Problem found' },
  creative: {
    pending: false,
    nAds: 6,
    nCovered: 4,
    groups: creativeGroups,
    traitTables: [
      {
        title: 'Button',
        columns: [{ label: 'Channel', kind: 'text' }, ...optionColumns],
        rows: [
          ['Lead Form', 'Sign Up', 2, 6700, 176, 38.07, 50, 28.41, 134],
          ['Lead Form', 'Learn More', 2, 7900, 358, 22.07, 50, 13.97, 158],
        ],
      },
    ],
    verdict: 'unclear',
    verdictLabel: "Can't tell yet",
    learning: ['4 demo ads used 4 different picture-and-caption combinations; too few to pick a winner.'],
    confidence: 'Low',
    confidenceWhy: 'smallest group has 36 results',
  },
  competitors: [
    { who: 'Demo Competitor One', does: 'Shows a shop owner and says "earn extra income".', means: 'Shop-owner angle is common in this market.', url: 'https://example.com/demo-competitor-one', label: 'Demo source' },
    { who: 'Demo Competitor Two', does: 'Promises zero investment.', means: 'Zero-investment wording attracts many unqualified leads.', url: 'https://example.com/demo-competitor-two', label: 'Demo source' },
  ],
  competitorCaveats: ['Demo notes, not real research.'],
  competitorsAsOf: '2026-10-19',
  competitorsAsOfNote: 'Demo snapshot. Re-check the sources before relying on it.',
  leadStatusCounts: sc(19, 15, 383, 74, 43),
  statusLabels: demoStatusLabels,
};

/* ---------------------------------- Signups --------------------------------- */

const verdicts = ['STRONG_QUALIFY', 'STRONG_QUALIFY', 'QUALIFY', 'NOT_QUALIFY'];
export const demoSignups: Signup[] = Array.from({ length: 16 }, (_, i) => {
  const n = i + 1;
  const tier = n <= 12 ? 'campaign_matched' : n <= 14 ? 'fbclid_only' : 'none';
  const ad = tier === 'campaign_matched' ? allRows[4 + (n % 2)] : null;
  return {
    id: `demo-${500 + n}`,
    name: `Demo Signup ${String(n).padStart(2, '0')}`,
    mobile: `99999 000${String(n).padStart(2, '0')}`,
    shopAddress: `Demo Shop ${n}, Demo Village`,
    submittedAt: `2026-10-${String(30 - n).padStart(2, '0')}T10:00:00`,
    qualificationVerdict: verdicts[n % verdicts.length],
    attributionTier: tier,
    matchedCampaignId: ad?.campaignId ?? null,
    matchedCampaignName: ad ? `${ad.adName} campaign` : null,
    utmSource: tier === 'none' ? '' : 'facebook',
    utmMedium: 'paid',
    utmCampaign: ad?.campaignId ?? '',
  } satisfies Signup;
});

export function demoSignupsOut(): Omit<SignupsOut, 'tier' | 'verdict' | 'signups'> {
  const s = demoSignups;
  const campaignMatched = s.filter((x) => x.attributionTier === 'campaign_matched').length;
  const fbclidOnly = s.filter((x) => x.attributionTier === 'fbclid_only').length;
  return {
    signupsConfigured: false,
    configured: false,
    hasAdData: true,
    piiVisible: true,
    totals: {
      totalSignups: s.length,
      campaignMatched,
      fbclidOnly,
      notFacebook: s.length - campaignMatched - fbclidOnly,
      facebookAttributed: campaignMatched + fbclidOnly,
      strongQualify: s.filter((x) => x.qualificationVerdict === 'STRONG_QUALIFY').length,
      facebookLeadFormLeads: summarise(lead).results,
    },
  };
}

/* --------------------------------- Overview --------------------------------- */

const lfSummary = summarise(lead);
export const demoOverview: OverviewOut = {
  configured: false,
  signupsConfigured: false,
  hasAdData: true,
  formLeads: lfSummary.results,
  formQualified: lfSummary.statusCounts.sbiStrong + lfSummary.statusCounts.esafStrong,
  formStatusCounts: lfSummary.statusCounts,
  statusLabels: demoStatusLabels,
  formPincodeQualified: lfSummary.quality,
  formPincodeCheckable: lfSummary.results - 8,
  urlSignupsTotal: demoSignups.length,
  urlSignupsFacebook: demoSignups.filter((x) => x.attributionTier !== 'none').length,
  urlStrongQualify: demoSignups.filter((x) => x.qualificationVerdict === 'STRONG_QUALIFY').length,
  urlNotQualify: demoSignups.filter((x) => x.qualificationVerdict === 'NOT_QUALIFY').length,
  overallTotal: lfSummary.results + demoSignups.length,
};
