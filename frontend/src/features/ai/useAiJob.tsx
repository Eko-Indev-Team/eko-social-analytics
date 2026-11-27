import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { invalidateQueries } from '@/hooks/useQuery';
import { ApiError } from '@/lib/api/client';
import { msg, useT, type Translate } from '@/i18n/I18nContext';
import { aiService } from '@/services/ai';
import type { AIJob, EnqueuedAIJob } from '@/types/ai';

const POLL_MS = 3000;
const POLL_MAX_MS = 60_000;

export function aiPollDelay(job: AIJob, now = Date.now()): number {
  if (job.status === 'retrying' && job.nextRetryAt) return Math.min(POLL_MAX_MS, Math.max(POLL_MS, new Date(job.nextRetryAt).getTime() - now + 2000));
  return POLL_MS;
}

const STAGES: Record<string, string> = {
  analytics: msg('Working out the numbers'),
  model: msg('Asking the AI'),
  verify: msg('Checking the AI against the numbers'),
  classifying: msg('Sorting comments'),
  summarising: msg('Summarising the lead'),
};

export function aiStageLabel(job: AIJob, t: Translate): string {
  if (job.status === 'queued') return t('Queued — waiting for the worker');
  if (job.status === 'retrying') {
    return job.errorCategory === 'rate_limited'
      ? t('Trying again ({count}/{max}), the AI is busy', { count: job.retryCount, max: job.maxRetries })
      : t('Trying again ({count}/{max})', { count: job.retryCount, max: job.maxRetries });
  }
  return t(STAGES[job.progressStage ?? ''] ?? msg('Working'));
}

export function describeAiError(err: unknown, t: Translate): { title: string; description: string } {
  if (err instanceof ApiError) {
    if (err.code === 'ai_disabled') return { title: t('AI is not configured'), description: err.message };
    if (err.code === 'ai_budget_exceeded') return { title: t('AI usage limit reached'), description: err.message };
    if (err.code === 'background_sync_unavailable') return { title: t('Background worker not set up'), description: err.message };
    if (err.status === 403) return { title: t('You do not have permission'), description: err.message };
    if (err.status === 422) return { title: t('Invalid request'), description: err.message };
  }
  return { title: t('AI request failed'), description: err instanceof Error ? err.message : String(err) };
}

function describeJob(job: AIJob, t: Translate): { tone: 'success' | 'warning' | 'error' | 'info'; title: string; description: string } {
  const r = job.result as Record<string, number | boolean | string | null>;
  if (job.status === 'failed') {
    const title =
      job.errorCategory === 'rate_limited' ? t('The AI is busy, try again later')
      : job.errorCategory === 'provider_auth' ? t('AI settings problem')
      : job.errorCategory === 'budget_exceeded' ? t('AI usage limit reached')
      : t('AI job failed');
    return { tone: 'error', title, description: job.errorMessage ?? t('The job did not finish.') };
  }
  if (job.status === 'cancelled') return { tone: 'info', title: t('AI job cancelled'), description: job.errorMessage ?? '' };
  if (job.kind === 'insights') {
    if (r.insufficientData) return { tone: 'info', title: t('Not enough data for insights'), description: r.note ? String(r.note) : t('Try a longer period or wait for more data.') };
    if (r.cached) return { tone: 'success', title: t('Insights are up to date'), description: t('Nothing changed since the last run, so the AI was not asked again.') };
    return {
      tone: job.status === 'partially_succeeded' ? 'warning' : 'success',
      title: t('Insights generated'),
      description: r.rejected
        ? t('{generated} new, {refreshed} refreshed, {rejected} discarded because their claims did not match the evidence.', {
            generated: Number(r.generated ?? 0),
            refreshed: Number(r.refreshed ?? 0),
            rejected: Number(r.rejected),
          })
        : t('{generated} new, {refreshed} refreshed.', { generated: Number(r.generated ?? 0), refreshed: Number(r.refreshed ?? 0) }),
    };
  }
  if (job.kind === 'comment_classification') {
    return {
      tone: job.status === 'partially_succeeded' ? 'warning' : 'success',
      title: t('Comments sorted'),
      description: r.unlabelled
        ? t('{classified} sorted, {unlabelled} without a label. Check the AI labels before you rely on them.', { classified: Number(r.classified ?? 0), unlabelled: Number(r.unlabelled) })
        : t('{classified} sorted. Check the AI labels before you rely on them.', { classified: Number(r.classified ?? 0) }),
    };
  }
  return { tone: 'success', title: t('Lead summary ready'), description: t('Check the AI suggestion before you act on it.') };
}

/** Start an AI job and poll it until terminal; affected queries are refreshed when it finishes. */
export function useAiJob(opts: { invalidate: string[] }) {
  const t = useT();
  const toast = useToast();
  const [job, setJob] = useState<AIJob | null>(null);
  const [starting, setStarting] = useState(false);
  const active = job && !job.terminal ? job : null;

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const next = await aiService.job(active.id);
        if (cancelled) return;
        setJob(next);
        if (next.terminal) {
          toast(describeJob(next, t));
          opts.invalidate.forEach(invalidateQueries);
        }
      } catch (err) {
        if (!cancelled && err instanceof ApiError && err.status === 404) setJob(null);
      }
    }, aiPollDelay(active));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, opts.invalidate, toast, t]);

  const start = useCallback(async (request: () => Promise<EnqueuedAIJob>) => {
    if (starting || active) return;
    setStarting(true);
    try {
      const { job: queued, deduplicated } = await request();
      setJob(queued);
      if (deduplicated) toast({ tone: 'info', title: t('Already running'), description: t('The same AI job is already queued or running.') });
    } catch (err) {
      toast({ tone: 'error', ...describeAiError(err, t) });
    } finally {
      setStarting(false);
    }
  }, [active, starting, toast, t]);

  return { job, active, start, starting };
}
