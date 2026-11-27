import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { KpiCard } from '@/components/ui/KpiCard';
import { msg, useT } from '@/i18n/I18nContext';
import { formatCompact, formatNumber, formatPercent } from '@/lib/format';
import type { AccountOverview, Campaign } from '@/types/domain';
import { activeCampaigns } from './selectors';

/** Four headline numbers; the other four open with "More numbers". */
export function DashboardKpis({ overview, campaigns }: { overview: AccountOverview; campaigns: Campaign[] | undefined }) {
  const t = useT();
  const navigate = useNavigate();
  const [more, setMore] = useState(false);
  const active = campaigns ? activeCampaigns(campaigns).length : undefined;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={msg('Views')} icon="visibility" tone="igOrange" value={formatCompact(overview.views.value)} delta={overview.views.delta} deltaLabel={msg('vs last month')} />
        <KpiCard label={msg('People reached')} icon="groups" tone="igPink" value={formatCompact(overview.reach.value)} delta={overview.reach.delta} deltaLabel={msg('vs last month')} />
        <KpiCard
          label={msg('Engagement')}
          icon="favorite"
          tone="igPurple"
          value={formatPercent(overview.engagementRate.value)}
          delta={overview.engagementRate.delta}
          hint={msg('Likes, comments, shares and saves as a share of people reached.')}
        />
        <KpiCard label={msg('Leads')} icon="person_add" value={formatNumber(overview.leads.value)} delta={overview.leads.delta} highlight onClick={() => navigate('/leads')} />
      </div>
      {more && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label={msg('Running campaigns')} icon="campaign" tone="teal" value={active ?? '—'} onClick={() => navigate('/campaigns')} />
          <KpiCard label={msg('Likes')} icon="thumb_up" tone="ai" value={formatCompact(overview.likes.value)} delta={overview.likes.delta} />
          <KpiCard label={msg('Comments')} icon="chat_bubble" tone="success" value={formatNumber(overview.comments.value)} delta={overview.comments.delta} />
          <KpiCard
            label={msg('Shares & saves')}
            icon="bookmark"
            tone="warning"
            value={formatCompact(overview.shares.value + overview.saves.value)}
            footnote={`${t('Shares')} ${formatCompact(overview.shares.value)} · ${t('Saves')} ${formatCompact(overview.saves.value)}`}
          />
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
