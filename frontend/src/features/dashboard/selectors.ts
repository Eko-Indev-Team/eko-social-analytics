import { interpolate, msg, type Translate } from '@/i18n/I18nContext';
import { sessionWorkspace } from '@/services/workspace';
import type { Campaign, ContentItem, ContentType } from '@/types/domain';

/** End of the demo reporting window (Oct 31, 2024) — "today" for relative date maths in the prototype. */
export const demoWindowEnd = sessionWorkspace.reportingPeriod.end;

const DAY_MS = 86_400_000;
const toUtc = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export const activeCampaigns = (campaigns: Campaign[]) => campaigns.filter((c) => c.status === 'active');

/** Active campaigns whose end date falls within `withinDays` of the demo window end. */
export function campaignsEndingSoon(campaigns: Campaign[], withinDays = 7, reference = demoWindowEnd): Campaign[] {
  return activeCampaigns(campaigns).filter((c) => {
    if (!c.endDate) return false;
    const d = daysBetween(reference, c.endDate);
    return d >= 0 && d <= withinDays;
  });
}

export function topContentByViews(items: ContentItem[], count = 3): ContentItem[] {
  return [...items].sort((a, b) => b.metrics.views - a.metrics.views).slice(0, count);
}

/** English keys: render with t(). */
const typeLabels: Record<ContentType, string> = { reel: msg('Reel'), post: msg('Post'), carousel: msg('Carousel'), story: msg('Story') };
const typeIcons: Record<ContentType, string> = { reel: 'movie', post: 'image', carousel: 'view_carousel', story: 'history_toggle_off' };

export const contentTypeLabel = (t: ContentType) => typeLabels[t];
export const contentTypeIcon = (t: ContentType) => typeIcons[t];

/** 42 -> "0:42" */
export function formatDuration(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** Badge text on a content thumbnail: duration for video, slide count for carousels, else the type. Pass `t` to translate. */
export function contentMediaLabel(item: ContentItem, t: Translate = interpolate): string {
  if (item.durationSec) return formatDuration(item.durationSec);
  if (item.slides) return t('{count} slides', { count: item.slides });
  return t(contentTypeLabel(item.type));
}
