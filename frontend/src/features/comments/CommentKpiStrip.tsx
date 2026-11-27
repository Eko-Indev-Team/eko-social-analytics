import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { KpiCard } from '@/components/ui/KpiCard';
import { msg, useT } from '@/i18n/I18nContext';
import { formatNumber } from '@/lib/format';
import type { CommentSummary } from '@/types/comments';
import { pct } from './commentMeta';

/** Four headline numbers; neutral, negative and average mood open with "More numbers". */
export function CommentKpiStrip({ summary, onShowAwaiting, onShowLeads }: { summary: CommentSummary; onShowAwaiting: () => void; onShowLeads: () => void }) {
  const t = useT();
  const [more, setMore] = useState(false);
  const { totalComments: total, sentiment } = summary;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={msg('Comments')} icon="chat_bubble" tone="teal" value={formatNumber(total)} delta={summary.totalDeltaPct} deltaLabel={msg('vs last month')} />
        <KpiCard
          label={msg('Positive')}
          icon="sentiment_satisfied"
          tone="success"
          value={formatNumber(sentiment.positive)}
          footnote={t('{pct} of all comments', { pct: pct(sentiment.positive, total) })}
        />
        <KpiCard label={msg('Need a reply')} icon="reply" tone="warning" value={formatNumber(summary.needsResponse)} onClick={onShowAwaiting} footnote={t('Click to show them')} />
        <KpiCard
          label={msg('Possible leads')}
          icon="person_add"
          value={formatNumber(summary.potentialLeads)}
          highlight
          onClick={onShowLeads}
          footnote={t('AI estimate from the comment text')}
        />
      </div>
      {more && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label={msg('Neutral')}
            icon="sentiment_neutral"
            tone="teal"
            value={formatNumber(sentiment.neutral)}
            footnote={t('{pct} of all comments', { pct: pct(sentiment.neutral, total) })}
          />
          <KpiCard
            label={msg('Negative')}
            icon="sentiment_dissatisfied"
            tone="warning"
            value={formatNumber(sentiment.negative)}
            footnote={t('{pct} of all comments', { pct: pct(sentiment.negative, total) })}
          />
          <KpiCard
            label={msg('Average mood')}
            icon="mood"
            tone="ai"
            value={<span>{summary.avgSentimentScore}<span className="text-label-md text-text-tertiary font-normal">/100</span></span>}
            footnote={t('{points} points vs last month', { points: `+${summary.avgSentimentDeltaPts}` })}
            hint={msg('Average feeling of all comments, from 0 (very negative) to 100 (very positive).')}
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
