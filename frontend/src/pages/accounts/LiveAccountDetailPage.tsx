import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { InfoTip } from '@/components/ui/InfoTip';
import { KpiCard } from '@/components/ui/KpiCard';
import { Avatar, ImageWithFallback, Notice } from '@/components/ui/Misc';
import { EmptyState, ErrorState, PageSkeleton, QueryState, Skeleton } from '@/components/ui/States';
import { LiveSourceBadge, LiveStateBadge } from '@/features/instagram/LiveConnectionsSection';
import { connectionUiState, daysUntil, formatDateTime, metricLabels } from '@/features/instagram/liveMeta';
import { HistoryChart, HistoryEmpty, JobBadge, JobProgress, SyncNowButton } from '@/features/instagram/SyncWidgets';
import { useInstagramActions } from '@/features/instagram/useInstagramActions';
import { useSyncState } from '@/features/instagram/useSyncState';
import { Drawer } from '@/components/ui/Overlay';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { ApiNotFoundError } from '@/lib/api/errors';
import { formatNumber } from '@/lib/format';
import { instagramService } from '@/services/instagram';
import type { AccountInsights, InstagramConnection, InstagramMedia } from '@/types/instagram';

const MEDIA_COLUMNS = ['views', 'reach', 'likes', 'comments', 'shares', 'saved'] as const;

function Unavailable({ label }: { label?: string }) {
  const t = useT();
  return (
    <span className="text-text-tertiary" title={t('Instagram did not return this number (it is not a zero).')}>
      {label ?? t('Unavailable')}
    </span>
  );
}

function Card({ title, tip, children, ...rest }: { title: string; tip?: string; children: ReactNode; 'aria-label'?: string }) {
  return (
    <section className="bg-surface-card border border-border-strong rounded-xl shadow-card p-5" {...rest}>
      <h2 className="font-heading text-[1.0625rem] font-semibold text-text-primary mb-3 flex items-center gap-1.5">
        {title}
        {tip && <InfoTip text={tip} />}
      </h2>
      {children}
    </section>
  );
}

const metricName = (t: (s: string) => string, metric: string) => (metricLabels[metric] ? t(metricLabels[metric]) : metric);

