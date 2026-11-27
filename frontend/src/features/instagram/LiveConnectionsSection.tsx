import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Avatar, Notice } from '@/components/ui/Misc';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { invalidateQueries, useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { formatNumber } from '@/lib/format';
import { instagramService } from '@/services/instagram';
import type { InstagramConnection, IntegrationStatus } from '@/types/instagram';
import { callbackReasons, connectionUiState, daysUntil, liveStateMeta, type LiveUiState } from './liveMeta';
import { SyncNowButton, SyncSummary } from './SyncWidgets';
import { INSTAGRAM_QUERY_KEYS, useInstagramActions } from './useInstagramActions';
import { useSyncState } from './useSyncState';

export function LiveStateBadge({ state }: { state: LiveUiState }) {
  const t = useT();
  const meta = liveStateMeta[state];
  return (
    <Badge tone={meta.tone} icon={meta.icon} className={state === 'connecting' ? '[&_.material-symbols-outlined]:animate-spin' : undefined}>
      {t(meta.label)}
    </Badge>
  );
}

export function LiveSourceBadge() {
  const t = useT();
  return (
    <Badge tone="active" icon="verified">
      {t('Live')}
    </Badge>
  );
}

/** Handles the redirect back from Instagram (`/accounts?instagram=connected|error&reason=…`) exactly once. */
function useCallbackResult(onConnected: (id: string) => void) {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const handled = useRef(false);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  useEffect(() => {
    const outcome = params.get('instagram');
    if (!outcome || handled.current) return;
    handled.current = true;
    const account = params.get('account');
    const reason = params.get('reason') ?? 'authorization_failed';
    const next = new URLSearchParams(params);
    ['instagram', 'reason', 'account'].forEach((k) => next.delete(k));
    setParams(next, { replace: true });
    if (outcome === 'connected' && account && /^igc_[a-f0-9]+$/.test(account)) {
      toast({ title: t('Instagram account connected'), description: t('The first sync has started in the background.') });
      onConnected(account);
    } else {
      setError(callbackReasons[reason] ?? callbackReasons.authorization_failed);
    }
  }, [params, setParams, toast, onConnected, t]);
  return { error, dismiss: () => setError(null) };
}

function DisabledNotice({ status }: { status: IntegrationStatus }) {
  const t = useT();
  return (
    <Notice tone="warning" title={t('Live Instagram connection is not configured on this server')}>
      {t('An admin needs to set these server settings:')} <span className="font-mono text-[0.75rem]">{status.missingConfig.join(', ')}</span>
    </Notice>
  );
}

function LiveAccountRow({ c, actions, canManage }: { c: InstagramConnection; actions: ReturnType<typeof useInstagramActions>; canManage: boolean }) {
  const t = useT();
  const state = connectionUiState(c);
  const sync = useSyncState(c.id);
  const expiresIn = daysUntil(c.tokenExpiresAt);
  return (
    <li className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={c.username} src={c.profilePictureUrl ?? undefined} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/accounts/live/${c.id}`} className="font-semibold text-text-primary hover:underline">
              @{c.username}
            </Link>
            {c.name && <span className="text-body-sm text-text-secondary truncate">{c.name}</span>}
            <LiveStateBadge state={state} />
          </div>
          <div className="text-[0.75rem] text-text-secondary mt-0.5 flex flex-wrap gap-x-3">
            <span>{c.accountType === 'MEDIA_CREATOR' ? t('Creator account') : c.accountType === 'BUSINESS' ? t('Business account') : t('Professional account')}</span>
            <span>{t('Followers: {count}', { count: c.followersCount === null ? t('not returned') : formatNumber(c.followersCount) })}</span>
            <span>{t('Posts: {count}', { count: c.mediaCount === null ? t('not returned') : formatNumber(c.mediaCount) })}</span>
            {expiresIn !== null && <span className={expiresIn < 7 ? 'text-error font-medium' : undefined}>{t('Login expires in {days} days', { days: Math.max(expiresIn, 0) })}</span>}
          </div>
          <div className="mt-1.5 max-w-xl"><SyncSummary sync={sync} /></div>
          {c.lastErrorMessage && !sync.active && <p className="text-[0.75rem] text-error mt-1">{c.lastErrorMessage}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {state === 'needs_reauth' ? (
          <Button variant="primary" icon="key" onClick={() => void actions.connect()} loading={actions.connecting}>
            {t('Reconnect')}
          </Button>
        ) : (
          <SyncNowButton sync={sync} disabled={!canManage} />
        )}
        <Link to={`/accounts/live/${c.id}`} className="h-8 px-3 inline-flex items-center rounded-lg border border-border-strong text-label-sm font-semibold text-text-primary hover:bg-surface-canvas">
          {t('View data')}
        </Link>
        <Button variant="ghost" icon="link_off" onClick={() => actions.requestDisconnect(c)}>
          {t('Disconnect')}
        </Button>
      </div>
    </li>
  );
}

/**
 * API mode only: the workspace's *live* Instagram connections, kept visually separate from the sample
 * (demo) accounts so live and demo numbers are never mixed.
 */
export function LiveConnectionsSection() {
  const t = useT();
  const status = useQuery('instagram:status', instagramService.status);
  const accounts = useQuery('instagram:accounts', instagramService.accounts, { enabled: status.data?.enabled === true, isEmpty: () => false });
  const actions = useInstagramActions();
  const firstSync = useRef<string | null>(null);

  // The server queues the first sync when the connection is created; each row then follows its job.
  const onConnected = (id: string) => {
    if (firstSync.current === id) return;
    firstSync.current = id;
    INSTAGRAM_QUERY_KEYS.forEach(invalidateQueries);
  };
  const callback = useCallbackResult(onConnected);

  const canManage = status.data?.canManage ?? false;
  const rows = accounts.data ?? [];

  return (
    <section className="bg-surface-card border border-border-strong rounded-xl shadow-card" aria-labelledby="live-ig-heading">
      <div className="px-5 pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 id="live-ig-heading" className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('Live Instagram connections')}</h2>
            <LiveSourceBadge />
          </div>
          <p className="text-body-sm text-text-secondary mt-0.5">{t('Read-only. SocialBoard never posts, replies or reads messages.')}</p>
        </div>
        {status.data?.enabled && (
          <Button variant="primary" size="md" icon={actions.connecting ? 'progress_activity' : 'add_link'} onClick={() => void actions.connect()} loading={actions.connecting}
            disabled={!canManage} title={canManage ? undefined : t('Only owners and admins can connect accounts.')}>
            {actions.connecting ? t('Connecting…') : t('Connect with Instagram')}
          </Button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {callback.error && (
          <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-error/30 bg-error-container/40" role="alert">
            <div>
              <p className="font-semibold text-text-primary text-body-sm">{t(callback.error.title)}</p>
              <p className="text-body-sm text-text-secondary">{t(callback.error.detail)}</p>
            </div>
            <button type="button" aria-label={t('Dismiss')} onClick={callback.dismiss} className="text-text-secondary hover:text-text-primary">
              <Icon name="close" />
            </button>
          </div>
        )}
        {status.status === 'loading' ? (
          <Skeleton className="h-16" />
        ) : status.error ? (
          <ErrorState title={t('Could not load the Instagram status')} error={status.error} onRetry={status.refetch} />
        ) : status.data && !status.data.enabled ? (
          <DisabledNotice status={status.data} />
        ) : accounts.error ? (
          <ErrorState title={t('Could not load connected accounts')} error={accounts.error} onRetry={accounts.refetch} />
        ) : accounts.status === 'loading' ? (
          <Skeleton className="h-20" />
        ) : rows.length === 0 ? (
          <div className="flex items-center gap-3 text-body-sm text-text-secondary">
            <LiveStateBadge state={actions.connecting ? 'connecting' : 'not_connected'} />
            <span>{canManage ? t('No account connected yet. Connect a Business or Creator account.') : t('No account connected yet. Ask an owner or admin to connect one.')}</span>
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle border border-border-strong rounded-lg">
            {rows.map((c) => (
              <LiveAccountRow key={c.id} c={c} actions={actions} canManage={canManage} />
            ))}
          </ul>
        )}
      </div>
      {actions.overlays}
    </section>
  );
}
