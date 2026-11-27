import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { withProviders } from '@/App';
import { routes } from '@/app/routes';
import { clearQueryCache } from '@/hooks/useQuery';
import { adsService } from '@/services/ads';
import type { Permission } from '@/types/auth';

/** Permissions the test takes away (demo mode otherwise grants everything). */
const denied = new Set<Permission>();
vi.mock('@/app/AuthContext', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/app/AuthContext')>();
  return {
    ...mod,
    useAuth: () => {
      const value = mod.useAuth();
      return { ...value, can: (p: Permission) => !denied.has(p) && value.can(p) };
    },
  };
});

function renderAt(path: string) {
  const router = createMemoryRouter(withProviders(routes), { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('Ads dashboard (demo mode)', () => {
  beforeEach(() => {
    clearQueryCache();
    denied.clear();
  });

  it('shows the sync status, numbers, lead quality and the ads table; opens an ad', async () => {
    const router = renderAt('/ads');
    expect(await screen.findByRole('heading', { level: 1, name: 'Ads' }, { timeout: 15000 })).toBeInTheDocument();
    const banner = (await screen.findByText(/Last synced/)).closest('[role="status"]') as HTMLElement;
    expect(within(banner).getByRole('button', { name: /Sync now/ })).toBeInTheDocument();
    expect(await screen.findByText('Money spent')).toBeInTheDocument();
    expect(screen.getByText('How good are the leads?')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Ads pages' })).toBeInTheDocument();

    const row = await screen.findByRole('row', { name: /Open ad Demo ad · CSP shop owner \(Hindi\)/ });
    fireEvent.click(row);
    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByText('8 pincodes targeted')).toBeInTheDocument();
    expect(within(drawer).getByText('Age and gender')).toBeInTheDocument();
    expect(await within(drawer).findByText('Leads from this ad')).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: /Download Excel/ })).toBeInTheDocument();
    expect(router.state.location.search).toContain('ad=');
  }, 30000);

  it('search narrows the ads table', async () => {
    renderAt('/ads');
    const search = await screen.findByRole('searchbox', { name: 'Search ads' }, { timeout: 15000 });
    await screen.findByRole('row', { name: /Demo ad · Punjab villages/ });
    fireEvent.change(search, { target: { value: 'Punjab' } });
    await waitFor(() => expect(screen.queryByRole('row', { name: /CSP shop owner/ })).toBeNull());
    expect(screen.getByRole('row', { name: /Demo ad · Punjab villages/ })).toBeInTheDocument();
  }, 30000);

  it('hides Sync now without ads:manage and the download without ads:leads', async () => {
    denied.add('ads:manage');
    denied.add('ads:leads');
    renderAt('/ads');
    const banner = (await screen.findByText(/Last synced/, undefined, { timeout: 15000 })).closest('[role="status"]') as HTMLElement;
    expect(within(banner).queryByRole('button', { name: /Sync now/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Download all leads/ })).toBeNull();
  }, 30000);

  it('tells an admin how to connect Meta when it is not configured', async () => {
    const spy = vi.spyOn(adsService, 'status').mockResolvedValue({
      configured: false, signupsConfigured: false, studioPublishConfigured: false, lastSyncedAt: null, lastSyncStatus: null,
      lastErrorCode: null, lastErrorMessage: null, tokenExpired: false, currentJob: null, adCount: 0, leadCount: 0, canSync: true, canSeeLeads: true,
    });
    renderAt('/ads');
    expect(await screen.findByText('Meta Ads is not connected yet', undefined, { timeout: 15000 })).toBeInTheDocument();
    expect(screen.getByText(/META_ADS_ACCESS_TOKEN/)).toBeInTheDocument();
    spy.mockRestore();
  }, 30000);

  it('shows a red banner when the Meta token expired', async () => {
    const spy = vi.spyOn(adsService, 'status').mockResolvedValue({
      configured: true, signupsConfigured: false, studioPublishConfigured: false, lastSyncedAt: '2026-11-10T10:00:00Z', lastSyncStatus: 'failed',
      lastErrorCode: 'TOKEN_EXPIRED', lastErrorMessage: 'expired', tokenExpired: true, currentJob: null, adCount: 12, leadCount: 40, canSync: true, canSeeLeads: true,
    });
    renderAt('/ads');
    expect(await screen.findByRole('alert', undefined, { timeout: 15000 })).toHaveTextContent('The Meta token has expired');
    spy.mockRestore();
  }, 30000);
});

