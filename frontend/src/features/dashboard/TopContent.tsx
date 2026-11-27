import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback } from '@/components/ui/Misc';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { formatCompact, formatNumber, formatPercent } from '@/lib/format';
import { contentService } from '@/services/content';
import type { ContentItem } from '@/types/domain';
import { ContentQuickViewDrawer } from './ContentQuickViewDrawer';
import { contentMediaLabel, contentTypeIcon, topContentByViews } from './selectors';

/** Top Performing Content: the three highest-viewed items; a card opens the quick-view drawer. */
export function TopContent() {
  const t = useT();
  const content = useQuery('content:list', contentService.list);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const top = useMemo(() => (content.data ? topContentByViews(content.data) : []), [content.data]);
  const selected = top.find((c) => c.id === selectedId) ?? null;

  return (
    <section className="lg:col-span-2 bg-surface-card border border-border-strong rounded-xl shadow-card p-5 min-w-0" aria-labelledby="dash-content-title">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 id="dash-content-title" className="font-heading text-[1.0625rem] font-semibold text-text-primary">
            {t('Best posts')}
          </h3>
          <p className="text-body-sm text-text-secondary">{t('Your most viewed posts this month')}</p>
        </div>
        <Link to="/content" className="text-label-md text-text-primary hover:text-primary-container font-semibold shrink-0">
          {t('See all')} →
        </Link>
      </div>
      <QueryState
        query={content}
        loading={
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        }
        empty={<p className="text-body-sm text-text-secondary py-8 text-center border border-dashed border-border-strong rounded-lg">{t('No posts in this period.')}</p>}
      >
        {() => (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {top.map((item) => (
              <ContentCard key={item.id} item={item} onOpen={() => setSelectedId(item.id)} />
            ))}
          </div>
        )}
      </QueryState>
      <ContentQuickViewDrawer item={selected} onClose={() => setSelectedId(null)} />
    </section>
  );
}

function ContentCard({ item, onOpen }: { item: ContentItem; onOpen: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left bg-surface-canvas border border-border-strong rounded-xl p-3 cursor-pointer hover:border-primary-container hover:-translate-y-0.5 transition-all group focus-visible:outline-2 focus-visible:outline-gold"
      aria-label={`${t('Open')}: ${item.title}`}
    >
      <div className="relative h-36 rounded-lg bg-slate-800 overflow-hidden mb-2.5 flex items-center justify-center">
        <ImageWithFallback src={item.thumbnailUrl} alt={item.thumbnailAlt} className="w-full h-full" />
        <span className="absolute top-2 left-2 bg-navy/70 text-white text-[0.625rem] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
          <Icon name={contentTypeIcon(item.type)} className="text-[0.75rem]" /> {contentMediaLabel(item, t)}
        </span>
        <span className="absolute bottom-2 right-2 bg-primary-container text-on-primary-container text-[0.625rem] font-bold px-1.5 py-0.5 rounded tnum">
          {t('{count} leads', { count: formatNumber(item.metrics.leads) })}
        </span>
      </div>
      <h4 className="font-semibold text-sm text-text-primary line-clamp-1 group-hover:text-primary-container">{item.title}</h4>
      <div className="flex items-center gap-3 text-[0.75rem] text-text-secondary mt-1">
        <span className="tnum flex items-center gap-1" title={t('Views')}>
          <Icon name="visibility" className="text-[0.875rem]" />
          {formatCompact(item.metrics.views)}
        </span>
        <span className="tnum flex items-center gap-1 text-status-active font-semibold" title={t('Engagement')}>
          <Icon name="favorite" className="text-[0.875rem]" />
          {formatPercent(item.metrics.engagementRate, 1)}
        </span>
      </div>
    </button>
  );
}
