import { useState } from 'react';
import { ChartLegend, TrendChart } from '@/components/charts/TrendChart';
import { SegmentedControl } from '@/components/ui/Controls';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { formatCompact, formatPercent } from '@/lib/format';
import { accountService } from '@/services/accounts';
import type { TrendMetric } from '@/types/domain';

type ChartMetric = Extract<TrendMetric, 'views' | 'reach' | 'engagement' | 'leads' | 'shares'>;

const metricOptions: Array<{ value: ChartMetric; label: string }> = [
  { value: 'views', label: msg('Views') },
  { value: 'reach', label: msg('Reach') },
  { value: 'engagement', label: msg('Engagement') },
  { value: 'leads', label: msg('Leads') },
  { value: 'shares', label: msg('Shares') },
];

const formatters: Record<ChartMetric, (v: number) => string> = {
  views: (v) => formatCompact(v),
  reach: (v) => formatCompact(v),
  engagement: (v) => formatPercent(v),
  leads: (v) => formatCompact(v),
  shares: (v) => formatCompact(v),
};

const CURRENT_LABEL = msg('This month');
const PREVIOUS_LABEL = msg('Last month');

/** Performance Trends card: current vs baseline series with the Views/Reach/Engagement/Leads/Shares switch. */
export function PerformanceTrends() {
  const t = useT();
  const [metric, setMetric] = useState<ChartMetric>('views');
  const trends = useQuery('accounts:trends', accountService.trends);
  const label = t(metricOptions.find((o) => o.value === metric)?.label ?? metric);
  const options = metricOptions.map((o) => ({ value: o.value, label: t(o.label) }));

  return (
    <section className="bg-surface-card border border-border-strong rounded-xl shadow-card p-5" aria-labelledby="dash-trends-title">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 id="dash-trends-title" className="font-heading text-[1.0625rem] font-semibold text-text-primary">
            {t('Growth this month')}
          </h2>
          <p className="text-body-sm text-text-secondary">{t('Day by day, compared with last month')}</p>
        </div>
        <SegmentedControl options={options} value={metric} onChange={setMetric} ariaLabel={t('Choose a number')} />
      </div>
      <div className="pt-4">
        <QueryState
          query={trends}
          loading={<Skeleton className="h-64" />}
          empty={<div className="h-64 flex items-center justify-center text-body-sm text-text-secondary">{t('No data for this period.')}</div>}
        >
          {(data) => (
            <div role="img" aria-label={`${label}: ${t('This month')} / ${t('Last month')}`}>
              <TrendChart data={data[metric]} height={256} valueFormatter={formatters[metric]} currentLabel={t(CURRENT_LABEL)} previousLabel={t(PREVIOUS_LABEL)} />
            </div>
          )}
        </QueryState>
        <div className="pt-2">
          <ChartLegend
            items={[
              { label: t(CURRENT_LABEL), color: 'var(--eko-gold)' },
              { label: t(PREVIOUS_LABEL), color: 'var(--chart-muted)', dashed: true },
            ]}
          />
        </div>
      </div>
    </section>
  );
}