describe('Ad leads page (demo mode)', () => {
  beforeEach(() => {
    clearQueryCache();
    denied.clear();
  });

  it('filters by status chip and records a Pitch ESAF answer', async () => {
    renderAt('/ads/leads?status=esaf_pitch');
    expect(await screen.findByRole('heading', { level: 1, name: 'Ad leads' }, { timeout: 15000 })).toBeInTheDocument();
    const group = (await screen.findAllByRole('group', { name: /ESAF answer for Demo Lead/ }))[0];
    const chips = screen.getByRole('group', { name: 'Filter by status' });
    const pitchChip = within(chips).getByRole('button', { name: /Pitch ESAF/ });
    expect(pitchChip).toHaveAttribute('aria-pressed', 'true');
    const before = Number(pitchChip.textContent?.match(/(\d+)$/)?.[1]);
    expect(before).toBeGreaterThan(0);
    const name = group.getAttribute('aria-label')!.replace('ESAF answer for ', '');
    expect(screen.getAllByText('Pitch ESAF').length).toBeGreaterThan(1);
    fireEvent.click(within(group).getByRole('button', { name: /Yes/ }));
    expect(await screen.findByText('ESAF answer saved')).toBeInTheDocument();
    // The lead moves out of "Pitch ESAF" (to ESAF strong or Check details) and the count drops by one.
    await waitFor(() => expect(screen.queryByRole('group', { name: `ESAF answer for ${name}` })).toBeNull());
    await waitFor(() => expect(within(chips).getByRole('button', { name: /Pitch ESAF/ }).textContent).toMatch(new RegExp(`${before - 1}$`)));
  }, 30000);

  it('shows reasons in plain words and the answers when a row is expanded', async () => {
    renderAt('/ads/leads?status=not_qualified');
    const first = (await screen.findAllByRole('button', { name: /Demo Lead/, expanded: false }, { timeout: 15000 }))[0];
    fireEvent.click(first);
    expect(await screen.findByText('Highest education')).toBeInTheDocument();
    expect(screen.getAllByText(/Studied below 12th|Cannot invest|Pincode is outside the SBI area/).length).toBeGreaterThan(0);
  }, 30000);

  it('masks contact details and hides the download without ads:leads', async () => {
    denied.add('ads:leads');
    denied.add('write');
    const spy = vi.spyOn(adsService, 'leads').mockResolvedValue([
      {
        id: '1', adId: '2', adName: 'Demo ad', campaignName: 'Demo', createdTime: '2026-11-18T10:00:00+0530', name: null, phone: '•••••• 0001',
        submittedPincode: '273001', pincodeQualified: true, passesScreening: true, qualified: true, qualificationStatus: 'sbi_strong', sbiReasons: [],
        pincodeMatch: true, educationLevel: 'Graduate', educationOk: true, canInvest: true, esafResponse: null, esafResponseSource: null, answers: null,
      },
    ]);
    renderAt('/ads/leads');
    expect(await screen.findByText('Names and phone numbers are hidden', undefined, { timeout: 15000 })).toBeInTheDocument();
    expect(await screen.findByText('•••••• 0001')).toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download Excel/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Yes$/ })).toBeNull();
    spy.mockRestore();
  }, 30000);
});

describe('SocialBoard Leads: SBI / ESAF fit (demo mode)', () => {
  beforeEach(() => {
    clearQueryCache();
    denied.clear();
  });

  it('recomputes the status after saving answers', async () => {
    renderAt('/leads?lead=lead-sunita-devi');
    const section = await screen.findByRole('region', { name: 'SBI / ESAF fit' }, { timeout: 15000 });
    expect(within(section).getByText('Pitch ESAF')).toBeInTheDocument();
    const selects = within(section).getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'yes' } }); // Said yes to ESAF?
    fireEvent.click(within(section).getByRole('button', { name: 'Save answers' }));
    await waitFor(() => expect(within(section).getByText('Strongly qualified · ESAF')).toBeInTheDocument());
  }, 30000);
});
