/**
 * Instagram publishing page + Ad Studio "Publish with" (api mode, mocked fetch): composer validation, a successful
 * POST with a confirmation step, cancelling a scheduled post, the quota line, and the Ad Studio publish body
 * carrying `instagramAccountId` when an Instagram account is chosen.
 */
vi.mock('@/lib/config', () => ({
  config: { dataSource: 'api', apiBaseUrl: 'http://api.test/api/v1', demoLatencyMs: 0, allowedEmailDomains: ['example.test'] },
  isDemoMode: false,
  modeText: (_demo: string, api: string) => api,
}));

import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { withProviders } from '@/App';
import { demoStudioOptions } from '@/data/adStudio';
import { clearQueryCache } from '@/hooks/useQuery';
import { setCsrfToken } from '@/lib/api/client';
import AdStudioPage from '@/pages/ads/AdStudioPage';
import PublishPage from '@/pages/instagram/PublishPage';
import { localToIsoWithOffset } from '@/features/instagram/PublishComposer';
import type { Draft, StudioOptions } from '@/types/adStudio';
import type { Publication, PublishingStatus } from '@/types/instagramPublishing';

configure({ asyncUtilTimeout: 8000 });

const me = (permissions: string[]) => ({
  user: { id: 'usr_1', name: 'Test Owner', email: 'owner@example.test', isPlatformAdmin: false },
  member: { id: 'm1', name: 'Test Owner', email: 'owner@example.test', role: 'Owner', access: 'Owner', status: 'active', lastActive: 'now' },
  workspace: { id: 'ws-1', name: 'Test Workspace' },
  role: 'Owner',
  permissions,
  csrfToken: 'csrf-test-token',
  session: { id: 's1', createdAt: '2026-11-01T00:00:00Z', lastSeenAt: '2026-11-01T00:00:00Z', idleExpiresAt: '2026-11-01T02:00:00Z', absoluteExpiresAt: '2026-11-02T00:00:00Z', current: true },
});
const OWNER = ['read', 'write', 'accounts:manage', 'ads:manage', 'instagram:publish'];

const STATUS: PublishingStatus = {
  enabled: true,
  canPublish: true,
  uploadsAvailable: false,
  accounts: [
    { id: 'igc_aa11', username: 'eko_live', profilePictureUrl: null, canPublish: true, reason: null },
    { id: 'igc_bb22', username: 'eko_old', profilePictureUrl: null, canPublish: false, reason: 'Reconnect this account first.' },
  ],
  limits: { captionMax: 2200, hashtagsMax: 30, mentionsMax: 20, carouselMin: 2, carouselMax: 10, altTextMax: 1000, imageMaxBytes: 8388608, scheduleMaxDays: 75 },
  notes: ['Posts are published by the background worker.'],
};

const pub = (over: Partial<Publication> = {}): Publication => ({
  id: 'igp_1', accountId: 'igc_aa11', accountUsername: 'eko_live', kind: 'image', caption: 'Hello #eko', items: [{ type: 'image', url: 'https://cdn.example.com/a.jpg', assetId: null, previewUrl: null }],
  shareToFeed: null, altText: null, coverUrl: null, status: 'published', scheduledAt: null, publishedAt: '2026-11-20T10:00:00Z', igMediaId: '1789',
  permalink: 'https://www.instagram.com/p/abc/', errorCode: null, errorMessage: null, createdAt: '2026-11-20T09:59:00Z', createdByName: 'Test Owner', canCancel: false, ...over,
});

type Handler = (url: string, init?: RequestInit) => { status?: number; body: unknown } | undefined;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function mockFetch(handler: Handler, permissions = OWNER) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith('/auth/me')) return json(200, me(permissions));
      const r = handler(url, init);
      return r ? json(r.status ?? 200, r.body) : json(404, { error: { code: 'not_found', message: 'Not found' } });
    }),
  );
  return calls;
}

function publishingApi(list: Publication[], extra: Handler = () => undefined): Handler {
  return (url, init) => {
    const r = extra(url, init);
    if (r) return r;
    if (url.endsWith('/integrations/instagram/publishing')) return { body: STATUS };
    if (url.includes('/integrations/instagram/publications?') && (init?.method ?? 'GET') === 'GET') return { body: list };
    if (url.endsWith('/publishing-limit')) return { body: { quotaUsage: 3, quotaTotal: 50, quotaDuration: 86400 } };
    return undefined;
  };
}

