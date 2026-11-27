import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { KpiCard, type KpiTone } from '@/components/ui/KpiCard';
import { msg, useT } from '@/i18n/I18nContext';
import { formatCompact, formatPercent } from '@/lib/format';
import type { Campaign, CampaignMetrics } from '@/types/domain';
import { pctDelta } from '../campaignUtils';

interface KpiDef {
  key: keyof CampaignMetrics;
  label: string;
  icon: string;
  tone: KpiTone;
  format: (v: number) => string;
  highlight?: boolean;
  hint?: string;
}

const MAIN: KpiDef[] = [
  { key: 'views', label: msg('Views'), icon: 'visibility', tone: 'teal', format: (v) => formatCompact(v) },
  { key: 'reach', label: msg('People reached'), icon: 'groups', tone: 'ai', format: (v) => formatCompact(v) },
  {
    key: 'engagementRate',
    label: msg('Engagement'),
    icon: 'favorite',
    tone: 'success',
    format: (v) => formatPercent(v),
    hint: msg('Likes, comments, shares and saves as a share of people reached.'),
  },
  { key: 'leads', label: msg('Leads'), icon: 'person_add', tone: 'gold', format: (v) => formatCompact(v), highlight: true },
];

const MORE: KpiDef[] = [
  { key: 'likes', label: msg('Likes'), icon: 'thumb_up', tone: 'ai', format: (v) => formatCompact(v) },
  { key: 'comments', label: msg('Comments'), icon: 'chat_bubble', tone: 'success', format: (v) => formatCompact(v) },
  { key: 'shares', label: msg('Shares'), icon: 'share', tone: 'teal', format: (v) => formatCompact(v) },
  { key: 'saves', label: msg('Saves'), icon: 'bookmark', tone: 'warning', format: (v) => formatCompact(v) },
];

/** Four headline numbers for one campaign (change vs the previous month); likes, comments, shares and saves open with "More numbers". */
export function CampaignKpiGrid({ metrics, baseline }: { metrics: CampaignMetrics; baseline: Campaign['baseline'] }) {
  const t = useT();
  const [more, setMore] = useState(false);
  const card = (k: KpiDef) => (
    <KpiCard
      key={k.key}
      label={k.label}
      icon={k.icon}
      tone={k.tone}
      highlight={k.highlight}
      hint={k.hint}
      value={k.format(metrics[k.key])}
      delta={pctDelta(metrics[k.key], baseline?.[k.key])}
      deltaLabel={msg('vs last month')}
    />
  );
  return (
    <section className="space-y-3" aria-label={t('Campaign numbers')}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{MAIN.map(card)}</div>
      {more && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{MORE.map(card)}</div>}
      <button
        type="button"
        onClick={() => setMore((m) => !m)}
        aria-expanded={more}
        className="text-label-md font-semibold text-text-secondary hover:text-text-primary flex items-center gap-1"
      >
        <Icon name={more ? 'expand_less' : 'expand_more'} className="text-[1.125rem]" />
        {more ? t('Fewer numbers') : t('More numbers')}
      </button>
    </section>
  );
}
