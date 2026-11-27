import { useState } from 'react';
import { ChartLegend, TrendChart } from '@/components/charts/TrendChart';
import { SegmentedControl } from '@/components/ui/Controls';
import { msg, useT } from '@/i18n/I18nContext';
import { formatCompact } from '@/lib/format';
import type { CampaignProgression, CampaignProgressMetric } from '@/types/campaigns';
import type { Campaign } from '@/types/domain';
import { UnavailableNote } from './SectionCard';

const METRICS: Array<{ value: CampaignProgressMetric; label: string }> = [
  { value: 'views', label: msg('Views') },
  { value: 'reach', label: msg('Reach') },
  { value: 'engagement', label: msg('Engagement') },
  { value: 'leads', label: msg('Leads') },
];

const CURRENT_LABEL = msg('This campaign');
const PREVIOUS_LABEL = msg('Last month');

/** Growth chart: running total for this campaign vs last month, with a metric switch. */
export function PerformanceAnalytics({ campaign, progression }: { campaign: Campaign; progression: CampaignProgression | undefined }) {
  const t = useT();
  const [metric, setMetric] = useState<CampaignProgressMetric>('views');
  const formatter = metric === 'engagement' ? (v: number) => `${v.toFixed(2)}%` : (v: number) => formatCompact(v, { fullBelow: 1000 });
  const options = METRICS.map((o) => ({ value: o.value, label: t(o.label) }));

  return (
    <section className="bg-surface-card border border-border-strong rounded-xl shadow-card p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('Growth')}</h2>
          <p className="text-body-sm text-text-secondary">{t('Day by day, compared with last month')}</p>
        </div>
        {progression && <SegmentedControl options={options} value={metric} onChange={setMetric} ariaLabel={t('Choose a number')} />}
      </div>
      {progression ? (
        <div className="pt-4">
          <TrendChart data={progression[metric]} height={256} showYAxis valueFormatter={formatter} currentLabel={t(CURRENT_LABEL)} previousLabel={t(PREVIOUS_LABEL)} />
          <div className="pt-2">
            <ChartLegend
              items={[
                { label: t(CURRENT_LABEL), color: 'var(--eko-gold)' },
                { label: t(PREVIOUS_LABEL), color: 'var(--chart-muted)', dashed: true },
              ]}
            />
          </div>
        </div>
      ) : (
        <UnavailableNote icon="monitoring">{campaign.metrics ? t('No day-by-day numbers for this campaign in the sample data.') : t('Numbers show up after it starts.')}</UnavailableNote>
      )}
    </section>
  );
}
