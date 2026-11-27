import { useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from '@/app/AuthContext';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { isDemoMode } from '@/lib/config';
import { useQuery, invalidateQueries } from '@/hooks/useQuery';
import { useMutation } from '@/hooks/useMutation';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { adsService } from '@/services/ads';
import type { AdsStatus } from '@/types/ads';
import { formatDateTime } from './adsFormat';

/** Shared query for GET /ads/status (key `ads:status`). */
export const useAdsStatus = () => useQuery('ads:status', adsService.status);

function Shell({ tone, icon, title, children, action }: { tone: 'info' | 'error' | 'warning' | 'ok'; icon: string; title: string; children?: ReactNode; action?: ReactNode }) {
  const styles = {
    info: 'bg-status-completed-subtle border-status-completed/30',
    error: 'bg-error-container/50 border-error/40',
    warning: 'bg-status-paused-subtle border-status-paused/30',
    ok: 'bg-surface-card border-border-strong',
  }[tone];
  const iconCls = { info: 'text-status-completed', error: 'text-error', warning: 'text-status-paused', ok: 'text-status-active' }[tone];
  return (
    <div className={cn('flex flex-wrap items-start gap-3 border rounded-xl px-4 py-3', styles)} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={icon} className={cn('text-[1.375rem] mt-0.5', iconCls)} />
      <div className="flex-1 min-w-[12rem]">
        <p className="font-semibold text-text-primary text-body-md">{title}</p>
        {children && <div className="text-body-sm text-text-secondary mt-0.5">{children}</div>}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Meta Ads connection + sync status: honest "not connected" message, a red banner when the Meta token expired,
 * the last sync time and a "Sync now" button for admins (`ads:manage`).
 */
export function AdsStatusBanner({ status }: { status?: AdsStatus }) {
  const t = useT();
  const toast = useToast();
  const { can } = useAuth();
  const query = useAdsStatus();
  const s = status ?? query.data;
  const running = !!s?.currentJob && ['queued', 'running'].includes(s.currentJob.status);
  const canSync = (s?.canSync ?? false) && can('ads:manage');

  // While a sync runs, check again every few seconds; refresh the ads data when it finishes.
  const wasRunning = useRef(running);
  useEffect(() => {
    if (wasRunning.current && !running) invalidateQueries('ads:');
    wasRunning.current = running;
    if (!running || isDemoMode) return;
    const timer = window.setInterval(() => invalidateQueries('ads:status'), 4000);
    return () => window.clearInterval(timer);
  }, [running]);

  const sync = useMutation(() => adsService.sync('meta'), {
    invalidate: ['ads:'],
    onSuccess: (r) =>
      toast({
        tone: isDemoMode ? 'demo' : 'success',
        title: r.deduplicated ? t('A sync is already running') : t('Sync started'),
        description: isDemoMode ? t('Sample data: nothing was fetched from Meta.') : t('New numbers show up here when it finishes.'),
      }),
  });

  if (!s) return query.status === 'loading' ? <Skeleton className="h-16" /> : null;

  const syncButton = canSync ? (
    <Button icon="sync" onClick={() => void sync.mutate()} disabled={sync.isPending || running}>
      {running ? t('Syncing…') : t('Sync now')}
    </Button>
  ) : null;

  if (!s.configured) {
    return (
      <Shell tone="info" icon="link_off" title={t('Meta Ads is not connected yet')}>
        {s.adCount > 0
          ? t('Showing the ads saved earlier. To get fresh numbers, an admin adds META_ADS_ACCESS_TOKEN to backend/.env and restarts the server.')
          : t('Connect Meta Ads: an admin adds META_ADS_ACCESS_TOKEN to backend/.env and restarts the server. Then press "Sync now".')}
      </Shell>
    );
  }

  if (s.tokenExpired || s.lastErrorCode === 'TOKEN_EXPIRED') {
    return (
      <Shell tone="error" icon="key_off" title={t('The Meta token has expired')} action={syncButton}>
        {t('Numbers are from the last good sync ({time}). An admin needs to put a new META_ADS_ACCESS_TOKEN in backend/.env.', {
          time: formatDateTime(s.lastSyncedAt),
        })}
      </Shell>
    );
  }

  if (s.lastSyncStatus === 'failed' && s.lastErrorCode) {
    return (
      <Shell tone="warning" icon="sync_problem" title={t('The last sync did not work')} action={syncButton}>
        {s.lastErrorMessage ?? s.lastErrorCode}
        {s.lastSyncedAt && <> · {t('Last good sync: {time}', { time: formatDateTime(s.lastSyncedAt) })}</>}
      </Shell>
    );
  }

  return (
    <Shell
      tone="ok"
      icon={running ? 'sync' : 'cloud_done'}
      title={running ? t('Syncing with Meta…') : s.lastSyncedAt ? t('Last synced {time}', { time: formatDateTime(s.lastSyncedAt) }) : t('Not synced yet')}
      action={syncButton}
    >
      {t('{ads} ads · {leads} leads saved', { ads: s.adCount.toLocaleString('en-IN'), leads: s.leadCount.toLocaleString('en-IN') })}
    </Shell>
  );
}
