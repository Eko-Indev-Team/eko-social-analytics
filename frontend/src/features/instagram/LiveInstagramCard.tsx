import { Link } from 'react-router-dom';
import { Avatar } from '@/components/ui/Misc';
import { Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { formatNumber } from '@/lib/format';
import { instagramService } from '@/services/instagram';
import type { InstagramConnection } from '@/types/instagram';
import { LiveSourceBadge, LiveStateBadge } from './LiveConnectionsSection';
import { connectionUiState, metricLabels } from './liveMeta';
import { SyncSummary } from './SyncWidgets';
import { useSyncState } from './useSyncState';

function LiveTotals({ c }: { c: InstagramConnection }) {
  const t = useT();
  const insights = useQuery(`instagram:insights:${c.id}`, () => instagramService.insights(c.id), { enabled: c.insightsAvailable, isEmpty: () => false });
  if (!c.insightsAvailable) return <span className="text-[0.75rem] text-text-tertiary">{t('Insights permission not given')}</span>;
  if (insights.status === 'loading') return <Skeleton className="h-6 w-40" />;
  if (insights.error) return <span className="text-[0.75rem] text-error">{t('Could not load insights: {error}', { error: insights.error.message })}</span>;
  const totals = insights.data?.totals ?? [];
  if (totals.length === 0) return <span className="text-[0.75rem] text-text-tertiary">{t('No insights synced yet')}</span>;
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem]">
      {totals
        .filter((m) => ['reach', 'views', 'total_interactions'].includes(m.metric))
        .map((m) => (
          <span key={m.metric}>
            <span className="text-text-secondary">{t('{metric} (28 days):', { metric: metricLabels[m.metric] ? t(metricLabels[m.metric]) : m.metric })} </span>
            <span className="font-semibold text-text-primary tnum">{m.value === null ? t('unavailable') : formatNumber(m.value)}</span>
          </span>
        ))}
    </span>
  );
}

function RowSync({ id }: { id: string }) {
  const sync = useSyncState(id, { notify: false });
  return <SyncSummary sync={sync} />;
}

/**
 * Dashboard (api mode): live connected accounts, shown separately from — and never added to — the sample
 * numbers on the rest of the dashboard.
 */
export function LiveInstagramCard() {
  const t = useT();
  const status = useQuery('instagram:status', instagramService.status);
  const accounts = useQuery('instagram:accounts', instagramService.accounts, { enabled: status.data?.enabled === true, isEmpty: () => false });
  if (status.status === 'loading' || !status.data) return null;
  const rows = accounts.data ?? [];

  return (
    <section className="bg-surface-card border border-border-strong rounded-xl shadow-card p-5" aria-label={t('Live Instagram accounts')}>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('Live Instagram')}</h2>
          <LiveSourceBadge />
        </div>
        <Link to="/accounts" className="text-label-sm text-primary font-semibold hover:underline">
          {t('Manage')}
        </Link>
      </div>
      <p className="text-body-sm text-text-secondary mb-3">{t('Live numbers from Instagram. The rest of this page uses sample data.')}</p>
      {!status.data.enabled ? (
        <p className="text-body-sm text-text-tertiary">{t('Live connection is not set up on this server.')}</p>
      ) : accounts.error ? (
        <p className="text-body-sm text-error">{t('Could not load live accounts: {error}', { error: accounts.error.message })}</p>
      ) : accounts.status === 'loading' ? (
        <Skeleton className="h-10" />
      ) : rows.length === 0 ? (
        <p className="text-body-sm text-text-tertiary">{t('No Instagram account connected yet.')}</p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {rows.map((c) => (
            <li key={c.id} className="py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <span className="flex items-center gap-2 min-w-0">
                <Avatar name={c.username} src={c.profilePictureUrl ?? undefined} size="sm" />
                <Link to={`/accounts/live/${c.id}`} className="font-semibold text-text-primary hover:underline">
                  @{c.username}
                </Link>
                <LiveStateBadge state={connectionUiState(c)} />
                <span className="text-[0.75rem] text-text-secondary">
                  {c.followersCount === null ? t('followers not returned') : t('{count} followers', { count: formatNumber(c.followersCount) })}
                </span>
              </span>
              <span className="flex flex-col gap-1 md:items-end">
                <LiveTotals c={c} />
                <span className="md:max-w-md w-full">
                  <RowSync id={c.id} />
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
