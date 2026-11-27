import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/Misc';
import { Skeleton } from '@/components/ui/States';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';

/** Skeleton shimmer mirroring the overview layout (4 tiles, synthesis, filter bar, 2x2 cards, table). */
export function InsightsSkeleton() {
  const t = useT();
  return (
    <div className="space-y-6" role="status" aria-label={t('Loading…')}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-10" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-72 rounded-xl" />
        ))}
      </div>
      <span className="sr-only">{t('Loading…')}</span>
    </div>
  );
}

export function InsightsEmpty({ onRun }: { onRun: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-surface-card border border-dashed border-border-strong rounded-xl">
      <div className="w-12 h-12 rounded-full bg-ai-subtle border border-ai-border flex items-center justify-center mb-3">
        <Icon name="auto_awesome" className="text-[1.625rem] text-ai-accent" />
      </div>
      <h3 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('No insights yet')}</h3>
      <p className="text-body-sm text-text-secondary mt-1 max-w-md">{t('AI needs at least 7 days of campaign data.')}</p>
      <Button variant="ai" className="mt-4" icon="auto_awesome" onClick={onRun}>
        {t('Generate insights')}
      </Button>
    </div>
  );
}

export function InsightsError({ error, onRetry }: { error: Error | undefined; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="bg-error-container/50 border border-error/20 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3" role="alert">
      <Icon name="cloud_off" className="text-error text-[1.5rem]" />
      <div className="flex-1">
        <h4 className="font-bold text-text-primary text-body-md">{t('Could not load insights')}</h4>
        <p className="text-body-sm text-text-secondary mt-0.5">{error?.message ?? t('The service could not be reached.')}</p>
      </div>
      <Button size="sm" icon="refresh" onClick={onRetry}>
        {t('Try again')}
      </Button>
    </div>
  );
}

const steps = [msg('Reading campaigns and posts (sample data)'), msg('Sorting comments'), msg('Scoring posts and audience'), msg('Writing suggestions')];

/**
 * "Processing Analysis" state from the export's state controller. Simulated, deterministic progress
 * (no model is called); calls `onComplete` once progress reaches 100%.
 */
export function ProcessingAnalysis({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const t = useT();
  const [progress, setProgress] = useState(0);
  const done = useRef(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    const id = window.setInterval(() => setProgress((p) => Math.min(100, p + 4)), 200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (progress >= 100 && !done.current) {
      done.current = true;
      completeRef.current();
    }
  }, [progress]);

  const activeStep = Math.min(steps.length - 1, Math.floor(progress / (100 / steps.length)));

  return (
    <section className="bg-surface-card border border-ai-border rounded-xl p-6 md:p-8 relative overflow-hidden isolate" role="status" aria-live="polite">
      <div className="absolute -top-10 -right-10 w-48 h-48 bg-ai-subtle rounded-full blur-2xl -z-10" />
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-full bg-ai-subtle border border-ai-border flex items-center justify-center shrink-0">
          <Icon name="progress_activity" className="text-[1.5rem] text-ai-accent animate-spin" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('Generating insights')}</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold bg-surface-card-subtle text-text-secondary">{t('Practice run')}</span>
          </div>
          <p className="text-body-sm text-text-secondary mt-0.5">{t('Sample data only. No AI is called and nothing is changed.')}</p>
          <div className="mt-4 flex items-center gap-3">
            <ProgressBar value={progress} className="h-2" barClassName="bg-ai-accent" label={t('Progress')} />
            <span className="text-label-md font-semibold text-text-primary tnum w-10 text-right">{progress}%</span>
          </div>
          <ol className="mt-4 space-y-2">
            {steps.map((s, i) => {
              const state = i < activeStep || progress >= 100 ? 'done' : i === activeStep ? 'active' : 'todo';
              return (
                <li key={s} className={cn('flex items-center gap-2 text-body-sm', state === 'todo' ? 'text-text-tertiary' : 'text-text-primary')}>
                  <Icon
                    name={state === 'done' ? 'check_circle' : state === 'active' ? 'pending' : 'radio_button_unchecked'}
                    filled={state === 'done'}
                    className={cn('text-[1rem]', state === 'done' ? 'text-status-active' : state === 'active' ? 'text-ai-accent' : 'text-text-tertiary')}
                  />
                  {t(s)}
                </li>
              );
            })}
          </ol>
          <Button size="xs" variant="ghost" className="mt-4" onClick={onCancel}>
            {t('Cancel')}
          </Button>
        </div>
      </div>
    </section>
  );
}
