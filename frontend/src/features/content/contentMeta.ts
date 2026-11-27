import { msg, type Translate } from '@/i18n/I18nContext';
import type { ContentItem, ContentType } from '@/types/domain';

/** Display metadata per content format. `label` / `plural` are English keys: render them with t(). */
export const contentTypeMeta: Record<ContentType, { label: string; plural: string; icon: string; badge: string }> = {
  reel: { label: msg('Reel'), plural: msg('Reels'), icon: 'movie', badge: 'bg-purple-900/40 text-purple-300 border-purple-800' },
  post: { label: msg('Post'), plural: msg('Posts'), icon: 'image', badge: 'bg-emerald-900/40 text-emerald-300 border-emerald-800' },
  carousel: { label: msg('Carousel'), plural: msg('Carousels'), icon: 'photo_library', badge: 'bg-sky-900/40 text-sky-300 border-sky-800' },
  story: { label: msg('Story'), plural: msg('Stories'), icon: 'amp_stories', badge: 'bg-rose-900/40 text-rose-300 border-rose-800' },
};

export const contentTypeOrder: ContentType[] = ['reel', 'post', 'carousel', 'story'];

/** Video formats have watch time / retention; images and carousels do not. */
export const isVideo = (item: Pick<ContentItem, 'type'>) => item.type === 'reel' || item.type === 'story';

/** 18 -> "0:18", 75 -> "1:15". */
export function formatDuration(sec: number | undefined): string {
  if (sec === undefined) return '—';
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** Small overlay label on thumbnails: duration for video, slide count for carousels. */
export function thumbnailLabel(item: ContentItem, t: Translate): string {
  if (item.type === 'carousel') return t('{count} slides', { count: item.slides ?? 0 });
  if (item.type === 'post') return t('Image');
  return formatDuration(item.durationSec);
}

/** Percentage helper that tolerates zero denominators. */
export const ratio = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

/** Long caption -> first ~60 chars with an ellipsis (table excerpt). */
export function captionExcerpt(caption: string, max = 60): string {
  return caption.length > max ? `${caption.slice(0, max).trimEnd()}...` : caption;
}