function InsightsPanel({ insights, connection }: { insights: AccountInsights; connection: InstagramConnection }) {
  const t = useT();
  if (!connection.insightsAvailable) {
    return (
      <Notice tone="info" title={t('Insights permission not given')}>
        {t('Reconnect and allow insights to see reach, views and interactions.')}
      </Notice>
    );
  }
  if (insights.totals.length === 0) {
    return <EmptyState icon="query_stats" title={t('No insights yet')} description={t('Run a sync to get the last 28 days.')} />;
  }
  const max = Math.max(1, ...insights.reachDaily.map((p) => p.value ?? 0));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {insights.totals.map((m) => (
          <div key={m.metric} className="p-3 rounded-xl bg-surface-canvas">
            <p className="text-[0.75rem] text-text-secondary">{metricName(t, m.metric)}</p>
            <p className="text-headline-sm font-bold text-text-primary tnum">{m.value === null ? <Unavailable /> : formatNumber(m.value)}</p>
          </div>
        ))}
      </div>
      <p className="text-[0.75rem] text-text-tertiary">
        {t('{start} – {end} · fetched {fetched}.', {
          start: formatDateTime(insights.totals[0].rangeStart),
          end: formatDateTime(insights.totals[0].rangeEnd),
          fetched: formatDateTime(insights.totals[0].capturedAt),
        })}{' '}
        {insights.note}
      </p>
      {insights.reachDaily.length > 0 && (
        <div>
          <p className="text-label-sm font-semibold text-text-primary mb-2">{t('People reached per day')}</p>
          <div className="flex items-end gap-1 h-24" role="img" aria-label={t('People reached per day')}>
            {insights.reachDaily.map((p) => (
              <div
                key={p.date}
                className="flex-1 bg-primary-container/70 rounded-t min-w-[4px]"
                style={{ height: `${((p.value ?? 0) / max) * 100}%` }}
                title={`${formatDateTime(p.date)}: ${p.value === null ? t('unavailable') : formatNumber(p.value)}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MediaTable({ media, connection, onHistory }: { media: InstagramMedia[]; connection: InstagramConnection; onHistory: (m: InstagramMedia) => void }) {
  const t = useT();
  if (media.length === 0) return <EmptyState icon="photo_library" title={t('No posts synced yet')} description={t('Run a sync to get recent posts and reels.')} />;
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left border-collapse min-w-[860px] text-body-sm">
        <thead>
          <tr className="border-b border-border-strong text-text-secondary text-label-sm font-semibold">
            <th className="py-2.5 px-3">{t('Post')}</th>
            <th className="py-2.5 px-3">{t('Posted')}</th>
            {MEDIA_COLUMNS.map((c) => (
              <th key={c} className="py-2.5 px-3 text-right">
                {metricName(t, c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {media.map((m) => {
            const metrics = Object.fromEntries(m.insights.map((i) => [i.metric, i]));
            return (
              <tr key={m.id} className={m.removed ? 'opacity-60' : undefined}>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <ImageWithFallback src={m.thumbnailUrl ?? (m.mediaType === 'IMAGE' ? m.mediaUrl ?? undefined : undefined)} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Badge tone="neutral">{m.mediaProductType ?? m.mediaType ?? 'MEDIA'}</Badge>
                        {m.removed && <Badge tone="error">{t('Deleted on Instagram')}</Badge>}
                      </div>
                      <p className="text-[0.75rem] text-text-secondary truncate max-w-[260px] mt-0.5">{m.caption ?? t('No caption')}</p>
                      {m.permalink && (
                        <a href={m.permalink} target="_blank" rel="noopener noreferrer" className="text-[0.6875rem] text-primary hover:underline">
                          {t('Open on Instagram')}
                        </a>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  {formatDateTime(m.postedAt)}
                  <button type="button" className="block text-[0.6875rem] text-primary hover:underline mt-0.5" onClick={() => onHistory(m)}>
                    {t('History')}
                  </button>
                </td>
                {MEDIA_COLUMNS.map((c) => {
                  const fallback = c === 'likes' ? m.likeCount : c === 'comments' ? m.commentsCount : null;
                  const value = metrics[c]?.value ?? (connection.insightsAvailable ? null : fallback);
                  return (
                    <td key={c} className="py-2.5 px-3 text-right tnum">
                      {value === null || value === undefined ? <Unavailable label="—" /> : formatNumber(value)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[0.6875rem] text-text-tertiary mt-2">{t('"—" means Instagram did not return that number. It is not a zero.')}</p>
    </div>
  );
}

function MediaHistoryDrawer({ accountId, media, onClose }: { accountId: string; media: InstagramMedia | null; onClose: () => void }) {
  const t = useT();
  const history = useQuery(`instagram:media-history:${media?.id ?? 'none'}`, () => instagramService.mediaHistory(accountId, media!.id), {
    enabled: !!media,
    isEmpty: () => false,
  });
  return (
    <Drawer open={!!media} onClose={onClose} title={t('Post history')} subtitle={media?.permalink ?? media?.igMediaId}>
      <QueryState query={history} loading={<Skeleton className="h-40" />}>
        {(h) =>
          h.series.length === 0 ? (
            <p className="text-body-sm text-text-secondary">{t('No history for this post yet.')}</p>
          ) : (
            <div className="space-y-4 text-body-sm">
              {h.unsupportedMetrics.length > 0 && (
                <p className="text-[0.75rem] text-text-tertiary">{t('Not available for this post: {metrics}', { metrics: h.unsupportedMetrics.join(', ') })}</p>
              )}
              {h.series.map((sr) => (
                <div key={sr.metric}>
                  <p className="font-semibold text-text-primary">{metricName(t, sr.metric)}</p>
                  <ul className="mt-1 space-y-0.5">
                    {sr.points.map((pt) => (
                      <li key={pt.observedAt} className="flex justify-between text-[0.75rem]">
                        <span className="text-text-secondary">{formatDateTime(pt.observedAt)}</span>
                        <span className="tnum font-medium">{pt.value === null ? <Unavailable /> : formatNumber(pt.value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-[0.6875rem] text-text-tertiary">{t('Each row is the total as seen at one sync.')}</p>
            </div>
          )
        }
      </QueryState>
    </Drawer>
  );
}

/** Live account detail (api mode): data fetched from the Instagram API for one connected account. */
export default function LiveAccountDetailPage() {
  const t = useT();
  const { connectionId = '' } = useParams();
  const navigate = useNavigate();
  const account = useQuery(`instagram:account:${connectionId}`, () => instagramService.account(connectionId));
  const enabled = account.status === 'success';
  const insights = useQuery(`instagram:insights:${connectionId}`, () => instagramService.insights(connectionId), { enabled, isEmpty: () => false });
  const media = useQuery(`instagram:media:${connectionId}`, () => instagramService.media(connectionId), { enabled, isEmpty: () => false });
  const runs = useQuery(`instagram:runs:${connectionId}`, () => instagramService.syncHistory(connectionId), { enabled, isEmpty: () => false });
  const history = useQuery(`instagram:history:${connectionId}`, () => instagramService.history(connectionId, 90), { enabled, isEmpty: () => false });
  const sync = useSyncState(connectionId);
  const [historyMedia, setHistoryMedia] = useState<InstagramMedia | null>(null);
  const comments = useQuery(`instagram:comments:${connectionId}`, () => instagramService.comments(connectionId), {
    enabled: enabled && !!account.data?.commentsAvailable,
    isEmpty: () => false,
  });
  const actions = useInstagramActions({ onDisconnected: () => navigate('/accounts') });
  useDocumentTitle(account.data ? `@${account.data.username}` : t('Instagram account'));

  return (
    <QueryState
      query={account}
      loading={<PageSkeleton />}
      error={(err, retry) =>
        err instanceof ApiNotFoundError ? (
          <EmptyState
            icon="person_off"
            title={t('Account not found')}
            description={t('It may have been disconnected, or it belongs to another workspace.')}
            action={
              <LinkButton to="/accounts" icon="arrow_back">
                {t('Back to accounts')}
              </LinkButton>
            }
          />
        ) : (
          <ErrorState error={err} onRetry={retry} />
        )
      }
    >
      {(c) => {
        const state = connectionUiState(c);
        const expiresIn = daysUntil(c.tokenExpiresAt);
        const st = sync.status.data;
        const typeLabel = c.accountType === 'MEDIA_CREATOR' ? t('Creator account') : c.accountType === 'BUSINESS' ? t('Business account') : t('Professional account');
        return (
          <div className="flex flex-col gap-6">
            <PageHeader
              breadcrumbs={[{ label: t('Instagram accounts'), to: '/accounts' }, { label: `@${c.username}` }]}
              title={`@${c.username}`}
              titleAddon={
                <>
                  <Avatar name={c.username} src={c.profilePictureUrl ?? undefined} size="sm" className="order-first" />
                  <LiveSourceBadge />
                  <LiveStateBadge state={state} />
                </>
              }
              description={[c.name ?? t('Name not returned'), typeLabel, expiresIn !== null ? t('Login expires in {days} days', { days: Math.max(expiresIn, 0) }) : null]
                .filter(Boolean)
                .join(' · ')}
              actions={
                <>
                  {state === 'needs_reauth' ? (
                    <Button variant="primary" icon="key" onClick={() => void actions.connect()} loading={actions.connecting}>
                      {t('Reconnect')}
                    </Button>
                  ) : (
                    <SyncNowButton sync={sync} />
                  )}
                  <Button icon="link_off" onClick={() => actions.requestDisconnect(c)}>
                    {t('Disconnect')}
                  </Button>
                </>
              }
            />

            {c.lastErrorMessage && (
              <Notice tone="warning" title={state === 'needs_reauth' ? t('Reauthorization needed') : t('Last sync failed')}>
                {c.lastErrorMessage}
              </Notice>
            )}

            <section className="bg-surface-card border border-border-strong rounded-xl shadow-card p-5" aria-label={t('Sync status')}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="text-body-sm space-y-0.5">
                  <p>
                    <span className="text-text-secondary">{t('Last sync:')}</span>{' '}
                    <span className="font-semibold text-text-primary">{st?.lastSuccessAt ? formatDateTime(st.lastSuccessAt) : t('never')}</span>
                  </p>
                  <p className="text-[0.75rem] text-text-secondary">
                    {st?.nextScheduledAt
                      ? t('Next scheduled sync: {time} (every {hours} h)', {
                          time: formatDateTime(st.nextScheduledAt),
                          hours: Math.round(((st.intervalMinutes ?? 0) / 60) * 10) / 10,
                        })
                      : st?.backgroundAvailable === false
                        ? t('Background sync is not set up on this server.')
                        : t('No sync scheduled (the account needs attention or a sync is running).')}
                  </p>
                  {sync.lastJob && !sync.active && (
                    <p className="text-[0.75rem] flex items-center gap-1.5">
                      <span className="text-text-secondary">{t('Last run:')}</span> <JobBadge job={sync.lastJob} />{' '}
                      <span className="text-text-tertiary">{sync.lastJob.errorMessage ?? ''}</span>
                    </p>
                  )}
                </div>
                {sync.active && (
                  <div className="md:w-80 flex items-center gap-2">
                    <JobProgress job={sync.active} />
                    {!sync.active.cancelRequested && (
                      <Button size="xs" variant="ghost" onClick={() => void sync.cancel()}>
                        {t('Cancel')}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </section>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <KpiCard label={msg('Followers')} icon="groups" tone="teal" value={c.followersCount === null ? <Unavailable label={t('Not returned')} /> : formatNumber(c.followersCount)} />
              <KpiCard label={msg('Following')} icon="person_add" tone="ai" value={c.followsCount === null ? <Unavailable label={t('Not returned')} /> : formatNumber(c.followsCount)} />
              <KpiCard label={msg('Posts')} icon="photo_library" tone="success" value={c.mediaCount === null ? <Unavailable label={t('Not returned')} /> : formatNumber(c.mediaCount)} />
            </div>

            <Card title={t('History, last 90 days')} tip={t('Built from each sync. Days without a sync stay empty; nothing is guessed.')}>
              <QueryState query={history} loading={<Skeleton className="h-48" />}>
                {(h) =>
                  h.series.filter((x) => x.observedDays > 0).length === 0 ? (
                    <HistoryEmpty />
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {h.series
                        .filter(
                          (x) =>
                            x.observedDays > 0 &&
                            ['followers_count:daily_snapshot', 'reach:daily', 'views:rolling_28d', 'media_count:daily_snapshot'].includes(`${x.metric}:${x.kind}`),
                        )
                        .map((x) => (
                          <HistoryChart key={`${x.metric}:${x.kind}`} series={x} />
                        ))}
                    </div>
                  )
                }
              </QueryState>
            </Card>

            <Card title={t('Account numbers, last 28 days')}>
              <QueryState query={insights} loading={<Skeleton className="h-32" />}>
                {(data) => <InsightsPanel insights={data} connection={c} />}
              </QueryState>
            </Card>

            <Card title={t('Recent posts')}>
              <QueryState query={media} loading={<Skeleton className="h-48" />}>
                {(rows) => <MediaTable media={rows} connection={c} onHistory={setHistoryMedia} />}
              </QueryState>
            </Card>

            <Card title={t('Comments')}>
              {!c.commentsAvailable ? (
                <p className="text-body-sm text-text-secondary">{t('Comments are not fetched because the comments permission was not given.')}</p>
              ) : (
                <QueryState query={comments} loading={<Skeleton className="h-24" />}>
                  {(rows) =>
                    rows.length === 0 ? (
                      <p className="text-body-sm text-text-secondary">{t('No comments synced yet.')}</p>
                    ) : (
                      <ul className="divide-y divide-border-subtle">
                        {rows.slice(0, 20).map((cm) => (
                          <li key={cm.id} className={`py-2 text-body-sm ${cm.parentIgCommentId ? 'pl-6' : ''}`}>
                            <span className="font-semibold text-text-primary">{cm.username ? `@${cm.username}` : t('Unknown user')}</span>{' '}
                            <span className="text-text-secondary">{cm.text ?? ''}</span>
                            <span className="text-[0.6875rem] text-text-tertiary ml-2">{formatDateTime(cm.commentedAt)}</span>
                          </li>
                        ))}
                      </ul>
                    )
                  }
                </QueryState>
              )}
            </Card>

            <Card title={t('Sync history')} tip={t('Syncs run in the background: on a schedule when set up, or when you press Sync now.')}>
              <QueryState query={runs} loading={<Skeleton className="h-24" />}>
                {(rows) =>
                  rows.length === 0 ? (
                    <p className="text-body-sm text-text-secondary">{t('No syncs yet.')}</p>
                  ) : (
                    <ul className="divide-y divide-border-subtle text-body-sm">
                      {rows.map((r) => (
                        <li key={r.id} className="py-2 flex flex-col md:flex-row md:items-center justify-between gap-1">
                          <span className="flex items-center gap-2">
                            <JobBadge job={r} />
                            <span className="text-text-primary">{formatDateTime(r.startedAt ?? r.queuedAt)}</span>
                            <span className="text-text-tertiary">
                              ({r.trigger}
                              {r.retryCount ? `, ${t('retries: {count}', { count: r.retryCount })}` : ''})
                            </span>
                          </span>
                          <span className="text-[0.75rem] text-text-secondary">
                            {r.errorMessage ??
                              t('{media} posts · {mediaMetrics} post numbers · {accountMetrics} account numbers · {comments} comments', {
                                media: r.mediaFetched,
                                mediaMetrics: r.mediaInsightsFetched,
                                accountMetrics: r.accountInsightsFetched,
                                comments: r.commentsFetched,
                              })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )
                }
              </QueryState>
            </Card>
            <MediaHistoryDrawer accountId={c.id} media={historyMedia} onClose={() => setHistoryMedia(null)} />
            {actions.overlays}
          </div>
        );
      }}
    </QueryState>
  );
}
