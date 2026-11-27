import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SegmentedControl } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { Skeleton } from '@/components/ui/States';
import type { QueryStatus } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { cn, formatCompact, formatNumber, formatPercent } from '@/lib/format';
import type { ContentItem } from '@/types/domain';
import { contentTypeMeta, ratio } from '../contentMeta';

export type RankMetric = 'views' | 'engagement' | 'leads';

const rankOptions: Array<{ value: RankMetric; label: string }> = [
  { value: 'views', label: msg('Views') },
  { value: 'engagement', label: msg('Engagement') },
  { value: 'leads', label: msg('Leads') },
];

const rankValue = (c: ContentItem, m: RankMetric) => (m === 'views' ? c.metrics.views : m === 'leads' ? c.metrics.leads : c.metrics.engagementRate);

/** Top 4 posts by the chosen number, from the content list. */
export function TopCreativesCard({
  content,
  status,
  onViewAll,
}: {
  content: ContentItem[] | undefined;
  status: QueryStatus;
  onViewAll: (metric: RankMetric) => void;
}) {
  const t = useT();
  const [metric, setMetric] = useState<RankMetric>('views');
  const ranked = content ? [...content].sort((a, b) => rankValue(b, metric) - rankValue(a, metric)).slice(0, 4) : undefined;
  const totalLeads = content?.reduce((s, c) => s + c.metrics.leads, 0) ?? 0;
  const reelLeads = content?.filter((c) => c.type === 'reel').reduce((s, c) => s + c.metrics.leads, 0) ?? 0;
  const options = rankOptions.map((o) => ({ value: o.value, label: t(o.label) }));

  return (
    <section className="lg:col-span-4 bg-surface-card border border-border-strong rounded-xl shadow-card p-5 flex flex-col min-w-0" aria-labelledby="content-top-title">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="content-top-title" className="font-heading text-[1.0625rem] font-semibold text-text-primary">
            {t('Top posts')}
          </h2>
          <p className="text-body-sm text-text-secondary">{t('Your best posts this month')}</p>
        </div>
        {content && <InfoTip text={t('Reels bring {pct}% of the leads from your posts.', { pct: Math.round(ratio(reelLeads, totalLeads)) })} />}
      </div>
      <SegmentedControl ariaLabel={t('Rank posts by')} options={options} value={metric} onChange={setMetric} size="xs" className="my-4 w-full [&>button]:flex-1 [&>button]:justify-center" />
      <div className="flex-1">
        {status === 'error' || status === 'empty' ? (
          <p className="py-8 text-center text-body-sm text-text-secondary">{status === 'error' ? t('Could not load your posts.') : t('No posts in this period.')}</p>
        ) : !ranked ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (
          <ol className="flex flex-col gap-1">
            {ranked.map((c, i) => {
              const meta = contentTypeMeta[c.type];
              return (
                <li key={c.id}>
                  <Link to={`/content/${c.id}`} className="py-2 px-2 -mx-2 flex items-center justify-between gap-3 hover:bg-surface-canvas rounded-lg transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={cn(
                          'w-6 h-6 rounded-full font-bold text-[0.75rem] flex items-center justify-center shrink-0',
                          i === 0 ? 'bg-primary-container text-on-primary-container' : 'bg-surface-card-subtle text-text-secondary',
                        )}
                      >
                        {i + 1}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-label-md font-semibold text-text-primary truncate">{c.title}</span>
                        <span className="text-[0.75rem] text-text-tertiary flex items-center gap-1">
                          <Icon name={meta.icon} className="text-[0.8125rem]" /> {t(meta.label)}
                        </span>
                      </div>
                    </div>
                    <span className="font-heading text-label-md font-bold text-text-primary tnum shrink-0">
                      {metric === 'engagement' ? formatPercent(c.metrics.engagementRate) : metric === 'leads' ? formatNumber(c.metrics.leads) : formatCompact(c.metrics.views)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <button
        type="button"
        onClick={() => onViewAll(metric)}
        className="mt-3 self-end text-label-md text-text-primary hover:text-primary-container font-semibold flex items-center gap-0.5"
      >
        {t('See all')} <Icon name="arrow_forward" className="text-[0.875rem]" />
      </button>
    </section>
  );
}
