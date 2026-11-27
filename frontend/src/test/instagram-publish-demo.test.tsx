/** Instagram publishing page in demo mode: read-only, no fake accounts or posts, and a clear "use API mode" message. */
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { withProviders } from '@/App';
import { clearQueryCache } from '@/hooks/useQuery';
import PublishPage from '@/pages/instagram/PublishPage';

describe('Instagram publishing page (demo mode)', () => {
  beforeEach(() => clearQueryCache());

  it('shows the connect-a-real-account state and no posts', async () => {
    const router = createMemoryRouter(withProviders([{ path: '/instagram/publish', element: <PublishPage /> }]), { initialEntries: ['/instagram/publish'] });
    render(<RouterProvider router={router} />);
    expect(await screen.findByText('Connect a real account to publish')).toBeInTheDocument();
    expect(await screen.findByText('No posts yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
  });
});
