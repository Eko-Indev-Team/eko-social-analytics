import { useT } from '@/i18n/I18nContext';
import { KpiCard } from '@/components/ui/KpiCard';
import { Skeleton } from '@/components/ui/States';
import type { AdsSummary } from '@/types/ads';
import { formatCount, formatInr, formatInrPrecise } from './adsFormat';

/** Ads dashboard number tiles. */
export function AdsKpis({ summary }: { summary: AdsSummary }) {
  const t = useT();
  const strong = summary.qualificationCounts.sbi_strong + summary.qualificationCounts.esaf_strong;
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Money spent"
        icon="payments"
        tone="gold"
        value={formatInr(summary.spend)}
        footnote={t('{active} of {total} ads running', { active: summary.activeAdCount, total: summary.adCount })}
      />
      <KpiCard label="Leads" icon="contact_page" tone="teal" value={formatCount(summary.leads)} hint="People who filled the form in an ad." footnote={t('{count} website signups', { count: formatCount(summary.websiteSignups) })} />
      <KpiCard
        label="Strongly qualified"
        icon="verified"
        tone="success"
        value={formatCount(strong)}
        hint="Strongly qualified for SBI or ESAF."
        footnote={t('SBI {sbi} · ESAF {esaf}', { sbi: summary.qualificationCounts.sbi_strong, esaf: summary.qualificationCounts.esaf_strong })}
      />
      <KpiCard
        label="Cost per lead"
        icon="price_check"
        tone="ai"
        value={formatInrPrecise(summary.costPerLead)}
        footnote={t('{cost} per strong lead', { cost: formatInrPrecise(summary.costPerQualifiedLead) })}
      />
    </div>
  );
}

export function AdsKpisSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  );
}
