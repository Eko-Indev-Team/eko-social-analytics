import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { KpiCard } from '@/components/ui/KpiCard';
import { msg, useT } from '@/i18n/I18nContext';
import { cn, formatCompact, formatNumber, formatPercent } from '@/lib/format';
import type { AudiencePageData } from './model';

/** Four headline numbers; two more open with "More numbers". With "compare" off, the change pills are hidden. */
export function AudienceKpis({ data, compare }: { data: AudiencePageData; compare: boolean }) {
  const t = useT();
  const [more, setMore] = useState(false);
  const { summary, intel, overview } = data;
  const d = (v: number | undefined) => (compare ? (v ?? 0) : undefined);

  return (
    <div className="space-y-3">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={msg('People reached')}
          icon="visibility"
          tone="teal"
          value={formatCompact(overview.reach.value)}
          delta={d(overview.reach.delta)}
          deltaLabel={msg('vs last month')}
          hint={msg('Different accounts that saw your posts.')}
        />
        <KpiCard
          label={msg('Followers')}
          icon="group"
          tone="ai"
          value={formatCompact(summary.followers)}
          delta={d(summary.followerGrowthPct)}
          deltaLabel={msg('vs last month')}
          footnote={t('{count} more this month', { count: formatNumber(summary.netNewFollowers) })}
        />
        <KpiCard
          label={msg('New followers')}
          icon="person_add"
          tone="success"
          value={formatNumber(intel.kpis.newFollowersGross)}
          delta={d(intel.kpis.newFollowersDeltaPct)}
          deltaLabel={msg('vs last month')}
          hint={msg('All new followers this month, before unfollows.')}
          highlight
        />
        <KpiCard
          label={msg('Engagement')}
          icon="favorite"
          tone="gold"
          value={formatPercent(overview.engagementRate.value)}
          delta={d(overview.engagementRate.delta)}
          deltaLabel={msg('vs last month')}
          hint={msg('Likes, comments, shares and saves as a share of people reached.')}
        />
      </section>
      {more && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label={msg('People who interacted')}
            icon="touch_app"
            tone="teal"
            value={formatCompact(summary.engagedAudience)}
            delta={d(intel.kpis.engagedAudienceDeltaPct)}
            deltaLabel={msg('vs last month')}
            hint={msg('Accounts that liked, commented, saved or shared.')}
          />
          <KpiCard
            label={msg('Non-followers reached')}
            icon="explore"
            tone="ai"
            value={`${summary.nonFollowerReachPct}%`}
            delta={d(intel.kpis.nonFollowerDeltaPct)}
            deltaLabel={msg('vs last month')}
            hint={msg('Share of people reached who do not follow you yet.')}
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

/** Three light highlight cards: best age group, top state, new people found you. */
export function AudienceInsightCards({ data }: { data: AudiencePageData }) {
  const t = useT();
  const { intel, summary } = data;
  const topSegment = [...intel.segments].sort((a, b) => b.conversionRate - a.conversionRate)[0];
  const topState = summary.topStates[0];
  const nonFollowerLeads = intel.followerSplit.find((r) => r.metric === 'leads')?.nonFollowers ?? 0;
  const cards = [
    {
      key: 'age',
      icon: 'military_tech',
      iconCls: 'bg-amber-400/15 text-amber-400',
      eyebrow: t('Best age group'),
      title: topSegment.label.replace(' Years Old', ''),
      body: t('{rate} engagement and {leads} leads.', { rate: formatPercent(topSegment.engagementRate), leads: topSegment.leads }),
    },
    {
      key: 'state',
      icon: 'location_on',
      iconCls: 'bg-status-completed-subtle text-status-completed',
      eyebrow: t('Top state'),
      title: topState.label,
      body: t('{share}% of your audience, {reach} reached, {leads} leads.', { share: topState.share, reach: formatCompact(topState.reach), leads: topState.leads }),
    },
    {
      key: 'discovery',
      icon: 'explore',
      iconCls: 'bg-ai-subtle text-ai-accent',
      eyebrow: t('New people'),
      title: t('{pct}% non-followers', { pct: summary.nonFollowerReachPct }),
      body: t('{leads} leads came from people who do not follow you yet.', { leads: nonFollowerLeads }),
    },
  ];

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.key} className="bg-surface-card border border-border-strong rounded-xl shadow-card p-4 flex items-start gap-3">
          <span className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0', c.iconCls)}>
            <Icon name={c.icon} className="text-[1.125rem]" />
          </span>
          <div className="min-w-0">
            <p className="text-label-sm text-text-tertiary">{c.eyebrow}</p>
            <p className="font-heading text-[1rem] font-semibold text-text-primary">{c.title}</p>
            <p className="text-body-sm text-text-secondary mt-0.5">{c.body}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
