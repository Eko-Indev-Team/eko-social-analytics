import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { useT } from '@/i18n/I18nContext';
import { cn, formatNumber } from '@/lib/format';
import type { CommentSummary } from '@/types/comments';
import type { Campaign, ContentItem } from '@/types/domain';

const barColors = ['bg-primary-container', 'bg-tertiary', 'bg-secondary', 'bg-status-draft', 'bg-text-tertiary'];

function Panel({ title, info, aside, footer, children }: { title: ReactNode; info?: string; aside?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-surface-card border border-border-strong rounded-xl shadow-card p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{title}</h3>
            {info && <InfoTip text={info} />}
          </div>
          {aside}
        </div>
        {children}
      </div>
      {footer && <div className="pt-3 mt-3">{footer}</div>}
    </div>
  );
}

/** Four small cards: most-discussed posts, comments per campaign, the reply queue and the AI tips. */
export function CommentInsightPanels({
  summary,
  content,
  campaigns,
  onStartTriage,
  onQueueBucket,
}: {
  summary: CommentSummary;
  content: ContentItem[];
  campaigns: Campaign[];
  onStartTriage: () => void;
  onQueueBucket: (intent: string) => void;
}) {
  const t = useT();
  const topContent = [...content].sort((a, b) => b.metrics.comments - a.metrics.comments).slice(0, 3);
  const campaignRows = campaigns
    .filter((c) => (c.metrics?.comments ?? 0) > 0)
    .sort((a, b) => (b.metrics?.comments ?? 0) - (a.metrics?.comments ?? 0));
  const attributed = campaignRows.reduce((s, c) => s + (c.metrics?.comments ?? 0), 0);
  const attributedPct = Math.round((attributed / summary.totalComments) * 100);
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
  const intelTone = { positive: 'text-status-active', primary: 'text-primary', negative: 'text-error' } as const;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <Panel
        title={t('Most discussed posts')}
        footer={
          <Link to="/content" className="text-label-md text-primary font-semibold hover:underline">
            {t('Open content')} →
          </Link>
        }
      >
        <ul className="space-y-3">
          {topContent.map((c, i) => (
            <li key={c.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <Link to={`/content/${c.id}`} className="font-semibold text-label-md text-text-primary truncate block hover:underline">
                  {i + 1}. {c.title}
                </Link>
                <div className="text-label-sm text-text-secondary tnum">{t('{count} comments', { count: formatNumber(c.metrics.comments) })}</div>
              </div>
              <span className={cn('text-[0.6875rem] px-2 py-0.5 rounded-full font-semibold shrink-0 tnum', i < 2 ? 'bg-amber-400/15 text-amber-400' : 'bg-slate-800 text-text-secondary')}>
                {t('{count} leads', { count: c.metrics.leads })}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title={t('By campaign')}
        footer={
          <div className="text-label-sm text-text-secondary flex justify-between gap-2">
            <span>{t('Running campaigns: {count}', { count: activeCampaigns })}</span>
            <span className="text-text-primary font-semibold">{t('{pct}% linked to a campaign', { pct: attributedPct })}</span>
          </div>
        }
      >
        <ul className="space-y-3 text-body-sm">
          {campaignRows.map((c, i) => {
            const n = c.metrics?.comments ?? 0;
            const share = Math.round((n / summary.totalComments) * 100);
            return (
              <li key={c.id}>
                <div className="flex justify-between gap-2 text-label-sm mb-1">
                  <Link to={`/campaigns/${c.id}`} className={cn('truncate hover:underline', i === 0 ? 'font-semibold text-text-primary' : 'text-text-secondary')}>
                    {c.name}
                  </Link>
                  <span className="tnum shrink-0 text-text-secondary">
                    {formatNumber(n)} ({share}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', barColors[i] ?? 'bg-text-tertiary')} style={{ width: `${share}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel
        title={t('To reply')}
        info={t('As of Oct 31, 2024.')}
        aside={<span className="px-2.5 py-0.5 rounded-full text-[0.6875rem] bg-error-container/40 text-error font-semibold tnum">{t('{count} open', { count: formatNumber(summary.needsResponse) })}</span>}
        footer={
          <button
            type="button"
            onClick={onStartTriage}
            className="w-full py-1.5 px-3 rounded-full border border-border-strong bg-surface-card hover:bg-surface-canvas text-label-md font-semibold text-text-primary flex items-center justify-center gap-1"
          >
            <Icon name="play_arrow" className="text-[1rem]" />
            <span>{t('Reply to the most important first')}</span>
          </button>
        }
      >
        <ul className="space-y-1">
          {summary.responseQueue.map((b) => (
            <li key={b.label}>
              <button type="button" onClick={() => onQueueBucket(b.intent)} className="w-full px-2.5 py-2 rounded-lg flex items-center justify-between text-left hover:bg-surface-canvas transition-colors">
                <div className="min-w-0">
                  <div className="text-label-md font-semibold text-text-primary">{b.label}</div>
                  <div className="text-label-sm text-text-secondary">{b.sublabel}</div>
                </div>
                <span className={cn('text-label-md font-semibold tnum', b.tone === 'primary' ? 'text-primary' : b.tone === 'ai' ? 'text-ai-accent' : 'text-text-secondary')}>{b.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title={
          <span className="flex items-center gap-1.5">
            <Icon name="auto_awesome" className="text-ai-accent text-[1.125rem]" />
            {t('AI tips')}
          </span>
        }
        info={t('Written by AI from sample data ({confidence}% confidence). Check before you act on it.', { confidence: summary.strategicIntelConfidence })}
        footer={
          <Link to="/ai-insights/ins-eligibility-response-delay" className="text-label-md text-ai-accent font-semibold hover:underline">
            {t('See the action plan')} →
          </Link>
        }
      >
        <ul className="space-y-3 text-body-sm">
          {summary.strategicIntel.map((item) => {
            const [before, after] = item.text.split('{e}');
            return (
              <li key={item.label}>
                <span className={cn('text-label-sm font-semibold', intelTone[item.tone])}>{item.label}</span>
                <p className="text-text-primary text-label-md mt-0.5">
                  {before}
                  <strong>{item.emphasis}</strong>
                  {after}
                </p>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
