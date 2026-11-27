import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { invalidateQueries, useQuery } from '@/hooks/useQuery';
import { interpolate, msg, useT, type Translate } from '@/i18n/I18nContext';
import { ApiError } from '@/lib/api/client';
import { instagramService } from '@/services/instagram';
import type { SyncJob } from '@/types/instagram';

/** Poll every 3 s while a job is queued/running; while it waits for a retry, check again shortly after it is due. */
export const POLL_ACTIVE_MS = 3000;
const POLL_MAX_MS = 60_000;

export function pollDelay(job: SyncJob, now = Date.now()): number {
  if (job.status === 'retrying' && job.nextRetryAt) {
    const due = new Date(job.nextRetryAt).getTime() - now;
    return Math.min(POLL_MAX_MS, Math.max(POLL_ACTIVE_MS, due + 2000));
  }
  return POLL_ACTIVE_MS;
}

const english: Translate = (text, vars) => interpolate(text, vars);

const STAGES: Record<string, string> = {
  token: msg('Checking the login'),
  media: msg('Getting posts'),
  media_insights: msg('Getting post numbers'),
  account_insights: msg('Getting account numbers'),
  comments: msg('Getting comments'),
  finishing: msg('Saving'),
  done: msg('Done'),
};

export function stageLabel(job: SyncJob, t: Translate = english): string {
  if (job.status === 'queued') return t('Queued — waiting for a worker');
  if (job.status === 'retrying')
    return job.nextRetryAt
      ? t('Trying again ({count}/{max}) at {time}', { count: job.retryCount, max: job.maxRetries, time: new Date(job.nextRetryAt).toLocaleTimeString() })
      : t('Trying again ({count}/{max})', { count: job.retryCount, max: job.maxRetries });
  const stage = STAGES[job.progressStage ?? ''];
  return stage ? t(stage) : t('Syncing');
}

export function describeJob(job: SyncJob, t: Translate = english): { tone: 'success' | 'error' | 'warning' | 'info'; title: string; description: string } {
  const counts = t('Saved: {media} posts, {mediaMetrics} post numbers, {accountMetrics} account numbers, {comments} comments.', {
    media: job.mediaFetched,
    mediaMetrics: job.mediaInsightsFetched,
    accountMetrics: job.accountInsightsFetched,
    comments: job.commentsFetched,
  });
  switch (job.status) {
    case 'succeeded':
      return { tone: 'success', title: t('Sync complete'), description: counts };
    case 'partially_succeeded':
      return { tone: 'warning', title: t('Sync finished with gaps'), description: `${counts} ${t('Instagram did not return some data.')}` };
    case 'cancelled':
      return { tone: 'info', title: t('Sync cancelled'), description: job.errorMessage ?? t('The sync was cancelled.') };
    case 'retrying':
      return { tone: 'warning', title: job.errorCategory === 'rate_limited' ? t('Instagram is busy, trying again later') : t('Small problem, trying again'), description: job.errorMessage ?? '' };
    default: {
      const auth = ['token_invalid', 'token_expired', 'token_missing', 'token_unreadable', 'permission_denied', 'reauth_required'].includes(job.errorCategory ?? '');
      return {
        tone: 'error',
        title: auth ? t('Reauthorization needed') : job.errorCategory === 'rate_limited' ? t('Instagram is busy') : t('Sync failed'),
        description: job.errorMessage ?? t('The sync did not finish.'),
      };
    }
  }
}

/**
 * Sync state of one live account: GET …/sync-status plus polling of the current job until it is terminal.
 * Polling stops when the component unmounts or the job finishes; affected queries are then refreshed.
 */
export function useSyncState(accountId: string, opts: { notify?: boolean } = {}) {
  const t = useT();
  const toast = useToast();
  const status = useQuery(`instagram:sync-status:${accountId}`, () => instagramService.syncStatus(accountId), { isEmpty: () => false });
  const [job, setJob] = useState<SyncJob | null>(null);
  const [starting, setStarting] = useState(false);
  const notify = opts.notify ?? true;
  // A job we already saw finish may still be listed as current by a not-yet-refreshed status response.
  const finishedLocally = job?.terminal && status.data?.currentJob?.id === job.id;
  const active = job && !job.terminal ? job : finishedLocally ? null : status.data?.currentJob ?? null;
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!active || active.terminal) return undefined;
    let cancelled = false;
    timer.current = setTimeout(async () => {
      try {
        const next = await instagramService.job(active.id);
        if (cancelled) return;
        setJob(next);
        if (next.terminal) {
          if (notify) toast(describeJob(next, t));
          invalidateQueries('instagram');
          invalidateQueries('dashboard');
        }
      } catch (err) {
        if (!cancelled && err instanceof ApiError && err.status === 404) setJob(null);
      }
    }, pollDelay(active));
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
  }, [active, notify, toast, t]);

  const start = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    try {
      const { job: queued, deduplicated } = await instagramService.sync(accountId);
      setJob(queued);
      if (notify) toast({ tone: 'info', title: deduplicated ? t('A sync is already running') : t('Sync queued'), description: t('It runs in the background. This page updates when it is done.') });
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      const title = e instanceof ApiError && e.status === 429 ? t('Please wait') : e instanceof ApiError && e.status === 503 ? t('Background sync not available')
        : e instanceof ApiError && e.status === 409 ? t('Not possible right now') : e instanceof ApiError && e.status === 403 ? t('Not allowed') : t('Could not start the sync');
      toast({ tone: 'error', title, description: e.message });
    } finally {
      setStarting(false);
    }
  }, [accountId, notify, starting, toast, t]);

  const cancel = useCallback(async () => {
    if (!active) return;
    try {
      setJob(await instagramService.cancelJob(active.id));
    } catch (err) {
      toast({ tone: 'error', title: t('Could not cancel'), description: err instanceof Error ? err.message : String(err) });
    }
  }, [active, toast, t]);

  return { status, active, lastJob: job?.terminal ? job : status.data?.lastJob ?? null, start, starting, cancel };
}
