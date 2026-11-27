import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback } from '@/components/ui/Misc';
import { Skeleton } from '@/components/ui/States';
import type { QueryResult } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { formatCompact, formatDate, formatNumber } from '@/lib/format';
import type { Campaign, ContentItem } from '@/types/domain';
import { SectionCard, UnavailableNote } from './SectionCard';

const formatLabel: Record<ContentItem['type'], string> = { reel: msg('Reel'), carousel: msg('Carousel'), post: msg('Photo'), story: msg('Story') };

const duration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

function MediaBadge({ item }: { item: ContentItem }) {
  const video = item.type === 'reel' || item.type === 'story';
  const icon = video ? 'play_arrow' : item.type === 'carousel' ? 'view_carousel' : 'image';
  const text = video ? (item.durationSec ? duration(item.durationSec) : '') : item.type === 'carousel' ? String(item.slides ?? '') : '1';
  return (
    <span className="absolute bottom-1 right-1 bg-navy/75 text-white text-[0.625rem] px-1 py-0.5 rounded flex items-center">
      <Icon name={icon} filled={video} className="text-[0.625rem] mr-0.5" />
      {text}
    </span>
  );
}

/** The campaign's posts, best first. Rows open the post page. */
export function CampaignContentList({ campaign, query }: { campaign: Campaign; query: QueryResult<ContentItem[]> }) {
  const t = useT();
  const items = [...(query.data ?? [])].sort((a, b) => b.metrics.views - a.metrics.views);
  return (
    <SectionCard
      icon="movie"
      iconClassName="bg-amber-400/15 text-amber-400"
      title={t('Posts')}
      subtitle={query.status === 'success' && items.length > 0 ? t('Best first. Total: {count}', { count: items.length }) : undefined}
      link={{ to: '/content', label: t('See all') }}
    >
      {query.status === 'loading' ? (
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-14 h-16" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : query.status === 'error' ? (
        <UnavailableNote icon="warning">
          {t('Could not load the posts.')} {query.error?.message}
        </UnavailableNote>
      ) : items.length === 0 ? (
        <UnavailableNote icon="movie">
          {campaign.metrics
            ? t('No single posts for this campaign in the sample data.')
            : campaign.hashtags.length
              ? t('No posts yet. Posts with {tags} show up here once it is live.', { tags: campaign.hashtags.join(' ') })
              : t('No posts yet. Posts with its hashtags show up here once it is live.')}
        </UnavailableNote>
      ) : (
        <div className="mt-3 divide-y divide-border-subtle">
          {items.map((item) => (
            <Link key={item.id} to={`/content/${item.id}`} className="py-3 flex items-center gap-3 group">
              <span className="relative w-14 h-16 rounded-lg bg-slate-800 overflow-hidden shrink-0">
                <ImageWithFallback src={item.thumbnailUrl} alt={item.thumbnailAlt} className="w-full h-full" />
                <MediaBadge item={item} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-body-sm text-text-primary group-hover:text-primary-container transition-colors">{item.title}</span>
                  {item.isTopPerformer && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] bg-amber-400/15 text-amber-400 font-semibold">
                      <Icon name="star" filled className="text-[0.75rem]" />
                      {t('Top post')}
                    </span>
                  )}
                </span>
                <span className="block text-[0.75rem] text-text-tertiary mt-0.5">
                  {t(formatLabel[item.type])} · {formatDate(item.publishedAt)}
                </span>
                <span className="block text-[0.75rem] text-text-secondary mt-0.5 tnum">
                  {t('Views: {count}', { count: formatCompact(item.metrics.views) })} · {t('Engagement: {rate}%', { rate: item.metrics.engagementRate })}
                </span>
              </span>
              <span className="text-right shrink-0">
                <span className="block font-heading text-[1.125rem] font-bold text-text-primary tnum">{formatNumber(item.metrics.leads)}</span>
                <span className="block text-[0.75rem] text-text-secondary">{t('Leads')}</span>
              </span>
              <Icon name="chevron_right" className="text-[1.125rem] text-text-tertiary group-hover:text-text-primary" />
            </Link>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
