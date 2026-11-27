import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { KpiCard } from '@/components/ui/KpiCard';
import { Skeleton } from '@/components/ui/States';
import { msg, useT } from '@/i18n/I18nContext';
import { formatCompact, formatNumber, formatPercent } from '@/lib/format';
import type { AccountOverview, Campaign } from '@/types/domain';

const ACCOUNT_HINT = msg('Whole account for this period, campaigns and other posts together.');

/** Four headline numbers for the campaigns list; two more open with "More numbers". */
export function CampaignsKpiStrip({ campaigns, overview }: { campaigns: Campaign[]; overview: AccountOverview | undefined }) {
  const t = useT();
  const [more, setMore] = useState(false);
  const active = campaigns.filter((c) => c.status === 'active').length;
  const scheduled = campaigns.filter((c) => c.status === 'scheduled').length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={msg('Running now')} icon="play_circle" tone="success" value={active} footnote={t('Starting soon: {count}', { count: scheduled })} />
        <KpiCard label={msg('Views')} icon="visibility" tone="teal" value={overview ? formatCompact(overview.views.value) : '—'} delta={overview?.views.delta} deltaLabel={msg('vs last month')} hint={ACCOUNT_HINT} />
        <KpiCard label={msg('People reached')} icon="groups" tone="ai" value={overview ? formatCompact(overview.reach.value) : '—'} delta={overview?.reach.delta} deltaLabel={msg('vs last month')} hint={ACCOUNT_HINT} />
        <KpiCard
          label={msg('Leads')}
          icon="person_add"
          highlight
          value={overview ? formatNumber(overview.leads.value) : '—'}
          delta={overview?.leads.delta}
          deltaLabel={msg('vs last month')}
          footnote={overview ? t('Goal: {count}', { count: formatNumber(overview.leads.target) }) : undefined}
        />
      </div>
      {more && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label={msg('All campaigns')} icon="folder" tone="teal" value={campaigns.length} />
          <KpiCard label={msg('Engagement')} icon="favorite" tone="success" value={overview ? formatPercent(overview.engagementRate.value) : '—'} delta={overview?.engagementRate.delta} hint={ACCOUNT_HINT} />
        </div>
      )}
      <button
        type="button"
        onClick={() => setMore((m) => !m)}
        aria-expanded={more}
        className="text-label-md font-semibold text-text-secondary hover:text-text-primary flex items-center gap-1"
      >
        <Icon name={more ? 'expand_less' : 'expand_more'} className="text-[1.125rem]" />
        {more ? t('Fewer numbers') : t('More numbers')}
      </button>
    </div>
  );
}

export function CampaignsKpiSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  );
}
