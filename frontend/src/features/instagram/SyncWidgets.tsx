import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartTooltipStyle } from '@/components/charts/chartTheme';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { msg, useT } from '@/i18n/I18nContext';
import { formatCompact, formatNumber } from '@/lib/format';
import type { HistorySeries, SyncJob } from '@/types/instagram';
import { formatDateTime, metricLabels } from './liveMeta';
import { stageLabel, type useSyncState } from './useSyncState';

type SyncState = ReturnType<typeof useSyncState>;

const jobTone: Record<SyncJob['status'], 'scheduled' | 'active' | 'amber' | 'error' | 'neutral'> = {
  queued: 'scheduled',
  running: 'scheduled',
  retrying: 'amber',
  succeeded: 'active',
  partially_succeeded: 'amber',
  failed: 'error',
  cancelled: 'neutral',
};
const jobLabel: Record<SyncJob['status'], string> = {
  queued: msg('Queued'),
  running: msg('Syncing'),
  retrying: msg('Retrying'),
  succeeded: msg('Done'),
  partially_succeeded: msg('Partial'),
  failed: msg('Failed'),
  cancelled: msg('Cancelled'),
};

export function JobBadge({ job }: { job: SyncJob }) {
  const t = useT();
  return <Badge tone={jobTone[job.status]} dot>{t(jobLabel[job.status])}{job.status === 'running' ? ` ${job.progress}%` : ''}</Badge>;
}

export function JobProgress({ job }: { job: SyncJob }) {
  const t = useT();
  return (
    <div className="w-full" role="status" aria-live="polite" aria-label={t('Sync: {status}', { status: t(jobLabel[job.status]) })}>
      <div className="flex items-center justify-between text-[0.75rem] text-text-secondary mb-1">
        <span>{stageLabel(job, t)}</span>
        <span className="tnum">{job.progress}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-container overflow-hidden">
        <div className={`h-full rounded-full transition-all ${job.status === 'retrying' ? 'bg-amber-500' : 'bg-primary-container'}`} style={{ width: `${Math.max(job.progress, 4)}%` }} />
      </div>
      {job.status === 'retrying' && job.errorMessage && <p className="text-[0.6875rem] text-text-tertiary mt-1">{job.errorMessage}</p>}
    </div>
  );
}

/** One-line sync summary for account rows and the dashboard card. */
export function SyncSummary({ sync }: { sync: SyncState }) {
  const t = useT();
  const st = sync.status.data;
  if (sync.active) return <JobProgress job={sync.active} />;
  return (
    <span className="text-[0.75rem] text-text-secondary flex flex-wrap gap-x-3 gap-y-0.5">
      <span>{t('Last sync: {time}', { time: st?.lastSuccessAt ? formatDateTime(st.lastSuccessAt) : t('never') })}</span>
      {sync.lastJob && sync.lastJob.status !== 'succeeded' && (
        <span>
          {t('Last run:')} <JobBadge job={sync.lastJob} />
        </span>
      )}
      <span>
        {st?.nextScheduledAt
          ? t('Next sync: {time}', { time: formatDateTime(st.nextScheduledAt) })
          : st?.backgroundAvailable === false
            ? t('Background sync is not set up')
            : t('Not scheduled')}
      </span>
    </span>
  );
}

export function SyncNowButton({ sync, disabled }: { sync: SyncState; disabled?: boolean }) {
  const t = useT();
  const busy = !!sync.active;
  return (
    <Button icon={busy ? 'progress_activity' : 'sync'} onClick={() => void sync.start()} loading={sync.starting} disabled={disabled || busy}
      className={busy ? '[&_.material-symbols-outlined]:animate-spin' : undefined}>
      {busy ? t('Syncing…') : t('Sync now')}
    </Button>
  );
}

// ------------------------------------------------------------------------------------- charts
const seriesTitle: Record<string, string> = {
  'followers_count:daily_snapshot': msg('Followers (observed at each sync)'),
  'media_count:daily_snapshot': msg('Posts'),
  'follows_count:daily_snapshot': msg('Following'),
  'reach:daily': msg('People reached per day'),
  'reach:rolling_28d': msg('People reached, last 28 days'),
  'views:rolling_28d': msg('Views, last 28 days'),
  'total_interactions:rolling_28d': msg('Interactions, last 28 days'),
  'accounts_engaged:rolling_28d': msg('Accounts engaged, last 28 days'),
};

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: '2-digit', timeZone: 'UTC' });
}

/** Line chart that leaves days without an observation empty (connectNulls=false): gaps stay visible. */
export function HistoryChart({ series, height = 180 }: { series: HistorySeries; height?: number }) {
  const t = useT();
  const data = series.points.map((p) => ({ date: shortDate(p.date), value: p.value }));
  const key = seriesTitle[`${series.metric}:${series.kind}`] ?? metricLabels[series.metric];
  const title = key ? t(key) : series.metric;
  return (
    <figure className="border border-border-strong rounded-xl p-3">
      <figcaption className="flex items-center justify-between mb-1">
        <span className="text-label-sm font-semibold text-text-primary">{title}</span>
        <span className="text-[0.6875rem] text-text-tertiary">{t('{observed} of {total} days observed', { observed: series.observedDays, total: series.points.length })}</span>
      </figcaption>
      <div style={{ height }} aria-label={t('{title} chart', { title })} role="img">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-track)" strokeDasharray="4 4" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'var(--app-muted)', fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--app-muted)', fontSize: 11 }} tickFormatter={(v: number) => formatCompact(v)} width={44} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(value) => [typeof value === 'number' ? formatNumber(value) : t('no data'), title]}
            />
            <Line type="monotone" dataKey="value" stroke="var(--eko-gold)" strokeWidth={2} connectNulls={false} dot={{ r: 2.5, fill: 'var(--app-surface)' }} activeDot={{ r: 4 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function HistoryEmpty() {
  const t = useT();
  return (
    <EmptyState
      icon="timeline"
      title={t('No history yet')}
      description={t('History builds up with each sync. Charts appear after the first one; days without a sync stay empty.')}
    />
  );
}
