import { modeText } from '@/lib/config';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { DemoBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { ActivityDetailModal } from '@/features/activity/ActivityDetailModal';
import { ActivityFilters } from '@/features/activity/ActivityFilters';
import { ActivityKpiSkeleton, ActivityKpiStrip, type KpiQuickFilter } from '@/features/activity/ActivityKpiStrip';
import { ActivityTable } from '@/features/activity/ActivityTable';
import { dateScopes, defaultFilters, downloadActivityCsv, type ActivityFilterState } from '@/features/activity/activityUi';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { accountService } from '@/services/accounts';
import { activityService } from '@/services/activity';
import type { ActivityActor, ActivityEntry } from '@/types/activity';

function applyFilters(entries: ActivityEntry[], f: ActivityFilterState, actorOf: (id: string) => ActivityActor | undefined) {
  const scope = dateScopes[f.date];
  const q = f.search.trim().toLowerCase();
  return entries.filter((e) => {
    const day = e.timestamp.slice(0, 10);
    if (scope.from && day < scope.from) return false;
    if (scope.to && day > scope.to) return false;
    if (f.category && e.category !== f.category) return false;
    if (f.account && e.accountId !== f.account) return false;
    if (f.outcome === 'issues') {
      if (!['warning', 'failed', 'resolved'].includes(e.outcome)) return false;
    } else if (f.outcome && e.outcome !== f.outcome) return false;
    const actor = actorOf(e.actorId);
    if (f.actor === 'kind:member' && actor?.kind !== 'member') return false;
    if (f.actor === 'kind:automated' && actor?.kind === 'member') return false;
    if (f.actor && !f.actor.startsWith('kind:') && e.actorId !== f.actor) return false;
    if (q) {
      const hay = [e.id, e.title, e.summary, e.kind, e.target.label, actor?.name ?? '', actor?.shortLabel ?? ''].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function TableSkeleton() {
  const t = useT();
  return (
    <div className="bg-surface-card border border-border-strong rounded-xl p-4 space-y-3" role="status" aria-label={t('Loading activity')}>
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  );
}

/** Activity: four numbers, a simple filter bar and the event list. */
export default function ActivityLogPage() {
  const t = useT();
  useDocumentTitle(t('Activity'));
  const toast = useToast();
  const entriesQ = useQuery('activity:list', activityService.list);
  const actorsQ = useQuery('activity:actors', activityService.actors);
  const summaryQ = useQuery('activity:summary', activityService.summary);
  const accountsQ = useQuery('accounts:list', accountService.list);

  const [filters, setFilters] = useState<ActivityFilterState>(defaultFilters);
  const [live, setLive] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const actorMap = useMemo(() => new Map((actorsQ.data ?? []).map((a) => [a.id, a])), [actorsQ.data]);
  const actorOf = (id: string) => actorMap.get(id);
  const filtered = useMemo(() => applyFilters(entriesQ.data ?? [], filters, (id) => actorMap.get(id)), [entriesQ.data, filters, actorMap]);
  const openEntry = entriesQ.data?.find((e) => e.id === openId) ?? null;

  const patch = (p: Partial<ActivityFilterState>) => setFilters((f) => ({ ...f, ...p }));
  const quick: KpiQuickFilter =
    filters.actor === 'kind:automated' ? 'automated' : filters.actor === 'kind:member' ? 'operator' : filters.outcome === 'issues' ? 'issues' : null;
  const onQuick = (q: KpiQuickFilter) => {
    if (q === 'automated') patch({ actor: 'kind:automated', outcome: '' });
    else if (q === 'operator') patch({ actor: 'kind:member', outcome: '' });
    else if (q === 'issues') patch({ outcome: 'issues', actor: '' });
    else patch({ actor: '', outcome: '' });
  };

  const exportCsv = () => {
    downloadActivityCsv(filtered, actorOf);
    toast({ title: t('Exported {count} events', { count: filtered.length }), description: t(modeText(msg('CSV made in your browser from sample data, with your filters.'), msg('CSV made in your browser, with your filters.'))) });
  };

  const toggleLive = (next: boolean) => {
    setLive(next);
    toast({
      tone: 'demo',
      title: next ? t('Live updates on') : t('Live updates paused'),
      description: t(
        modeText(
          msg('Sample mode: new entries appear only when you change settings or team members here.'),
          msg('New entries appear when settings or team members change. There is no live stream yet.'),
        ),
      ),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Activity')}
        titleAddon={<DemoBadge />}
        description={t('Everything that happened in your workspace.')}
        actions={
          <>
            <button
              type="button"
              role="switch"
              aria-checked={live}
              onClick={() => toggleLive(!live)}
              className="h-9 flex items-center gap-2 px-3 rounded-lg border border-border-strong bg-surface-card text-label-md font-semibold text-text-primary hover:bg-surface-canvas"
            >
              <span className="relative flex h-2.5 w-2.5">
                {live && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-active opacity-75" />}
                <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', live ? 'bg-status-active' : 'bg-text-tertiary')} />
              </span>
              {t('Live')}
            </button>
            <Button icon="download" className="h-9" onClick={exportCsv} disabled={!entriesQ.data || filtered.length === 0}>
              {t('Export CSV')}
            </Button>
          </>
        }
      />

      <QueryState query={summaryQ} loading={<ActivityKpiSkeleton />} empty={<></>} error={() => null}>
        {(summary) => <ActivityKpiStrip summary={summary} active={quick} onQuickFilter={onQuick} />}
      </QueryState>

      <ActivityFilters filters={filters} onChange={patch} actors={actorsQ.data ?? []} accounts={accountsQ.data ?? []} matchCount={filtered.length} />

      <QueryState
        query={entriesQ}
        loading={<TableSkeleton />}
        empty={<EmptyState icon="history" title={t('No activity yet')} description={t('Syncs, team actions and alerts will show up here.')} />}
      >
        {() =>
          filtered.length === 0 ? (
            <EmptyState
              icon="filter_alt_off"
              title={t('Nothing matches these filters')}
              description={t('Try other dates or clear the filters.')}
              action={
                <Button size="sm" onClick={() => setFilters(defaultFilters)}>
                  {t('Clear filters')}
                </Button>
              }
            />
          ) : (
            <ActivityTable entries={filtered} actorLookup={actorOf} onOpen={(e) => setOpenId(e.id)} resetKey={JSON.stringify(filters)} />
          )
        }
      </QueryState>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-text-tertiary">
        <Icon name="verified_user" className="text-[1rem]" />
        {t(modeText(msg('Sample records, kept only in this browser session.'), msg('Saved in SocialBoard. Retention rules are not set up yet.')))}
        <Link to="/settings?tab=data-sync" className="text-primary hover:underline font-semibold">
          {t('Data settings')}
        </Link>
      </p>

      <ActivityDetailModal entry={openEntry} actor={openEntry ? actorOf(openEntry.actorId) : undefined} onClose={() => setOpenId(null)} />
    </div>
  );
}
