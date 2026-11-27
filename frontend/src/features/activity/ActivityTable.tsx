import { Fragment, useEffect, useMemo } from 'react';
import { Th, Tr } from '@/components/tables/DataTable';
import { useTable } from '@/hooks/useTable';
import { useT } from '@/i18n/I18nContext';
import { cn, formatDate } from '@/lib/format';
import type { ActivityActor, ActivityEntry } from '@/types/activity';
import { ActorCell, categoryLabels, formatIst, OutcomePill, rowTint, TargetChip, weekdayLabel } from './activityUi';

type SortKey = 'timestamp' | 'category' | 'title' | 'entity' | 'actor' | 'outcome';

const outcomeRank = { failed: 0, warning: 1, in_progress: 2, resolved: 3, success: 4 } as const;

function pageWindow(page: number, count: number): Array<number | 'gap'> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const set = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count));
  if (page <= 3) [2, 3].forEach((p) => set.add(p));
  if (page >= count - 2) [count - 1, count - 2].forEach((p) => set.add(p));
  const sorted = [...set].sort((a, b) => a - b);
  const out: Array<number | 'gap'> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

const pageBtn = 'px-2.5 py-1 text-label-sm font-label-sm rounded-lg border border-border-strong bg-surface-card text-text-primary hover:bg-surface-canvas transition-colors disabled:text-text-tertiary disabled:cursor-not-allowed disabled:hover:bg-surface-card';

export function ActivityTable({
  entries,
  actorLookup,
  onOpen,
  resetKey,
}: {
  entries: ActivityEntry[];
  actorLookup: (id: string) => ActivityActor | undefined;
  onOpen: (entry: ActivityEntry) => void;
  resetKey: string;
}) {
  const t = useT();
  const table = useTable<ActivityEntry, SortKey>(entries, {
    accessors: {
      timestamp: (e) => e.timestamp,
      category: (e) => categoryLabels[e.category],
      title: (e) => e.title,
      entity: (e) => e.target.label.toLowerCase(),
      actor: (e) => actorLookup(e.actorId)?.name ?? e.actorId,
      outcome: (e) => outcomeRank[e.outcome],
    },
    initialSort: { key: 'timestamp', direction: 'desc' },
    pageSize: 8,
  });
  const { setPage } = table;

  useEffect(() => setPage(1), [resetKey, setPage]);

  const perDay = useMemo(() => {
    const m = new Map<string, number>();
    entries.forEach((e) => m.set(e.timestamp.slice(0, 10), (m.get(e.timestamp.slice(0, 10)) ?? 0) + 1));
    return m;
  }, [entries]);

  const grouped = table.sort?.key === 'timestamp';

  return (
    <div className="bg-surface-card border border-border-strong rounded-xl overflow-hidden shadow-card">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[860px]">
          <thead>
            <tr>
              <Th sortKey="timestamp" sort={table.sort} onSort={table.toggleSort} className="w-40">
                {t('When')}
              </Th>
              <Th sortKey="title" sort={table.sort} onSort={table.toggleSort} className="min-w-[280px]">
                {t('What happened')}
              </Th>
              <Th sortKey="entity" sort={table.sort} onSort={table.toggleSort} className="w-48">
                {t('Related to')}
              </Th>
              <Th sortKey="actor" sort={table.sort} onSort={table.toggleSort} className="w-44">
                {t('Who')}
              </Th>
              <Th sortKey="outcome" sort={table.sort} onSort={table.toggleSort} align="center" className="w-32">
                {t('Result')}
              </Th>
            </tr>
          </thead>
          <tbody className="text-body-sm font-body-sm text-text-primary">
            {table.rows.map((e, i) => {
              const ts = formatIst(e.timestamp);
              const day = e.timestamp.slice(0, 10);
              const showGroup = grouped && (i === 0 || table.rows[i - 1].timestamp.slice(0, 10) !== day);
              return (
                <Fragment key={e.id}>
                  {showGroup && (
                    <tr className="bg-surface-canvas/70 border-b border-border-strong">
                      <td colSpan={5} className="px-4 py-1.5 text-body-sm font-semibold text-text-tertiary">
                        {t(weekdayLabel(day))} · {formatDate(day)} · <span className="text-text-secondary font-normal">{t('{count} events', { count: perDay.get(day) ?? 0 })}</span>
                      </td>
                    </tr>
                  )}
                  <Tr onClick={() => onOpen(e)} label={t('Open details: {name}', { name: e.title })} className={cn('group', rowTint[e.outcome])}>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-text-primary font-label-md text-label-md">{ts.date}</div>
                      <div className="text-[0.75rem] text-text-tertiary tnum">{ts.time}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-text-primary flex items-center gap-1.5 flex-wrap">
                        <span>{e.title}</span>
                        {e.titleTag && (
                          <span
                            className={cn(
                              'text-[0.6875rem] font-semibold px-1.5 rounded-full',
                              e.titleTag.tone === 'ai' ? 'text-ai-accent bg-ai-subtle' : 'bg-status-paused-subtle text-status-paused',
                            )}
                          >
                            {e.titleTag.label}
                          </span>
                        )}
                      </div>
                      <div className="text-text-secondary text-[0.75rem] line-clamp-1">
                        {t(categoryLabels[e.category])} · {e.summary}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <TargetChip target={e.target} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <ActorCell actor={actorLookup(e.actorId)} />
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <OutcomePill entry={e} />
                    </td>
                  </Tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <div className="text-body-sm font-body-sm text-text-secondary font-medium">
            {t('Showing {start}–{end} of {total}', { start: table.rangeStart, end: table.rangeEnd, total: table.total })}
          </div>
          <label className="flex items-center gap-1.5 text-body-sm text-text-secondary">
            <span>{t('Rows')}</span>
            <select
              value={table.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="h-7 pl-2 pr-7 py-0 text-[0.75rem] rounded border border-slate-700 bg-slate-950 focus:ring-0 focus:border-border-focused"
            >
              {[8, 15, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <nav className="flex items-center gap-1 flex-wrap justify-center" aria-label={t('Pages')}>
          <button type="button" className={pageBtn} disabled={table.page <= 1} onClick={() => table.setPage(table.page - 1)}>
            {t('Previous')}
          </button>
          {pageWindow(table.page, table.pageCount).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-text-tertiary">
                ...
              </span>
            ) : (
              <button
                key={p}
                type="button"
                aria-current={p === table.page ? 'page' : undefined}
                onClick={() => table.setPage(p)}
                className={cn(
                  'px-2.5 py-1 text-label-sm font-label-sm rounded-lg transition-colors tnum',
                  p === table.page ? 'bg-primary-container text-on-primary-container font-bold shadow-xs' : 'border border-border-strong bg-surface-card text-text-primary hover:bg-surface-canvas',
                )}
              >
                {p}
              </button>
            ),
          )}
          <button type="button" className={cn(pageBtn, 'font-medium')} disabled={table.page >= table.pageCount} onClick={() => table.setPage(table.page + 1)}>
            {t('Next')}
          </button>
        </nav>
      </div>
    </div>
  );
}
