import { APPROVED_CTAS, BANNED_PHRASES, DEFAULT_BULLETS, demoAnchors, demoStudioOptions, demoVillages } from '@/data/adStudio';
import { ApiError, apiClient } from '@/lib/api/client';
import { config } from '@/lib/config';
import { fromSource, mutateSource, mutateSourceAsync, NotFoundError } from '@/lib/api/source';
import type {
  AdCopy,
  CopyRequest,
  Draft,
  DraftCreateInput,
  DraftInsights,
  DraftSummary,
  StudioOptions,
  StudioTargeting,
  StudioVillage,
  TargetingInput,
} from '@/types/adStudio';

/* ------------------------------- Demo helpers ------------------------------- */

const ANGLES = ['general_opportunity', 'women_first', 'shop_owner'];
const OBJECTIVE_MAP: Record<string, string> = { leads: 'OUTCOME_LEADS', sales: 'OUTCOME_SALES', traffic: 'OUTCOME_TRAFFIC', awareness: 'OUTCOME_AWARENESS', engagement: 'OUTCOME_ENGAGEMENT' };

function lockedCopy(index: number, angle: string): AdCopy {
  const c = demoStudioOptions.lockedCaptions[index - 1] ?? demoStudioOptions.lockedCaptions[0];
  return {
    headlineLine1: c.hook,
    headlineLine2: '',
    subheading: c.body,
    primaryText: `${c.hook} ${c.body}`,
    description: c.body,
    bullets: [...DEFAULT_BULLETS],
    ctaText: c.ctaText,
    cta: c.cta,
    headline: c.hook,
    angle,
    source: 'locked_caption',
    captionIndex: c.index,
    aiModel: null,
    note: null,
    guardrails: { ok: true, violations: [], removedPhrases: [], ctaReplaced: false },
  };
}

/** Same strict check the server runs on copy a person submits (rules.check_copy). */
export function checkCopy(copy: Pick<AdCopy, 'headlineLine1' | 'headlineLine2' | 'subheading' | 'primaryText' | 'description' | 'bullets' | 'ctaText'> & { headline?: string | null }, angle?: string): string[] {
  const violations: string[] = [];
  if (!APPROVED_CTAS.some((c) => c.text === copy.ctaText)) violations.push('The call-to-action must be one of the 4 approved phrases.');
  if (angle !== undefined && !ANGLES.includes(angle)) violations.push(`The creative angle must be one of: ${ANGLES.join(', ')}.`);
  const texts = [copy.headlineLine1, copy.headlineLine2, copy.subheading, copy.primaryText, copy.description, copy.headline ?? '', ...copy.bullets];
  const found = BANNED_PHRASES.filter((p) => texts.some((tx) => tx.toLowerCase().includes(p.toLowerCase())));
  for (const p of found) violations.push(`“${p}” wording is not allowed (eligibility-check messaging is banned).`);
  return violations;
}

function buildTargeting(input: TargetingInput): StudioTargeting {
  if (input.ageMin > input.ageMax) throw new ApiError('Minimum age must not be above maximum age.', 422, 'validation_error');
  const excluded = new Set(demoStudioOptions.districts.filter((d) => d.excluded).map((d) => d.name));
  const districts = input.districts.filter((d) => !excluded.has(d));
  const removed = input.districts.filter((d) => excluded.has(d));
  const allVillages = Object.values(demoVillages).flat();
  const villages = allVillages.filter((v) => input.villageCodes.includes(v.code));
  const anchors = districts.flatMap((d) => {
    const a = demoAnchors[d];
    return a ? Array.from({ length: a.count }, (_, i) => ({ district: d, tehsil: null, anchor: `${d} anchor ${i + 1}`, state: 'Demo State', lat: a.lat + i * 0.1, lon: a.lon, radiusKm: 15, matchPrecision: 'district', source: 'existing_csp' })) : [];
  });
  const unresolvedDistricts = districts.filter((d) => !demoAnchors[d]);
  const pincodes = [...new Set(villages.map((v) => v.pincode).filter((p): p is string => !!p))];
  const metaTargeting: Record<string, unknown> = {
    geo_locations: {
      countries: anchors.length || pincodes.length ? undefined : ['IN'],
      custom_locations: anchors.map((a) => ({ latitude: a.lat, longitude: a.lon, radius: a.radiusKm, distance_unit: 'kilometer' })),
      zips: pincodes.map((p) => ({ key: `IN:${p}` })),
    },
    age_min: input.ageMin,
    age_max: input.ageMax,
    ...(input.gender === 'all' ? {} : { genders: [input.gender === 'male' ? 1 : 2] }),
  };
  const notes: string[] = [];
  if (removed.length) notes.push(`Removed (already saturated): ${removed.join(', ')}.`);
  if (unresolvedDistricts.length) notes.push(`No reference locations for ${unresolvedDistricts.join(', ')}: a live publish would look them up with Meta location search (50 km).`);
  return { ...input, districts, removed, anchors, villages, pincodes, unresolvedDistricts, metaTargeting, notes };
}

const drafts: Draft[] = [];

