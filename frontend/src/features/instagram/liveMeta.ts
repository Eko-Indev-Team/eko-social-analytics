import { msg } from '@/i18n/I18nContext';
import type { Tone } from '@/components/ui/Badge';
import type { InstagramConnection } from '@/types/instagram';

/** UI connection states (the Connecting state is local while the browser is sent to Instagram). */
export type LiveUiState = 'not_connected' | 'connecting' | 'connected' | 'needs_reauth' | 'error';

export function connectionUiState(c: InstagramConnection): LiveUiState {
  if (c.status === 'needs_reauth') return 'needs_reauth';
  if (c.status === 'error') return 'error';
  return 'connected';
}

/** All labels below are English source text (msg); render them with t(). */
export const liveStateMeta: Record<LiveUiState, { label: string; tone: Tone; icon: string }> = {
  not_connected: { label: msg('Not connected'), tone: 'neutral', icon: 'link_off' },
  connecting: { label: msg('Connecting…'), tone: 'scheduled', icon: 'progress_activity' },
  connected: { label: msg('Connected'), tone: 'active', icon: 'check_circle' },
  needs_reauth: { label: msg('Needs new login'), tone: 'amber', icon: 'key' },
  error: { label: msg('Error'), tone: 'error', icon: 'error' },
};

/** Messages for the callback redirect `?instagram=error&reason=…` (only these codes are ever shown). */
export const callbackReasons: Record<string, { title: string; detail: string }> = {
  access_denied: { title: msg('Authorization cancelled'), detail: msg('The request was declined. Nothing was connected.') },
  authorization_failed: { title: msg('Instagram returned an error'), detail: msg('The authorization could not be completed. Try again in a moment.') },
  invalid_state: { title: msg('Connection link not recognised'), detail: msg('Please start again from this page.') },
  state_expired: { title: msg('Connection attempt expired'), detail: msg('It took longer than 10 minutes. Please start again.') },
  state_used: { title: msg('Already processed'), detail: msg('Refresh the page to see the account.') },
  session_mismatch: { title: msg('Different session'), detail: msg('Finish the login in the same browser where you started it.') },
  forbidden: { title: msg('Permission required'), detail: msg('Only workspace owners and admins can connect Instagram accounts.') },
  invalid_callback: { title: msg('Incomplete response'), detail: msg('Instagram did not return an authorization code. Try again.') },
  exchange_failed: { title: msg('Could not complete sign-in'), detail: msg('Instagram did not finish the login. Try again.') },
  permission_missing: { title: msg('Basic permission not granted'), detail: msg('SocialBoard needs the basic profile permission. Reconnect and allow it.') },
  not_professional: { title: msg('Professional account required'), detail: msg('Only Instagram Business or Creator accounts can be connected.') },
  account_mismatch: { title: msg('Account check failed'), detail: msg('The authorized account could not be verified. Nothing was connected.') },
  rate_limited: { title: msg('Instagram rate limit reached'), detail: msg('Wait a few minutes and try again.') },
  provider_unavailable: { title: msg('Instagram is unavailable'), detail: msg('Instagram did not respond in time. Try again shortly.') },
  integration_disabled: { title: msg('Integration not configured'), detail: msg('The server has no Instagram app credentials configured.') },
  no_instagram_account: { title: msg('No Instagram account selected'), detail: msg('Connect again and choose at least one Instagram Business or Creator account.') },
};

export const scopeDescriptions: Record<string, string> = {
  instagram_business_basic: msg('Your profile and list of posts. Required.'),
  instagram_business_manage_insights: msg('Views, reach, likes, comments, shares and saves.'),
  instagram_business_manage_comments: msg('Comments on your posts. SocialBoard only reads them.'),
  // Meta Unified login names for the same permissions.
  instagram_basic: msg('Your profile and list of posts. Required.'),
  instagram_manage_insights: msg('Views, reach, likes, comments, shares and saves.'),
  instagram_manage_comments: msg('Comments on your posts. SocialBoard only reads them.'),
};

export const metricLabels: Record<string, string> = {
  views: msg('Views'),
  reach: msg('People reached'),
  likes: msg('Likes'),
  comments: msg('Comments'),
  shares: msg('Shares'),
  saved: msg('Saves'),
  saves: msg('Saves'),
  total_interactions: msg('Interactions'),
  accounts_engaged: msg('Accounts engaged'),
};

/** "Oct 11, 2026, 14:05" in the viewer's locale; '—' for null. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
}
