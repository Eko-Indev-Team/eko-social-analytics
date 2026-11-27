import { Fragment } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback } from '@/components/ui/Misc';
import { useToast } from '@/components/ui/Toast';
import { useT } from '@/i18n/I18nContext';
import { formatDate } from '@/lib/format';
import { formatDuration, isVideo } from '../contentMeta';
import { rankOf, type AnalyticsPageData } from './model';

/** Caption with hashtags highlighted. */
function Caption({ text }: { text: string }) {
  return (
    <>
      {text.split(/(#\w+)/g).map((part, i) =>
        part.startsWith('#') ? (
          <span key={i} className="text-primary font-medium">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** Left panel: media preview, caption and the post's rank by views. */
export function ReelPreviewCard({ data }: { data: AnalyticsPageData }) {
  const t = useT();
  const { item, analytics, account, allContent } = data;
  const toast = useToast();
  const video = isVideo(item);
  const image = analytics?.previewImage ?? (item.thumbnailUrl ? { url: item.thumbnailUrl, alt: item.thumbnailAlt } : undefined);
  const rank = rankOf(item, allContent, 'views');

  return (
    <div className="col-span-12 lg:col-span-4 bg-surface-card rounded-xl border border-border-strong p-4 flex flex-col gap-4 shadow-card">
      <div className="relative w-full max-w-sm mx-auto lg:max-w-none aspect-[9/14] rounded-xl overflow-hidden bg-slate-900 group">
        <ImageWithFallback
          src={image?.url}
          alt={image?.alt ?? item.thumbnailAlt}
          className="w-full h-full transition-transform duration-300 group-hover:scale-105"
          fallbackIcon={video ? 'movie' : 'image'}
        />
        <div className="absolute inset-0 bg-navy/30 pointer-events-none" />
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
          <span className="bg-navy/60 backdrop-blur-sm text-white px-2 py-0.5 rounded-full text-label-sm flex items-center gap-1">
            {video ? (
              <>
                <Icon name="play_arrow" filled className="text-[0.75rem] text-primary-container" />
                {formatDuration(item.durationSec)}
              </>
            ) : item.type === 'carousel' ? (
              <>
                <Icon name="photo_library" className="text-[0.75rem]" />
                {t('{count} slides', { count: item.slides ?? 0 })}
              </>
            ) : (
              <>
                <Icon name="image" className="text-[0.75rem]" />
                {t('Photo')}
              </>
            )}
          </span>
          {analytics?.resolution && (
            <span className="bg-navy/60 backdrop-blur-sm text-white px-2 py-0.5 rounded-full text-label-sm">{analytics.resolution.split('×')[0]}p</span>
          )}
        </div>
        {video && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              aria-label={t('Play preview')}
              onClick={() => toast({ tone: 'demo', title: t('Video not available'), description: t('Sample posts have pictures only, no video.') })}
              className="w-12 h-12 rounded-full bg-surface-card/90 text-text-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"
            >
              <Icon name="play_arrow" filled className="text-2xl ml-0.5 text-text-primary" />
            </button>
          </div>
        )}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white pointer-events-none">
          {analytics?.audioLabel && (
            <div className="flex items-center gap-1.5 text-label-sm mb-1 text-slate-200">
              <Icon name="music_note" className="text-[0.75rem]" />
              <span className="truncate">{analytics.audioLabel}</span>
            </div>
          )}
          <div className="text-xs text-white/90 font-medium">
            @{account?.handle ?? 'ekoindia'} · {formatDate(item.publishedAt, { year: false })}
          </div>
        </div>
      </div>
      <div>
        <div className="text-label-sm font-semibold text-text-secondary mb-1">{t('Caption')}</div>
        <p className="text-body-sm text-text-primary leading-relaxed bg-surface-canvas p-3 rounded-xl">
          <Caption text={item.caption} />
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-label-sm text-status-active font-semibold">
        <Icon name="trending_up" className="text-[0.875rem]" />
        {t('#{rank} of {total} posts by views', { rank, total: allContent.length })}
      </div>
    </div>
  );
}
