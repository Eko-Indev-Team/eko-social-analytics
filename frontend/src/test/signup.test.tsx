/**
 * Sign-up (api mode): only allowed email domains are submitted; the server's answer ("pending approval") is shown as is.
 */
import { vi } from 'vitest';

vi.mock('@/lib/config', () => ({
  config: { dataSource: 'api', apiBaseUrl: 'http://api.test/api/v1', demoLatencyMs: 0, allowedEmailDomains: ['eko.co.in'] },
  isDemoMode: false,
  modeText: (_demo: string, api: string) => api,
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { withProviders } from '@/App';
import { routes } from '@/app/routes';
import { emailDomainAllowed } from '@/lib/emailDomain';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function fillAndSubmit(email: string) {
  fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'New Joiner' } });
  fireEvent.change(screen.getByLabelText(/Work email/), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'Correct-Horse-Battery-42' } });
  fireEvent.change(screen.getByLabelText(/Confirm password/), { target: { value: 'Correct-Horse-Battery-42' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
}

describe('sign-up', () => {
  it('checks the email domain', () => {
    expect(emailDomainAllowed('Mansi.Kanchan.Intern@EKO.co.in')).toBe(true);
    expect(emailDomainAllowed('someone@gmail.com')).toBe(false);
    expect(emailDomainAllowed('someone@eko.co.in.evil.com')).toBe(false);
  });

  it('rejects other domains without calling the API, then submits an allowed one', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname.replace('/api/v1', '');
      calls.push(path);
      if (path === '/auth/me') return json(401, { error: { code: 'not_authenticated', message: 'Sign in required.', details: null } });
      if (path === '/auth/signup') return json(202, { status: 'pending', message: 'Your request was sent to the workspace admins.' });
      return json(404, { error: { code: 'not_found', message: 'Not found', details: null } });
    }));
    const router = createMemoryRouter(withProviders(routes), { initialEntries: ['/signup'] });
    render(<RouterProvider router={router} />);

    await screen.findByRole('button', { name: 'Sign up' });
    fillAndSubmit('someone@gmail.com');
    expect(await screen.findByRole('alert')).toHaveTextContent('Only @eko.co.in email addresses can sign up.');
    expect(calls).not.toContain('/auth/signup');

    fillAndSubmit('new.joiner@eko.co.in');
    expect(await screen.findByText('Your request was sent to the workspace admins.')).toBeInTheDocument();
    await waitFor(() => expect(calls).toContain('/auth/signup'));
    vi.unstubAllGlobals();
  });
});
