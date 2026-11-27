import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { KpiCard } from '@/components/ui/KpiCard';
import { Skeleton } from '@/components/ui/States';
import { msg, useT } from '@/i18n/I18nContext';
import { formatCompact, formatNumber, formatPercent } from '@/lib/format';
import type { AccountOverview, ContentItem } from '@/types/domain';

export function LibraryKpiSkeleton() {
  const t = useT();
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label={t('Loading numbers')}>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-[112px]" />
      ))}
    </section>
  );
}

/** Four headline numbers (posts, views, engagement, leads); reach and watch time open with "More numbers". */
export function LibraryKpiStrip({ overview, content }: { overview: AccountOverview; content: ContentItem[] | undefined }) {
  const t = useT();
  const navigate = useNavigate();
  const [more, setMore] = useState(false);
  const total = content?.length;
  const reelShare = content && content.length ? Math.round((content.filter((c) => c.type === 'reel').length / content.length) * 100) : undefined;
  const leadTargetPct = Math.round((overview.leads.value / overview.leads.target) * 100);

  return (
    <div className="space-y-3">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={msg('Posts')}
          icon="movie"
          tone="teal"
          value={total ?? '—'}
          footnote={reelShare !== undefined ? t('{pct}% are Reels', { pct: reelShare }) : undefined}
        />
        <KpiCard label={msg('Views')} icon="visibility" tone="ai" value={formatCompact(overview.views.value)} delta={overview.views.delta} deltaLabel={msg('vs last month')} />
        <KpiCard
          label={msg('Engagement')}
          icon="favorite"
          tone="success"
          value={formatPercent(overview.engagementRate.value)}
          delta={overview.engagementRate.delta}
          deltaLabel={msg('vs last month')}
          hint={msg('Likes, comments, shares and saves as a share of people reached.')}
        />
        <KpiCard
          label={msg('Leads')}
          icon="person_add"
          value={formatNumber(overview.leads.value)}
          delta={overview.leads.delta}
          deltaLabel={msg('vs last month')}
          footnote={t('{pct}% of target', { pct: leadTargetPct })}
          highlight
          onClick={() => navigate('/leads')}
        />
      </section>
      {more && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label={msg('People reached')} icon="groups" tone="teal" value={formatCompact(overview.reach.value)} delta={overview.reach.delta} deltaLabel={msg('vs last month')} />
          <KpiCard
            label={msg('Watch time')}
            icon="schedule"
            tone="warning"
            value={t('{count} hrs', { count: formatNumber(overview.watchTimeHours.value) })}
            delta={overview.watchTimeHours.delta}
            deltaLabel={msg('vs last month')}
          />
        </section>
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
