import { AiGeneratedBadge, QualityPill } from '@/features/ai/AiWidgets';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { Insight, InsightCategory, InsightPriority } from '@/types/insights';
import { categoryMeta, categoryOrder, insightStatusMeta, PriorityPill, RichText } from './insightMeta';

export interface InsightFilterState {
  category: InsightCategory | 'all';
  priority: InsightPriority | 'all';
  search: string;
  showDismissed: boolean;
}

export const defaultInsightFilters: InsightFilterState = { category: 'all', priority: 'all', search: '', showDismissed: false };

export function filterInsights(list: Insight[], f: InsightFilterState): Insight[] {
  const q = f.search.trim().toLowerCase();
  return list.filter(
    (i) =>
      (f.showDismissed || i.status !== 'dismissed') &&
      (f.category === 'all' || i.category === f.category) &&
      (f.priority === 'all' || i.priority === f.priority) &&
      (!q || `${i.title} ${i.observed} ${i.interpretation} ${categoryMeta[i.category].label}`.toLowerCase().includes(q)),
  );
}

/** Filters & category navigation bar. Counts exclude dismissed insights. */
export function InsightFilterBar({ insights, filters, onChange }: { insights: Insight[]; filters: InsightFilterState; onChange: (f: InsightFilterState) => void }) {
  const t = useT();
  const active = insights.filter((i) => i.status !== 'dismissed');
  const dismissed = insights.length - active.length;
  const count = (p: InsightPriority) => active.filter((i) => i.priority === p).length;
  const tabs: Array<{ value: InsightCategory | 'all'; label: string; count: number }> = [
    { value: 'all', label: msg('All'), count: active.length },
    ...categoryOrder.map((c) => ({ value: c, label: categoryMeta[c].tab, count: active.filter((i) => i.category === c).length })),
  ];
  return (
    <section className="space-y-3">
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div role="tablist" aria-label={t('Insight topics')} className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 xl:pb-0 text-label-md font-label-md">
          {tabs.map((tab) => {
            const on = filters.category === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => onChange({ ...filters, category: tab.value })}
                className={cn(
                  'px-3 py-1.5 rounded-full shrink-0 transition-colors',
                  on ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-text-secondary hover:text-text-primary hover:bg-surface-card border border-border-strong font-medium',
                )}
              >
                {t(tab.label)}
                <span className={cn('ml-1 text-[0.75rem]', on ? 'px-1.5 rounded-full bg-white/20' : 'text-text-tertiary')}>{tab.count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
          <label className="sr-only" htmlFor="insight-priority">
            {t('Priority')}
          </label>
          <select
            id="insight-priority"
            value={filters.priority}
            onChange={(e) => onChange({ ...filters, priority: e.target.value as InsightFilterState['priority'] })}
            className="bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-8 py-1.5 text-label-md font-label-md text-text-primary focus:border-border-focused focus:ring-0 cursor-pointer"
          >
            <option value="all">{t('All priorities')}</option>
            <option value="high">{t('High ({count})', { count: count('high') })}</option>
            <option value="medium">{t('Medium ({count})', { count: count('medium') })}</option>
            <option value="low">{t('Low ({count})', { count: count('low') })}</option>
          </select>
          <div className="relative sm:min-w-[260px]">
            <Icon name="search" className="text-text-secondary absolute left-2.5 top-1/2 -translate-y-1/2 text-[1.125rem] pointer-events-none" />
            <label className="sr-only" htmlFor="insight-search">
              {t('Search insights')}
            </label>
            <input
              id="insight-search"
              type="search"
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-label-md font-label-md text-text-primary placeholder:text-text-tertiary focus:border-border-focused focus:ring-0"
                            placeholder={t('Search insights')}
            />
          </div>
        </div>
      </div>
      {dismissed > 0 && (
        <label className="inline-flex items-center gap-2 text-label-sm font-label-sm text-text-secondary cursor-pointer">
          <input type="checkbox" checked={filters.showDismissed} onChange={(e) => onChange({ ...filters, showDismissed: e.target.checked })} className="h-4 w-4 rounded border-slate-700 text-text-primary focus:ring-0" />
          {t('Show dismissed ({count})', { count: dismissed })}
        </label>
      )}
    </section>
  );
}

/** Evidence-based insight card: Observed / AI interpretation / Expected impact. */
export function InsightCard({ insight: i }: { insight: Insight }) {
  const t = useT();
  const status = insightStatusMeta[i.status];
  return (
    <article className={cn('bg-surface-card border border-border-strong rounded-xl shadow-card p-5 flex flex-col justify-between hover:border-secondary transition-all', i.status === 'dismissed' && 'opacity-60')}>
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-[0.6875rem] bg-surface-card-subtle text-text-secondary font-semibold">{t(categoryMeta[i.category].label)}</span>
            <PriorityPill priority={i.priority} />
            {i.ai && <AiGeneratedBadge ai={i.ai} />}
            {i.status !== 'new' && (
              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold border', status.pill)}>
                <Icon name={status.icon} className="text-[0.75rem]" />
                {t(status.label)}
              </span>
            )}
          </div>
          {i.ai ? (
            <QualityPill quality={i.ai.evidenceQuality} />
          ) : (
            <span className="text-label-sm font-label-sm text-text-tertiary font-medium shrink-0">{t('{percent}% sure', { percent: i.confidence })}</span>
          )}
        </div>
        <h3 className="font-heading text-[1.0625rem] font-semibold text-text-primary mb-3">
          <Link to={`/ai-insights/${i.id}`} className="hover:underline">
            {i.title}
          </Link>
        </h3>
        <div className="space-y-2.5 text-body-sm font-body-sm mb-4">
          <div className="bg-surface-canvas p-3 rounded-lg">
            <div className="text-[0.75rem] font-semibold text-text-secondary mb-1 flex items-center gap-1">
              <Icon name="query_stats" className="text-[0.8125rem]" />
              {t('What we saw')}
            </div>
            <p className="text-text-primary">
              <RichText text={i.observed} />
            </p>
          </div>
          <div className="bg-ai-subtle/50 p-3 rounded-lg">
            <div className="text-[0.75rem] font-semibold text-ai-accent mb-1 flex items-center gap-1">
              <Icon name="auto_awesome" filled className="text-[0.8125rem]" />
              {t('What AI thinks')}
            </div>
            <p className="text-text-primary">{i.interpretation}</p>
          </div>
          <div className={cn('flex items-start gap-1.5 text-label-sm font-label-sm font-semibold pt-1', i.impact.tone === 'positive' ? 'text-status-active' : 'text-text-secondary')}>
            <Icon name={i.impact.icon} className={cn('text-[0.9375rem] mt-px', i.impact.tone === 'warning' && 'text-error')} />
            <span>
              {i.impact.text}
              {i.impact.predictive && <span className="ml-1 text-[0.6875rem] font-normal text-text-tertiary">{t('(AI estimate)')}</span>}
            </span>
          </div>
        </div>
      </div>
      <div className="pt-3 border-t border-border-strong flex items-center justify-between gap-2 flex-wrap text-label-md font-label-md">
        <Link to={i.primaryLink.to} className="text-primary hover:text-brand-primary-hover font-semibold flex items-center gap-1">
          <span>{i.primaryLink.label}</span>
          <Icon name="arrow_forward" className="text-[1rem]" />
        </Link>
        <Link to={`/ai-insights/${i.id}`} className="text-text-secondary hover:text-text-primary font-medium flex items-center gap-1">
          <span>{t('Details')}</span>
          <Icon name="chevron_right" className="text-[1rem]" />
        </Link>
      </div>
    </article>
  );
}
