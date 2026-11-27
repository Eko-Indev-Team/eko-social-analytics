/**
 * Ad Studio demo data (demo mode only). Locked captions, approved CTAs and banned phrases are the real
 * locked rules (same as backend/app/services/ads/studio/rules.py); districts and villages are made up
 * ("Demo District A", "Demo Village 1"). Live publishing is never available in demo mode.
 */
import type { StudioOptions, StudioVillage } from '@/types/adStudio';

export const APPROVED_CTAS: { text: string; metaType: string }[] = [
  { text: 'आज ही आवेदन करें', metaType: 'APPLY_NOW' },
  { text: 'अभी आवेदन करें', metaType: 'APPLY_NOW' },
  { text: 'आज ही शुरुआत करें', metaType: 'SIGN_UP' },
  { text: 'अभी जानकारी प्राप्त करें', metaType: 'LEARN_MORE' },
];

export const BANNED_PHRASES = ['Check Eligibility', 'पात्रता जांचें', 'पात्रता जांच'];

export const DEFAULT_BULLETS = ['स्थिर मासिक आय का अवसर', 'अपने क्षेत्र में सम्मानजनक कार्य', 'SBI के साथ सीधा जुड़ाव', 'प्रशिक्षण एवं सहयोग उपलब्ध'];

const RAW_CAPTIONS = [
  'SBI Kiosk Operator बनने का अवसर | अपने इलाके में बैंकिंग सेवाओं से जुड़ें | आज ही आवेदन करें',
  'अपने इलाके में नई पहचान बनाएं | लोगों तक बैंकिंग सेवाएं पहुंचाएं | आज ही शुरुआत करें',
  'अपने इलाके के लोगों तक बैंकिंग सेवाएं पहुंचाएं | SBI Kiosk Operator बनने का अवसर जानें | अभी आवेदन करें',
  'क्या आप एक नया व्यवसायिक अवसर तलाश रहे हैं? | SBI Kiosk Operator बनने की प्रक्रिया जानें | आज ही आवेदन करें',
  'अपने इलाके में बैंकिंग सेवाओं का हिस्सा बनें | SBI Kiosk Operator बनने का अवसर जानें | अभी जानकारी प्राप्त करें',
];

export const demoStudioOptions: StudioOptions = {
  angles: [
    { id: 'general_opportunity', label: 'General opportunity', description: 'Broad appeal — anyone in the community who wants a stable local income opportunity.' },
    { id: 'women_first', label: 'Women-first', description: 'Speak directly to women — running a CSP kiosk as a respected, safe, local income source for women.' },
    { id: 'shop_owner', label: 'Shop-owner', description: 'Speak to existing shop/kirana store owners — add a CSP kiosk to their existing shop for extra income.' },
  ],
  ctas: APPROVED_CTAS,
  bannedPhrases: BANNED_PHRASES,
  lockedCaptions: RAW_CAPTIONS.map((text, i) => {
    const [hook, body, ctaText] = text.split('|').map((p) => p.trim());
    return { index: i + 1, text, hook, body, ctaText, cta: APPROVED_CTAS.find((c) => c.text === ctaText)?.metaType ?? 'LEARN_MORE' };
  }),
  objectives: [
    { id: 'leads', label: 'Leads', description: 'OUTCOME_LEADS' },
    { id: 'traffic', label: 'Website visits', description: 'OUTCOME_TRAFFIC' },
    { id: 'sales', label: 'Sales', description: 'OUTCOME_SALES' },
    { id: 'awareness', label: 'Awareness', description: 'OUTCOME_AWARENESS' },
    { id: 'engagement', label: 'Engagement', description: 'OUTCOME_ENGAGEMENT' },
  ],
  genders: ['all', 'male', 'female'],
  placements: ['advantage', 'manual'],
  languages: ['hindi', 'english'],
  districts: [
    { name: 'Demo District A', state: 'Demo State', anchorCount: 3, villageCount: 4, sources: ['existing_csp'], excluded: false, excludedReason: null },
    { name: 'Demo District B', state: 'Demo State', anchorCount: 2, villageCount: 2, sources: ['punjab_haryana_expansion'], excluded: false, excludedReason: null },
    { name: 'Demo District C', state: null, anchorCount: 0, villageCount: 0, sources: [], excluded: false, excludedReason: null },
    { name: 'Demo District D', state: null, anchorCount: 0, villageCount: 0, sources: [], excluded: true, excludedReason: 'Saturated: 7 CSPs already there' },
  ],
  referenceDataLoaded: true,
  defaults: {
    brief: {
      product: 'SBI Kiosk Operator / CSP Agent opportunity',
      description: 'Become a banking point in your village.',
      objective: 'leads',
      tone: 'warm, trustworthy',
      visual_style: 'real photo of a village kiosk',
      language: 'hindi',
      angle: 'general_opportunity',
    },
    targeting: { ageMin: 21, ageMax: 45, gender: 'all', dailyBudget: 500, scheduleDays: 7, placements: 'advantage' },
    destinationUrl: 'https://example.com/demo-signup',
    targetCpa: 150,
  },
  capabilities: {
    aiCopy: false,
    aiProvider: null,
    imageGeneration: false,
    imageProvider: 'none',
    imageUpload: true,
    maxImageBytes: 8 * 1024 * 1024,
    acceptedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    livePublish: false,
    livePublishMissing: ['META_ADS_ACCESS_TOKEN', 'META_ADS_PUBLISH_ACCOUNT_ID', 'META_ADS_PAGE_ID'],
    instagramPublishAccounts: [],
    canEdit: true,
    canPublish: true,
  },
  notes: [
    'Sample mode: nothing is sent to Meta. Building a draft shows what would be sent.',
    'The picture is used as-is: no text is drawn onto it.',
  ],
};

export const demoVillages: Record<string, StudioVillage[]> = {
  'Demo District A': [1, 2, 3, 4].map((n) => ({
    code: `DV-A${n}`,
    village: `Demo Village ${n}`,
    tehsil: 'Demo Tehsil A',
    district: 'Demo District A',
    state: 'Demo State',
    pincode: `10010${n}`,
    pincodeMatchLevel: n % 2 ? 'village' : 'tehsil',
  })),
  'Demo District B': [5, 6].map((n) => ({
    code: `DV-B${n}`,
    village: `Demo Village ${n}`,
    tehsil: 'Demo Tehsil B',
    district: 'Demo District B',
    state: 'Demo State',
    pincode: `20020${n}`,
    pincodeMatchLevel: 'district',
  })),
};

export const demoAnchors: Record<string, { lat: number; lon: number; count: number }> = {
  'Demo District A': { lat: 26.7, lon: 83.4, count: 3 },
  'Demo District B': { lat: 30.9, lon: 75.8, count: 2 },
};
