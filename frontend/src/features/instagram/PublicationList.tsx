import { useEffect } from 'react';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback } from '@/components/ui/Misc';
import { ErrorState, QueryState, Skeleton } from '@/components/ui/States';
import { apiAssetUrl } from '@/features/ads-reports/reportFormat';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { instagramPublishingService } from '@/services/instagramPublishing';
import type { Publication, PublicationStatus } from '@/types/instagramPublishing';
import { KIND_LABEL } from './PublishComposer';

const STATUS: Record<PublicationStatus, { label: string; tone: Tone }> = {
  scheduled: { label: msg('Scheduled'), tone: 'scheduled' },
  queued: { label: msg('Queued'), tone: 'paused' },
  publishing: { label: msg('Publishing'), tone: 'ai' },
  published: { label: msg('Published'), tone: 'active' },
  failed: { label: msg('Failed'), tone: 'error' },
  cancelled: { label: msg('Cancelled'), tone: 'draft' },
};

export const POLL_MS = 10_000;

const dateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');

/** True while a post is being published, or is scheduled to go out within the next minute. */
export function needsPolling(list: Publication[] | undefined, now = Date.now()): boolean {
  return !!list?.some((p) => p.status === 'queued' || p.status === 'publishing' || (p.status === 'scheduled' && !!p.scheduledAt && new Date(p.scheduledAt).getTime() - now < 60_000));
}

function Thumbs({ p }: { p: Publication }) {
  const t = useT();
  return (
    <div className="flex gap-1 shrink-0">
      {p.items.slice(0, 4).map((item, i) => {
        const src = item.type === 'image' ? apiAssetUrl(item.previewUrl) ?? item.url : null;
        return (
          <div key={i} className="w-12 h-12 rounded-md bg-slate-950 overflow-hidden flex items-center justify-center">
            {src ? <ImageWithFallback src={src} alt={t('Picture {n}', { n: i + 1 })} className="w-full h-full object-cover" /> : <Icon name={item.type === 'video' ? 'movie' : 'image'} className="text-text-tertiary" />}
          </div>
        );
      })}
      {p.items.length > 4 && <span className="self-center text-[0.75rem] text-text-tertiary">+{p.items.length - 4}</span>}
    </div>
  );
}

function Row({ p, usernames }: { p: Publication; usernames: Record<string, string> }) {
  const t = useT();
  const cancel = useMutation(instagramPublishingService.cancel, { invalidate: ['ig:publish:list'] });
  const s = STATUS[p.status] ?? STATUS.queued;
  const username = p.accountUsername ?? usernames[p.accountId];
  const caption = p.caption ? (p.caption.length > 120 ? `${p.caption.slice(0, 120)}…` : p.caption) : null;
  return (
    <li className="py-3 flex flex-col sm:flex-row gap-3 border-b border-border-subtle last:border-b-0" aria-label={t('{kind} post {id}', { kind: t(KIND_LABEL[p.kind]), id: p.id })}>
      <Thumbs p={p} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={s.tone} dot>
            {t(s.label)}
          </Badge>
          <span className="text-label-md font-semibold text-text-primary">{t(KIND_LABEL[p.kind])}</span>
          {username && <span className="text-body-sm text-text-secondary">@{username}</span>}
        </div>
        {caption && <p className="text-body-sm text-text-secondary break-words">{caption}</p>}
        <p className="text-[0.75rem] text-text-tertiary">
          {p.status === 'published' && p.publishedAt
            ? t('Published {time}', { time: dateTime(p.publishedAt) })
            : p.scheduledAt
              ? t('Scheduled for {time}', { time: dateTime(p.scheduledAt) })
              : t('Created {time}', { time: dateTime(p.createdAt) })}
          {p.createdByName && ` · ${p.createdByName}`}
        </p>
        {p.status === 'failed' && p.errorMessage && <p className="text-[0.75rem] text-error">{p.errorMessage}</p>}
      </div>
      <div className="flex sm:flex-col items-start sm:items-end gap-2 shrink-0">
        {p.permalink && (
          <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="text-[0.75rem] text-ai-accent font-semibold hover:underline inline-flex items-center gap-1">
            {t('View on Instagram')}
            <Icon name="open_in_new" className="text-[0.875rem]" />
          </a>
        )}
        {p.canCancel && (
          <Button size="xs" variant="ghost" icon="cancel" loading={cancel.isPending} onClick={() => void cancel.mutate(p.id)}>
            {t('Cancel post')}
          </Button>
        )}
      </div>
    </li>
  );
}

/** Recent posts, newest first. Refreshes every 10 s while a post is on its way. */
export function PublicationList({ usernames }: { usernames: Record<string, string> }) {
  const t = useT();
  const q = useQuery('ig:publish:list', () => instagramPublishingService.publications());
  const poll = needsPolling(q.data);
  const { refetch } = q;
  useEffect(() => {
    if (!poll) return;
    const id = setInterval(refetch, POLL_MS);
    return () => clearInterval(id);
  }, [poll, refetch]);

  return (
    <Card className="p-5 space-y-2">
      <CardHeader title={t('Recent posts')} subtitle={poll ? t('Updating every 10 seconds…') : undefined} />
      <QueryState
        query={q}
        loading={<Skeleton className="h-24" />}
        error={(err, retry) => <ErrorState title={t('Could not load posts')} error={err} onRetry={retry} />}
        empty={<p className="text-body-sm text-text-tertiary py-6 text-center">{t('No posts yet.')}</p>}
      >
        {(list) => (
          <ul>
            {list.map((p) => (
              <Row key={p.id} p={p} usernames={usernames} />
            ))}
          </ul>
        )}
      </QueryState>
    </Card>
  );
}
