import { useState } from 'react';
import { AiBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { KpiCard } from '@/components/ui/KpiCard';
import { msg, useT } from '@/i18n/I18nContext';
import { formatCompact, formatNumber, formatPercent } from '@/lib/format';
import { ratio } from '../contentMeta';
import type { AnalyticsPageData } from './model';

/** Four headline numbers for this post; likes, comments, shares and saves open with "More numbers". */
export function ReelKpiGrid({ data }: { data: AnalyticsPageData }) {
  const t = useT();
  const [more, setMore] = useState(false);
  const { item, analytics, overview } = data;
  const m = item.metrics;
  const story = item.type === 'story';
  const accountEr = overview.engagementRate.value;
  const storyHint = msg('Not tracked for Stories');

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <KpiCard
          label={msg('Views')}
          icon="visibility"
          tone="teal"
          value={formatCompact(m.views)}
          delta={analytics?.viewsDeltaPct}
          deltaLabel={msg('vs your usual for this type')}
        />
        <KpiCard label={msg('People reached')} icon="groups" tone="ai" value={formatCompact(m.reach)} />
        <KpiCard
          label={msg('Engagement')}
          icon="favorite"
          tone="success"
          value={formatPercent(m.engagementRate)}
          delta={analytics?.engagementDeltaPct}
          deltaLabel={msg('vs your usual for this type')}
          footnote={m.engagementRate >= accountEr ? t('Above your average ({value})', { value: formatPercent(accountEr) }) : t('Below your average ({value})', { value: formatPercent(accountEr) })}
        />
        <KpiCard
          label={msg('Leads')}
          icon="person_add"
          value={formatNumber(m.leads)}
          highlight
          footnote={m.comments > 0 ? t('{pct} of comments became leads', { pct: formatPercent(ratio(m.leads, m.comments), 1) }) : undefined}
        />
      </div>
      {more && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard label={msg('Likes')} icon="thumb_up" tone="ai" value={story ? '—' : formatCompact(m.likes)} hint={story ? storyHint : undefined} />
          <KpiCard label={msg('Comments')} icon="chat_bubble" tone="teal" value={story ? '—' : formatNumber(m.comments)} hint={story ? msg('Story replies arrive as DMs') : undefined} />
          <KpiCard label={msg('Shares')} icon="share" tone="success" value={formatNumber(m.shares)} />
          <KpiCard label={msg('Saves')} icon="bookmark" tone="warning" value={story ? '—' : formatCompact(m.saves)} hint={story ? storyHint : undefined} />
        </div>
      )}
      <button
        type="button"
        onClick={() => setMore((v) => !v)}
        aria-expanded={more}
        className="text-label-md font-semibold text-text-secondary hover:text-text-primary flex items-center gap-1"
      >
        <Icon name={more ? 'expand_less' : 'expand_more'} className="text-[1.125rem]" />
        {more ? t('Fewer numbers') : t('More numbers')}
      </button>
    </div>
  );
}

/** Short AI summary of this post (or an honest "none yet" line). */
export function AiVerdictBanner({ data }: { data: AnalyticsPageData }) {
  const t = useT();
  const verdict = data.analytics?.verdict;
  return (
    <div className="bg-ai-subtle border border-ai-border rounded-xl p-4 flex items-start gap-3">
      <span className="w-9 h-9 rounded-full bg-surface-card text-ai-accent flex items-center justify-center shrink-0">
        <Icon name="auto_awesome" className="text-[1.125rem]" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-semibold text-text-primary">{t('AI summary')}</span>
          <AiBadge />
          <InfoTip text={t('Written by AI from sample data. Check before you act on it.')} className="ml-auto" />
        </div>
        {verdict ? (
          <>
            <p className="text-label-md font-semibold text-text-primary">{verdict.title}</p>
            <p className="text-body-sm text-text-secondary mt-0.5">{verdict.body}</p>
          </>
        ) : (
          <p className="text-body-sm text-text-secondary">{t('No AI summary for this post yet.')}</p>
        )}
      </div>
    </div>
  );
}