function renderAt(path: string, element: JSX.Element) {
  const router = createMemoryRouter(withProviders([{ path: path.split('?')[0], element }]), { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  clearQueryCache();
  setCsrfToken(null);
});
afterEach(() => vi.unstubAllGlobals());

describe('Instagram publishing page (api mode)', () => {
  it('shows notes, the quota, disabled accounts with their reason, and recent posts', async () => {
    mockFetch(publishingApi([pub(), pub({ id: 'igp_2', status: 'failed', permalink: null, publishedAt: null, errorMessage: 'The picture link could not be downloaded.' })]));
    renderAt('/instagram/publish', <PublishPage />);
    expect(await screen.findByText('Posts are published by the background worker.')).toBeInTheDocument();
    expect(await screen.findByText('Posts in the last 24 h: 3 / 50')).toBeInTheDocument();
    const option = screen.getByRole('option', { name: /@eko_old \(Reconnect this account first\.\)/ }) as HTMLOptionElement;
    expect(option.disabled).toBe(true);
    expect(await screen.findByRole('link', { name: /View on Instagram/ })).toHaveAttribute('href', 'https://www.instagram.com/p/abc/');
    expect(screen.getByText('The picture link could not be downloaded.')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('refuses a carousel with too few items without calling the API', async () => {
    const calls = mockFetch(publishingApi([]));
    renderAt('/instagram/publish', <PublishPage />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Carousel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add picture link' }));
    fireEvent.change(screen.getByLabelText('Picture link 1'), { target: { value: 'https://cdn.example.com/1.jpg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('A carousel needs 2 to 10 pictures or videos.')).toBeInTheDocument();
    expect(calls.some((c) => c.init?.method === 'POST')).toBe(false);

    // A second item makes it valid; the up/down buttons reorder.
    fireEvent.click(screen.getByRole('button', { name: 'Add video link' }));
    fireEvent.change(screen.getByLabelText('Video link 2'), { target: { value: 'https://cdn.example.com/2.mp4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move item 2 up' }));
    expect(screen.getByLabelText('Video link 1')).toHaveValue('https://cdn.example.com/2.mp4');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('This will post publicly on @eko_live.');
    expect(screen.queryByText('A carousel needs 2 to 10 pictures or videos.')).toBeNull();
  });

  it('publishes a photo after confirmation and shows a server error inline', async () => {
    let posts = 0;
    const calls = mockFetch(
      publishingApi([], (url, init) => {
        if (url.endsWith('/integrations/instagram/publications') && init?.method === 'POST') {
          posts += 1;
          return posts === 1
            ? { status: 422, body: { error: { code: 'validation_error', message: 'The picture link must be a public https:// address that Instagram can open.', details: {} } } }
            : { status: 201, body: pub({ status: 'queued', publishedAt: null, permalink: null }) };
        }
        return undefined;
      }),
    );
    renderAt('/instagram/publish', <PublishPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add picture link' }));
    fireEvent.change(screen.getByLabelText('Picture link 1'), { target: { value: 'https://cdn.example.com/a.jpg' } });
    fireEvent.change(screen.getByLabelText('Caption'), { target: { value: 'Hello #eko #csp' } });
    expect(screen.getByText(/2 \/ 30 hashtags/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Alt text (optional)'), { target: { value: 'A shop' } });

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Yes, publish' }));
    expect(await screen.findByText('The picture link must be a public https:// address that Instagram can open.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Yes, publish' }));
    expect(await screen.findByText('Post sent to Instagram')).toBeInTheDocument();
    const post = calls.filter((c) => c.url.endsWith('/integrations/instagram/publications') && c.init?.method === 'POST').at(-1)!;
    expect(new Headers(post.init?.headers).get('X-CSRF-Token')).toBe('csrf-test-token');
    expect(JSON.parse(String(post.init?.body))).toEqual({
      accountId: 'igc_aa11', kind: 'image', caption: 'Hello #eko #csp', items: [{ type: 'image', url: 'https://cdn.example.com/a.jpg' }], scheduledAt: null, altText: 'A shop',
    });
  });

  it('sends a scheduled time with the browser offset', () => {
    expect(localToIsoWithOffset('2026-12-01T10:30')).toMatch(/^2026-12-01T10:30:00[+-]\d{2}:\d{2}$/);
  });

  it('cancels a scheduled post', async () => {
    const later = new Date(Date.now() + 3 * 86_400_000).toISOString();
    let cancelled = false;
    const calls = mockFetch(
      publishingApi([], (url, init) => {
        if (url.includes('/publications?') && (init?.method ?? 'GET') === 'GET')
          return { body: [pub({ id: 'igp_9', status: cancelled ? 'cancelled' : 'scheduled', scheduledAt: later, publishedAt: null, permalink: null, canCancel: !cancelled })] };
        if (url.endsWith('/publications/igp_9/cancel') && init?.method === 'POST') {
          cancelled = true;
          return { body: pub({ id: 'igp_9', status: 'cancelled', scheduledAt: later, publishedAt: null, permalink: null }) };
        }
        return undefined;
      }),
    );
    renderAt('/instagram/publish', <PublishPage />);
    expect(await screen.findByText('Scheduled')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel post' }));
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel post' })).toBeNull();
    expect(calls.some((c) => c.url.endsWith('/publications/igp_9/cancel'))).toBe(true);
  });

  it('keeps the composer read-only without instagram:publish', async () => {
    mockFetch(publishingApi([], (url) => (url.endsWith('/integrations/instagram/publishing') ? { body: { ...STATUS, canPublish: false } } : undefined)), ['read', 'write']);
    renderAt('/instagram/publish', <PublishPage />);
    expect(await screen.findByText('Only an Admin or Owner can publish posts.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
  });
});

describe('Ad Studio: publish with an Instagram account (api mode)', () => {
  const options: StudioOptions = {
    ...demoStudioOptions,
    notes: [],
    capabilities: { ...demoStudioOptions.capabilities, livePublish: true, livePublishMissing: [], instagramPublishAccounts: [{ id: 'igc_ads1', username: 'eko_ads' }] },
  };
  const draft = (over: Partial<Draft> = {}): Draft => ({
    id: 'ads_abc', status: 'built', mode: 'dry_run', createdAt: '2026-11-20T10:00:00Z', updatedAt: '2026-11-20T10:00:00Z', createdByName: 'Test Owner',
    headline: 'Open a CSP', angle: 'general_opportunity', objective: 'leads', copySource: 'locked_caption', districts: [], pincodeCount: 0, dailyBudget: 500,
    hasImage: true, imageUrl: 'https://cdn.example.com/ad.jpg', metaIds: { campaignId: null, adSetId: null, imageHash: null, creativeId: null, adId: null }, error: null,
    brief: { product: 'CSP', description: '', objective: 'leads', tone: '', visual_style: '', language: 'hindi', angle: 'general_opportunity' },
    copy: {
      headlineLine1: 'Open a CSP', headlineLine2: '', subheading: '', primaryText: 'Open a CSP', description: '', bullets: [], ctaText: demoStudioOptions.ctas[0].text,
      cta: demoStudioOptions.ctas[0].metaType, headline: 'Open a CSP', angle: 'general_opportunity', source: 'locked_caption', captionIndex: 1, aiModel: null, note: null,
      guardrails: { ok: true, violations: [], removedPhrases: [], ctaReplaced: false },
    },
    targeting: {
      districts: [], removed: [], anchors: [], villages: [], pincodes: [], unresolvedDistricts: [], ageMin: 21, ageMax: 45, gender: 'all', dailyBudget: 500, scheduleDays: 7,
      placements: 'advantage', metaTargeting: {}, notes: [],
    },
    destination: { type: 'website', url: 'https://example.com', number: null },
    guardrails: { maxDailySpend: 500, targetCpa: null },
    imageSource: 'upload',
    payload: {
      campaign: { name: 'CSP', objective: 'OUTCOME_LEADS', status: 'PAUSED' }, ad_set: {}, ad_creative: {}, ad: {}, ad_image: { upload: 'picture' },
      review: { unresolved_districts: [], placements: 'advantage', schedule_days: 7, schedule_note: '', call_whatsapp_number: null },
    },
    canPublish: true, canActivate: false, publishedAt: null, activatedAt: null, publishedWith: null, notes: [], ...over,
  });

  function studioApi(current: () => Draft, onPublish: (body: unknown) => Draft): Handler {
    return (url, init) => {
      if (url.endsWith('/ads/studio/options')) return { body: options };
      if (url.includes('/ads/studio/drafts?')) return { body: [] };
      if (url.endsWith('/ads/studio/drafts/ads_abc/insights'))
        return { body: { draftId: 'ads_abc', mode: 'dry_run', available: false, source: 'none', metrics: null, advice: [], guardrails: { maxDailySpend: 500, targetCpa: null }, fetchedAt: null, note: 'No results.' } };
      if (url.endsWith('/ads/studio/drafts/ads_abc/publish') && init?.method === 'POST') return { body: onPublish(init.body ? JSON.parse(String(init.body)) : undefined) };
      if (url.endsWith('/ads/studio/drafts/ads_abc')) return { body: current() };
      return undefined;
    };
  }

  it('defaults to the server token and sends instagramAccountId when an Instagram account is chosen', async () => {
    let state = draft();
    let sent: unknown = 'not called';
    mockFetch(
      studioApi(
        () => state,
        (body) => {
          sent = body;
          state = draft({ mode: 'live', publishedWith: '@eko_ads', canPublish: false, canActivate: true });
          return state;
        },
      ),
    );
    renderAt('/ads/studio?draft=ads_abc', <AdStudioPage />);
    const select = (await screen.findByLabelText('Publish with')) as HTMLSelectElement;
    expect(select.value).toBe('server');
    expect(within(select).getByRole('option', { name: '@eko_ads (Instagram only)' })).toBeInTheDocument();
    expect(screen.getByText('Ads published with an Instagram account run on Instagram only.')).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'igc_ads1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish (paused)' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('@eko_ads');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create paused' }));
    await waitFor(() => expect(sent).toEqual({ instagramAccountId: 'igc_ads1' }));
    expect(await screen.findByText('Published with @eko_ads')).toBeInTheDocument();
  });

  it('sends no body when publishing with the server token', async () => {
    let sent: unknown = 'not called';
    mockFetch(
      studioApi(
        () => draft(),
        (body) => {
          sent = body;
          return draft({ mode: 'live', publishedWith: 'server', canPublish: false });
        },
      ),
    );
    renderAt('/ads/studio?draft=ads_abc', <AdStudioPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Publish (paused)' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Create paused' }));
    await waitFor(() => expect(sent).toBeUndefined());
  });
});
