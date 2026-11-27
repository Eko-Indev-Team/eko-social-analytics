import { KpiCard } from '@/components/ui/KpiCard';
import { Skeleton } from '@/components/ui/States';
import { msg, useT } from '@/i18n/I18nContext';
import { formatNumber } from '@/lib/format';
import type { LeadPipelineSummary } from '@/types/domain';

/** Four lead numbers for the period: comment questions, likely leads, leads and new agents. */
export function LeadKpis({ summary }: { summary: LeadPipelineSummary }) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label={msg('Comment questions')} icon="chat_bubble" tone="teal" value={formatNumber(summary.totalCommentInquiries)} hint={msg('All questions asked in Instagram comments.')} />
      <KpiCard
        label={msg('Likely leads')}
        icon="auto_awesome"
        tone="ai"
        value={formatNumber(summary.aiFilteredPotential)}
        footnote={t('{rate}% of comments', { rate: summary.aiIntentRate.toFixed(1) })}
        hint={msg('Comments that AI thinks show real interest.')}
      />
      <KpiCard label={msg('Leads')} icon="person_add" value={formatNumber(summary.qualifiedLeads)} delta={summary.qualifiedLeadsDelta} deltaLabel={msg('vs last month')} highlight />
      <KpiCard
        label={msg('Became agents')}
        icon="verified"
        tone="success"
        value={formatNumber(summary.convertedOperators)}
        footnote={t('{rate}% of leads', { rate: summary.closeRate.toFixed(1) })}
      />
    </div>
  );
}

export function LeadKpisSkeleton() {
  const t = useT();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" role="status" aria-label={t('Loading…')}>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  );
}
