import { ChartLegend, TrendChart } from '@/components/charts/TrendChart';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n/I18nContext';
import { cn, formatCompact, formatNumber } from '@/lib/format';
import type { ReportDetail } from '@/types/reports';

/** Views over time: running total for the report vs last month (both derived). */
export function TimelineCard({ detail }: { detail: ReportDetail }) {
  const t = useT();
  const { computed } = detail;
  const hasBaseline = computed.baselineGap !== null;
  return (
    <section className="bg-surface-card rounded-xl border border-border-strong shadow-card p-5 space-y-4 min-w-0" data-print-section="timeline">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('Views over time')}</h3>
          <p className="text-body-sm text-text-secondary">{t('Running total, {period}', { period: computed.periodLabel })}</p>
        </div>
        <ChartLegend
          items={[
            { label: t('This month'), color: 'var(--eko-gold)' },
            ...(hasBaseline ? [{ label: t('Last month'), color: 'var(--chart-muted)', dashed: true }] : []),
          ]}
        />
      </div>
      <TrendChart data={computed.timeline} height={256} showPrevious={hasBaseline} showYAxis currentLabel={t('This month')} previousLabel={t('Last month')} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-body-sm text-text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="insights" className="text-status-active text-[1rem]" />
          {computed.peak
            ? t('Best day: {date} with {views} views ({share}% of the period).', {
                date: computed.peak.date,
                views: formatCompact(computed.peak.views),
                share: computed.peak.share.toFixed(1),
              })
            : t('No activity in this period.')}
        </span>
        {computed.baselineGap !== null && (
          <span className="text-text-tertiary tnum">
            {t('{gap} views vs last month', { gap: `${computed.baselineGap >= 0 ? '+' : '−'}${formatNumber(Math.abs(computed.baselineGap))}` })}
          </span>
        )}
      </div>
    </section>
  );
}

const barColors = ['bg-primary-container', 'bg-tertiary', 'bg-slate-600', 'bg-slate-700'];
const iconColors = ['text-primary-container', 'text-tertiary', 'text-text-tertiary', 'text-text-tertiary'];

/** Best post types: share of engagement per content type, from content metrics. */
export function FormatEfficiencyCard({ detail }: { detail: ReportDetail }) {
  const t = useT();
  const { formats, efficiencyRatio } = detail.computed;
  const best = [...formats].filter((f) => f.views > 0).sort((a, b) => b.leads / b.views - a.leads / a.views)[0];
  return (
    <section className="bg-surface-card rounded-xl border border-border-strong shadow-card p-5 flex flex-col justify-between gap-4" data-print-section="formats">
      <div>
        <h3 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('Best post types')}</h3>
        <p className="text-body-sm text-text-secondary">{t('Share of engagement by type')}</p>
        <div className="mt-4 space-y-4">
          {formats.length === 0 && <p className="text-body-sm text-text-secondary">{t('No posts in this report.')}</p>}
          {formats.map((f, i) => (
            <div key={f.type} className="space-y-1.5">
              <div className="flex justify-between items-center gap-2 text-body-sm">
                <span className="font-semibold text-text-primary flex items-center gap-1.5">
                  <Icon name={f.icon} className={cn('text-[0.9375rem]', iconColors[i] ?? 'text-text-tertiary')} />
                  {t(f.label)} <span className="text-text-tertiary font-normal">({f.count})</span>
                </span>
                <span className="font-semibold text-text-primary tnum">{f.share.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-surface-canvas rounded-full h-2 overflow-hidden">
                <div className={cn('h-full rounded-full', barColors[i] ?? 'bg-slate-700')} style={{ width: `${f.share}%` }} />
              </div>
              <div className="flex justify-between text-[0.75rem] text-text-secondary tnum">
                <span>{t('{count} leads', { count: formatNumber(f.leads) })}</span>
                <span>{t('{views} views · {rate}% engagement', { views: formatCompact(f.views), rate: f.avgEngagementRate.toFixed(2) })}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {efficiencyRatio !== null && best && (
        <p className="p-3 rounded-lg bg-surface-canvas text-body-sm text-text-secondary flex items-start gap-1.5">
          <Icon name="verified" className="text-[1rem] text-status-active mt-0.5" />
          {t('{format} got {ratio}x more leads per view than the next best type.', { format: t(best.label), ratio: efficiencyRatio.toFixed(1) })}
        </p>
      )}
    </section>
  );
}
