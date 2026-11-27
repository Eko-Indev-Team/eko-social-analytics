/**
 * Ads reports + Ad Studio in demo mode: Experiments rendering, Performance awards, and the Ad Studio
 * guardrail → dry-run flow (the build only prepares the Meta requests; live publish stays unavailable).
 */
import { configure, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { withProviders } from '@/App';
import { clearQueryCache } from '@/hooks/useQuery';
import AdsExperimentsPage from '@/pages/ads/AdsExperimentsPage';
import AdsPerformancePage from '@/pages/ads/AdsPerformancePage';
import AdStudioPage from '@/pages/ads/AdStudioPage';
import { checkCopy } from '@/services/adStudio';

configure({ asyncUtilTimeout: 8000 });

function renderAt(path: string, element: JSX.Element) {
  const router = createMemoryRouter(withProviders([{ path: path.split('?')[0], element }]), { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

beforeEach(() => clearQueryCache());

describe('Ads experiments page', () => {
  it('shows each experiment with question, results table, learning, verdict, confidence and don\'t-repeat', async () => {
    renderAt('/ads/experiments', <AdsExperimentsPage />);
    const card = await screen.findByTestId('experiment-geo');
    expect(within(card).getByText('1. Narrow vs. broad pincode lists')).toBeInTheDocument();
    expect(within(card).getByText(/Does targeting fewer pincodes/)).toBeInTheDocument();
    expect(within(card).getByText('Mixed result')).toBeInTheDocument();
    expect(within(card).getByText('High confidence')).toBeInTheDocument();
    // Cells are formatted by column kind: money (₹), percent, count.
    expect(within(card).getByText('₹4,200')).toBeInTheDocument();
    expect(within(card).getByText('32.9%')).toBeInTheDocument();
    expect(within(card).getByText("Don't repeat:")).toBeInTheDocument();
    expect(screen.getByText('Mistakes to avoid')).toBeInTheDocument();
    expect(screen.getByText('What competitors and the market do')).toBeInTheDocument();
    expect(screen.getAllByText(/as of Oct 19, 2026/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sample data').length).toBeGreaterThan(0);
  });
});

describe('Ads performance page', () => {
  it('shows the best ad, the award cards and the lead status counts', async () => {
    renderAt('/ads/performance', <AdsPerformancePage />);
    expect(await screen.findByText('Best ad so far')).toBeInTheDocument();
    expect(screen.getByText('Cheapest result')).toBeInTheDocument();
    expect(screen.getByText('Lead Form leads by status')).toBeInTheDocument();
    expect(screen.getAllByText('Pitch ESAF').length).toBeGreaterThan(0);
    expect(screen.getByText('Every ad, ranked')).toBeInTheDocument();
  });
});

describe('Ad Studio', () => {
  it('rejects banned wording and unapproved CTAs like the server does', () => {
    const base = { headlineLine1: 'a', headlineLine2: '', subheading: 'b', primaryText: 'c', description: 'd', bullets: [], ctaText: 'आज ही आवेदन करें' };
    expect(checkCopy(base, 'general_opportunity')).toEqual([]);
    expect(checkCopy({ ...base, bullets: ['please check eligibility'] })[0]).toMatch(/Check Eligibility/);
    expect(checkCopy({ ...base, ctaText: 'Click here' })[0]).toMatch(/approved phrases/);
  });

  it('blocks a build with banned wording, then builds a dry run and shows what would be sent', async () => {
    renderAt('/ads/studio', <AdStudioPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Use this caption' }));
    const line2 = await screen.findByLabelText('Headline line 2');
    expect(screen.getByText('Approved caption', { selector: 'span' })).toBeInTheDocument();

    fireEvent.change(line2, { target: { value: 'Check Eligibility' } });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('wording is not allowed');
    expect(screen.getByRole('button', { name: 'Build dry run' })).toBeDisabled();
    expect(screen.getByText('Custom')).toBeInTheDocument();

    fireEvent.change(line2, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Demo District A' }));
    const build = screen.getByRole('button', { name: 'Build dry run' });
    expect(build).toBeEnabled();
    fireEvent.click(build);

    expect(await screen.findByText('What would be sent to Meta')).toBeInTheDocument();
    expect(screen.getAllByText('Dry run').length).toBeGreaterThan(0);
    expect(screen.getByText(/nothing was sent to Meta/)).toBeInTheDocument();
    // Live publishing is not available in demo mode: the button is disabled and the reason is shown.
    expect(screen.getByRole('button', { name: 'Publish (paused)' })).toBeDisabled();
    expect(screen.getByText(/Live publishing is not set up/)).toBeInTheDocument();
    // Dry runs never get example numbers.
    expect(await screen.findByText(/SocialBoard does not show example numbers/)).toBeInTheDocument();
  });
});
