import { KpiCard } from '@/components/ui/KpiCard';
import { msg, useT } from '@/i18n/I18nContext';
import { formatNumber } from '@/lib/format';
import type { ReportContext, ReportListItem } from '@/types/reports';

/** Four headline numbers. Report counts come from the report library; leads from the account overview. */
export function ReportsKpis({ items, ctx }: { items: ReportListItem[]; ctx: ReportContext }) {
  const t = useT();
  const ready = items.filter((r) => r.status === 'ready' || r.status === 'ready_demo' || r.status === 'archived').length;
  const scheduled = items.filter((r) => r.schedule !== 'none' && r.status !== 'archived').length;
  const analyzedIds = new Set(items.flatMap((r) => r.campaignIds));
  const analyzed = ctx.campaigns.filter((c) => analyzedIds.has(c.id) && c.metrics).length;
  const o = ctx.overview;

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label={msg('Reports ready')} icon="description" tone="teal" value={formatNumber(ready)} />
      <KpiCard label={msg('Scheduled')} icon="schedule" tone="gold" value={formatNumber(scheduled)} hint={msg('Reports set to run again on a schedule.')} />
      <KpiCard
        label={msg('Campaigns covered')}
        icon="campaign"
        tone="ai"
        value={
          <>
            {analyzed} <span className="text-body-md text-text-tertiary font-normal">{t('of {total}', { total: ctx.campaigns.length })}</span>
          </>
        }
      />
      <KpiCard
        label={msg('Leads')}
        icon="person_add"
        highlight
        value={formatNumber(o.leads.value)}
        delta={o.leads.delta}
        deltaLabel={msg('vs last month')}
        footnote={t('Goal: {target}', { target: formatNumber(o.leads.target) })}
      />
    </section>
  );
}