function toSummary(d: Draft): DraftSummary {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { brief: _b, copy: _c, targeting: _t, destination: _d, guardrails: _g, imageSource: _i, payload: _p, canPublish: _cp, canActivate: _ca, publishedAt: _pa, activatedAt: _aa, publishedWith: _pw, notes: _n, ...summary } = d;
  return summary;
}

function demoCreateDraft(input: DraftCreateInput): Draft {
  const violations = checkCopy(input.copy, input.brief.angle);
  let url = (input.destination.url || demoStudioOptions.defaults.destinationUrl).trim();
  if (!/^[a-z]+:\/\//i.test(url)) url = `https://${url}`;
  if (!/^https?:\/\/[^\s/]+\.[^\s]+/i.test(url)) violations.push('The destination must be an http(s) website address.');
  if (violations.length) throw new ApiError('The ad copy breaks the locked rules.', 422, 'validation_error', { error: { code: 'validation_error', message: 'The ad copy breaks the locked rules.', details: { violations } } });
  const targeting = buildTargeting(input.targeting);
  const defaults = demoStudioOptions.defaults.brief;
  const brief = {
    product: input.brief.product || defaults.product || '',
    description: input.brief.description || defaults.description || '',
    objective: input.brief.objective || 'leads',
    tone: input.brief.tone || defaults.tone || '',
    visual_style: input.brief.visualStyle || defaults.visual_style || '',
    language: input.brief.language || 'hindi',
    angle: input.brief.angle || 'general_opportunity',
  };
  const locked = input.copy.captionIndex ? lockedCopy(input.copy.captionIndex, brief.angle) : null;
  const unchanged = locked && locked.primaryText === input.copy.primaryText && locked.headlineLine1 === input.copy.headlineLine1 && locked.subheading === input.copy.subheading && locked.description === input.copy.description;
  const source = input.copy.source === 'ai' ? 'ai' : unchanged ? input.copy.source : 'custom';
  const headline = `${input.copy.headlineLine1} ${input.copy.headlineLine2}`.trim();
  const cta = APPROVED_CTAS.find((c) => c.text === input.copy.ctaText)!.metaType;
  const now = new Date().toISOString();
  const id = `ads_demo${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`;
  const objective = OBJECTIVE_MAP[brief.objective] ?? 'OUTCOME_TRAFFIC';
  const draft: Draft = {
    id,
    status: 'built',
    mode: 'dry_run',
    createdAt: now,
    updatedAt: now,
    createdByName: 'Demo User',
    headline,
    angle: brief.angle,
    objective: brief.objective,
    copySource: source,
    districts: targeting.districts,
    pincodeCount: targeting.pincodes.length,
    dailyBudget: targeting.dailyBudget,
    hasImage: false,
    imageUrl: null,
    metaIds: { campaignId: null, adSetId: null, imageHash: null, creativeId: null, adId: null },
    error: null,
    brief,
    copy: { ...input.copy, headline, cta, angle: brief.angle, source, note: null, guardrails: { ok: true, violations: [], removedPhrases: [], ctaReplaced: false } },
    targeting,
    destination: { type: 'website', url, number: input.destination.number },
    guardrails: { maxDailySpend: targeting.dailyBudget, targetCpa: input.targetCpa },
    imageSource: null,
    payload: {
      campaign: { name: `${brief.product} - ${brief.objective}`, objective, status: 'PAUSED', special_ad_categories: [] },
      ad_set: { name: `${brief.product} - AdSet 1`, campaign_id: '<campaign id from Meta>', daily_budget: Math.round(targeting.dailyBudget * 100), billing_event: 'IMPRESSIONS', optimization_goal: 'LINK_CLICKS', targeting: targeting.metaTargeting, status: 'PAUSED' },
      ad_image: { upload: null },
      ad_creative: { name: `${brief.product} creative`, object_story_spec: { page_id: '<META_ADS_PAGE_ID not set>', link_data: { message: input.copy.primaryText, link: url, name: headline, description: input.copy.description, image_hash: null, call_to_action: { type: cta } } } },
      ad: { name: `${brief.product} - Ad 1`, adset_id: '<ad set id from Meta>', creative: { creative_id: '<creative id from Meta>' }, status: 'PAUSED' },
      review: { unresolved_districts: targeting.unresolvedDistricts, placements: targeting.placements, schedule_days: targeting.scheduleDays, schedule_note: 'Run length is for your planning only: no end date is sent to Meta. Pause the ad when you are done.', call_whatsapp_number: input.destination.number },
    },
    canPublish: false,
    canActivate: false,
    publishedAt: null,
    activatedAt: null,
    publishedWith: null,
    notes: ['Dry run: nothing was sent to Meta. This is exactly what would be sent.', 'Sample mode: live publishing is not available.', 'No picture yet: add one before publishing.'],
  };
  drafts.unshift(draft);
  return draft;
}

function findDraft(id: string): Draft {
  const d = drafts.find((x) => x.id === id);
  if (!d) throw new NotFoundError('Draft', id);
  return d;
}

/* --------------------------------- Service ---------------------------------- */

/** Ad Studio: options, copy, targeting preview, dry-run drafts, picture, live publish/activate (ads:manage) and insights. */
export const adStudioService = {
  options: () => fromSource<StudioOptions>(() => demoStudioOptions, '/ads/studio/options'),

  villages: (district: string) => fromSource<StudioVillage[]>(() => demoVillages[district] ?? [], `/ads/studio/villages?district=${encodeURIComponent(district)}`),

  copy: (body: CopyRequest) =>
    mutateSource<AdCopy>(
      () => {
        const angle = body.brief.angle ?? 'general_opportunity';
        const copy = lockedCopy(body.captionIndex ?? 1, angle);
        if (body.mode === 'generate')
          return { ...copy, source: 'locked_caption_fallback', note: 'Not AI-written: AI copy is not set up in sample mode. An approved locked caption is shown instead.' };
        return copy;
      },
      { method: 'post', path: '/ads/studio/copy', body },
    ),

  targeting: (body: TargetingInput) => mutateSource<StudioTargeting>(() => buildTargeting(body), { method: 'post', path: '/ads/studio/targeting', body }),

  createDraft: (body: DraftCreateInput) => mutateSource<Draft>(() => demoCreateDraft(body), { method: 'post', path: '/ads/studio/drafts', body }),

  drafts: () => fromSource<DraftSummary[]>(() => drafts.map(toSummary), '/ads/studio/drafts?limit=50'),

  draft: (id: string) => fromSource<Draft>(() => findDraft(id), `/ads/studio/drafts/${encodeURIComponent(id)}`),

  deleteDraft: (id: string) =>
    mutateSource<void>(
      () => {
        findDraft(id);
        drafts.splice(drafts.findIndex((d) => d.id === id), 1);
      },
      { method: 'delete', path: `/ads/studio/drafts/${encodeURIComponent(id)}` },
    ),

  uploadImage: (id: string, file: File) => {
    if (config.dataSource === 'api') return apiClient.putBinary<Draft>(`/ads/studio/drafts/${encodeURIComponent(id)}/image`, file, file.type);
    return mutateSourceAsync<Draft>(
      async () => {
        const d = findDraft(id);
        if (!demoStudioOptions.capabilities.acceptedImageTypes.includes(file.type)) throw new ApiError('Use a JPEG, PNG or WebP picture.', 422, 'validation_error');
        if (file.size > demoStudioOptions.capabilities.maxImageBytes) throw new ApiError('The picture is too large (max 8 MB).', 413, 'payload_too_large');
        Object.assign(d, { hasImage: true, imageUrl: URL.createObjectURL(file), imageSource: 'upload', notes: d.notes.filter((n) => !n.startsWith('No picture')) });
        d.payload.ad_image = { upload: "the draft's picture" };
        return d;
      },
      { method: 'put', path: '' },
    );
  },

  removeImage: (id: string) =>
    mutateSource<Draft>(
      () => {
        const d = findDraft(id);
        Object.assign(d, { hasImage: false, imageUrl: null, imageSource: null });
        return d;
      },
      { method: 'delete', path: `/ads/studio/drafts/${encodeURIComponent(id)}/image` },
    ),

  generateImage: (id: string) =>
    mutateSource<Draft>(
      () => {
        throw new ApiError('Picture generation is not set up.', 409, 'not_configured');
      },
      { method: 'post', path: `/ads/studio/drafts/${encodeURIComponent(id)}/image/generate` },
    ),

  /** Omit `instagramAccountId` to publish with the server's Meta token; give one to publish with that account (Instagram placements only). */
  publish: (id: string, instagramAccountId?: string) =>
    mutateSource<Draft>(
      () => {
        throw new ApiError('Live publishing is not available in sample mode.', 409, 'not_configured');
      },
      { method: 'post', path: `/ads/studio/drafts/${encodeURIComponent(id)}/publish`, body: instagramAccountId ? { instagramAccountId } : undefined },
    ),

  activate: (id: string, confirmDailyBudget: number) =>
    mutateSource<Draft>(
      () => {
        throw new ApiError('Live publishing is not available in sample mode.', 409, 'not_configured');
      },
      { method: 'post', path: `/ads/studio/drafts/${encodeURIComponent(id)}/activate`, body: { confirmDailyBudget } },
    ),

  insights: (id: string) =>
    fromSource<DraftInsights>(() => {
      const d = findDraft(id);
      return {
        draftId: d.id,
        mode: d.mode,
        available: false,
        source: 'none',
        metrics: null,
        advice: [],
        guardrails: d.guardrails,
        fetchedAt: null,
        note: 'No results: this ad was not published to Meta (dry run), so there are no real numbers. SocialBoard does not show example numbers.',
      };
    }, `/ads/studio/drafts/${encodeURIComponent(id)}/insights`),
};

/** `details.violations` from a 422 guardrail error (or []). */
export function guardrailViolations(err: unknown): string[] {
  if (!(err instanceof ApiError)) return [];
  const details = (err.body as { error?: { details?: { violations?: unknown } } } | undefined)?.error?.details;
  return Array.isArray(details?.violations) ? details.violations.filter((v): v is string => typeof v === 'string') : [];
}
