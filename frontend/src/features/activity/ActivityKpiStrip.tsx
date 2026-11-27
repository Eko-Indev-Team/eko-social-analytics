import type { ReactNode } from 'react';
import { KpiCard } from '@/components/ui/KpiCard';
import { Skeleton } from '@/components/ui/States';
import { msg, useT } from '@/i18n/I18nContext';
import { formatNumber } from '@/lib/format';
import type { ActivitySummary } from '@/types/activity';

export type KpiQuickFilter = 'automated' | 'operator' | 'issues' | null;

/** Clickable tile that toggles a quick filter (keeps aria-pressed). */
function FilterTile({ active, onClick, ariaLabel, children }: { active: boolean; onClick: () => void; ariaLabel: string; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} aria-label={ariaLabel} className="text-left rounded-xl transition-transform hover:-translate-y-0.5">
      {children}
    </button>
  );
}

/** Four numbers; the last three also filter the list. */
export function ActivityKpiStrip({ summary, active, onQuickFilter }: { summary: ActivitySummary; active: KpiQuickFilter; onQuickFilter: (f: KpiQuickFilter) => void }) {
  const t = useT();
  const delta = summary.previousPeriodTotal ? ((summary.total - summary.previousPeriodTotal) / summary.previousPeriodTotal) * 100 : undefined;
  const toggle = (f: Exclude<KpiQuickFilter, null>) => onQuickFilter(active === f ? null : f);
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label={msg('Events')} icon="list_alt" tone="teal" value={formatNumber(summary.total)} delta={delta} deltaLabel={msg('vs last month')} />
      <FilterTile active={active === 'automated'} onClick={() => toggle('automated')} ariaLabel={t('Show automatic actions')}>
        <KpiCard
          label={msg('Automatic')}
          icon="smart_toy"
          tone="ai"
          highlight={active === 'automated'}
          className="h-full"
          value={formatNumber(summary.automated)}
          footnote={t('Syncs, AI and scheduled jobs · {pct}% healthy', { pct: summary.pipelineHealth.toFixed(1) })}
        />
      </FilterTile>
      <FilterTile active={active === 'operator'} onClick={() => toggle('operator')} ariaLabel={t('Show actions by people')}>
        <KpiCard
          label={msg('By people')}
          icon="badge"
          tone="success"
          highlight={active === 'operator'}
          className="h-full"
          value={formatNumber(summary.operator)}
          footnote={t('Team members: {count}', { count: summary.activeOperators })}
        />
      </FilterTile>
      <FilterTile active={active === 'issues'} onClick={() => toggle('issues')} ariaLabel={t('Show problems')}>
        <KpiCard
          label={msg('Problems')}
          icon="warning"
          tone="warning"
          highlight={active === 'issues'}
          className="h-full"
          value={formatNumber(summary.issues)}
          footnote={t('{done} of {total} fixed', { done: summary.issuesAddressed, total: summary.issues })}
        />
      </FilterTile>
    </div>
  );
}

export function ActivityKpiSkeleton() {
  const t = useT();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" role="status" aria-label={t('Loading summary')}>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}
