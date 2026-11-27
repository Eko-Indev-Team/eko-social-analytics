/**
 * Ads reports + Ad Studio in api mode (mocked fetch): signups are masked for a Viewer (no ads:leads),
 * shown in full with ads:leads, and the server's 422 guardrail violations are shown on the Ad Studio build.
 */
vi.mock('@/lib/config', () => ({
  config: { dataSource: 'api', apiBaseUrl: 'http://api.test/api/v1', demoLatencyMs: 0, allowedEmailDomains: ['example.test'] },
  isDemoMode: false,
  modeText: (_demo: string, api: string) => api,
}));

import { configure, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { withProviders } from '@/App';
import { demoStudioOptions } from '@/data/adStudio';
import { clearQueryCache } from '@/hooks/useQuery';
import { setCsrfToken } from '@/lib/api/client';
import AdsSignupsPage from '@/pages/ads/AdsSignupsPage';
import AdStudioPage from '@/pages/ads/AdStudioPage';
import type { SignupsOut } from '@/types/adsReports';
import type { StudioOptions } from '@/types/adStudio';

configure({ asyncUtilTimeout: 8000 });

const me = (permissions: string[]) => ({
  user: { id: 'usr_1', name: 'Test User', email: 'user@example.test', isPlatformAdmin: false },
  member: { id: 'm1', name: 'Test User', email: 'user@example.test', role: 'Viewer', access: 'Viewer', status: 'active', lastActive: 'now' },
  workspace: { id: 'ws-1', name: 'Test Workspace' },
  role: 'Viewer',
  permissions,
  csrfToken: 'csrf-test-token',
  session: { id: 's1', createdAt: '2026-11-01T00:00:00Z', lastSeenAt: '2026-11-01T00:00:00Z', idleExpiresAt: '2026-11-01T02:00:00Z', absoluteExpiresAt: '2026-11-02T00:00:00Z', current: true },
});

const totals = { totalSignups: 2, campaignMatched: 1, fbclidOnly: 0, notFacebook: 1, facebookAttributed: 1, strongQualify: 1, facebookLeadFormLeads: 10 };
const signup = (masked: boolean) => ({
  id: '501',
  name: masked ? null : 'Demo Signup 01',
  mobile: masked ? '•••••• 1234' : '99999 01234',
  shopAddress: masked ? null : 'Demo Shop 1',
  submittedAt: '2026-11-01T10:00:00',
  qualificationVerdict: 'STRONG_QUALIFY',
  attributionTier: 'campaign_matched' as const,
  matchedCampaignId: 'c-1',
  matchedCampaignName: 'Demo campaign',
  utmSource: 'facebook',
  utmMedium: 'paid',
  utmCampaign: 'c-1',
});
const signupsOut = (masked: boolean): SignupsOut => ({
  signupsConfigured: true,
  configured: true,
  hasAdData: true,
  piiVisible: !masked,
  tier: null,
  verdict: null,
  totals,
  signups: [signup(masked)],
});

type Handler = (url: string, init?: RequestInit) => { status?: number; body: unknown } | undefined;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function mockFetch(permissions: string[], handler: Handler) {
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

function renderAt(path: string, element: JSX.Element) {
  const router = createMemoryRouter(withProviders([{ path, element }]), { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  clearQueryCache();
  setCsrfToken(null);
});
afterEach(() => vi.unstubAllGlobals());

describe('Website signups (api mode)', () => {
  it('masks names, phones and addresses for a role without ads:leads', async () => {
    mockFetch(['read'], (url) => (url.includes('/ads/signups') ? { body: signupsOut(true) } : undefined));
    renderAt('/ads/signups', <AdsSignupsPage />);
    expect(await screen.findByText('•••••• 1234')).toBeInTheDocument();
    expect(screen.getAllByText('Hidden')).toHaveLength(2);
    expect(screen.getByText('Names, phone numbers and addresses are hidden')).toBeInTheDocument();
    expect(screen.queryByText('Demo Signup 01')).not.toBeInTheDocument();
    expect(screen.getAllByText('Strong Qualify').length).toBeGreaterThan(0);
  });

  it('shows full details with ads:leads and sends the tier filter to the API', async () => {
    const calls = mockFetch(['read', 'write', 'ads:leads'], (url) => (url.includes('/ads/signups') ? { body: signupsOut(false) } : undefined));
    renderAt('/ads/signups', <AdsSignupsPage />);
    expect(await screen.findByText('Demo Signup 01')).toBeInTheDocument();
    expect(screen.getByText('99999 01234')).toBeInTheDocument();
    expect(screen.queryByText('Names, phone numbers and addresses are hidden')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Not from Facebook' }));
    await vi.waitFor(() => expect(calls.some((c) => c.url.endsWith('/ads/signups?tier=none'))).toBe(true));
  });
});

describe('Ad Studio (api mode)', () => {
  it('shows the server guardrail violations when a build is refused', async () => {
    const options: StudioOptions = { ...demoStudioOptions, notes: [] };
    const calls = mockFetch(['read', 'write'], (url, init) => {
      if (url.endsWith('/ads/studio/options')) return { body: options };
      if (url.includes('/ads/studio/drafts') && init?.method === 'GET') return { body: [] };
      if (url.endsWith('/ads/studio/copy')) {
        const c = options.lockedCaptions[0];
        return {
          body: {
            headlineLine1: c.hook, headlineLine2: '', subheading: c.body, primaryText: `${c.hook} ${c.body}`, description: c.body, bullets: [],
            ctaText: c.ctaText, cta: c.cta, headline: c.hook, angle: 'general_opportunity', source: 'locked_caption', captionIndex: 1, aiModel: null, note: null,
            guardrails: { ok: true, violations: [], removedPhrases: [], ctaReplaced: false },
          },
        };
      }
      if (url.endsWith('/ads/studio/drafts') && init?.method === 'POST')
        return { status: 422, body: { error: { code: 'validation_error', message: 'The ad copy breaks the locked rules.', details: { violations: ['Server says: destination is not allowed.'] } } } };
      return undefined;
    });
    renderAt('/ads/studio', <AdStudioPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Use this caption' }));
    await screen.findByLabelText('Headline line 2');
    expect(screen.getByRole('button', { name: 'Write with AI' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Build dry run' }));
    expect(await screen.findByText('Server says: destination is not allowed.')).toBeInTheDocument();
    const post = calls.find((c) => c.url.endsWith('/ads/studio/drafts') && c.init?.method === 'POST');
    expect(new Headers(post?.init?.headers).get('X-CSRF-Token')).toBe('csrf-test-token');
    expect(JSON.parse(String(post?.init?.body)).copy.source).toBe('locked_caption');
  });
});
