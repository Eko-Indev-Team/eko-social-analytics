import { useState } from 'react';
import { ChartLegend, TrendChart } from '@/components/charts/TrendChart';
import { SegmentedControl } from '@/components/ui/Controls';
import { ErrorState, QueryState, Skeleton } from '@/components/ui/States';
import type { QueryResult } from '@/hooks/useQuery';
import { msg, useT, type Translate } from '@/i18n/I18nContext';
import { formatCompact, formatNumber } from '@/lib/format';
import type { TrendMetric, TrendPoint } from '@/types/domain';

type ChartMetric = Extract<TrendMetric, 'views' | 'reach' | 'engagement' | 'leads' | 'watchTime'>;

const metricOptions: Array<{ value: ChartMetric; label: string }> = [
  { value: 'views', label: msg('Views') },
  { value: 'reach', label: msg('Reach') },
  { value: 'engagement', label: msg('Engagement') },
  { value: 'leads', label: msg('Leads') },
  { value: 'watchTime', label: msg('Watch time') },
];

const formatter = (metric: ChartMetric, t: Translate) => (v: number) => {
  switch (metric) {
    case 'engagement':
      return `${v.toFixed(2)}%`;
    case 'leads':
      return formatNumber(v);
    case 'watchTime':
      return t('{count} hrs', { count: formatNumber(v) });
    default:
      return formatCompact(v);
  }
};

const CURRENT_LABEL = msg('This month');
const PREVIOUS_LABEL = msg('Last month');

/** Day-by-day chart of the chosen number, this month against last month. */
export function PerformanceTrendsCard({ trends }: { trends: QueryResult<Record<TrendMetric, TrendPoint[]>> }) {
  const t = useT();
  const [metric, setMetric] = useState<ChartMetric>('views');
  const fmt = formatter(metric, t);
  const label = t(metricOptions.find((o) => o.value === metric)?.label ?? metric);
  const options = metricOptions.map((o) => ({ value: o.value, label: t(o.label) }));

  return (
    <section className="lg:col-span-8 bg-surface-card border border-border-strong rounded-xl shadow-card p-5 min-w-0" aria-labelledby="content-trends-title">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 id="content-trends-title" className="font-heading text-[1.0625rem] font-semibold text-text-primary">
            {t('Growth this month')}
          </h2>
          <p className="text-body-sm text-text-secondary">{t('Day by day, compared with last month')}</p>
        </div>
        <SegmentedControl ariaLabel={t('Choose a number')} options={options} value={metric} onChange={setMetric} size="xs" />
      </div>
      <div className="pt-4">
        <QueryState
          query={trends}
          loading={<Skeleton className="h-64" />}
          empty={<div className="h-64 flex items-center justify-center text-body-sm text-text-secondary">{t('No data for this period.')}</div>}
          error={(err, retry) => <ErrorState title={t('Could not load the chart')} error={err} onRetry={retry} />}
        >
          {(data) => (
            <div role="img" aria-label={`${label}: ${t(CURRENT_LABEL)} / ${t(PREVIOUS_LABEL)}`}>
              <TrendChart data={data[metric]} height={256} valueFormatter={fmt} currentLabel={t(CURRENT_LABEL)} previousLabel={t(PREVIOUS_LABEL)} />
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
