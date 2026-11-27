import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { useT } from '@/i18n/I18nContext';

/** Loading placeholders: filter bar, 4 number tiles, two cards, list + detail. */
export function CommentsSkeleton() {
  const t = useT();
  return (
    <div className="space-y-4 mt-4" role="status" aria-label={t('Loading comments')}>
      <Skeleton className="h-24" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Skeleton className="lg:col-span-5 h-80" />
        <Skeleton className="lg:col-span-7 h-80" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Skeleton className="xl:col-span-8 h-[420px]" />
        <Skeleton className="xl:col-span-4 h-[420px]" />
      </div>
      <span className="sr-only">{t('Loading…')}</span>
    </div>
  );
}

/** Error banner with a retry button. */
export function CommentsErrorBanner({ error, onRetry }: { error: Error | undefined; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="my-4 p-4 rounded-xl bg-error-container/20 border border-error text-text-primary flex flex-col sm:flex-row sm:items-center justify-between gap-3" role="alert">
      <div className="flex items-center gap-3">
        <Icon name="error_outline" className="text-error text-[1.375rem]" />
        <div>
          <h4 className="font-semibold text-body-md text-error">{t('Could not load comments')}</h4>
          <p className="text-body-sm text-text-secondary">{error?.message ?? t('Please try again.')}</p>
        </div>
      </div>
      <Button icon="refresh" onClick={onRetry}>
        {t('Try again')}
      </Button>
    </div>
  );
}

export function CommentsEmpty({ onReset }: { onReset: () => void }) {
  const t = useT();
  return (
    <EmptyState
      className="mt-4"
      icon="forum"
      title={t('No comments found')}
      description={t('Try clearing the filters, or connect an account that can read comments.')}
      action={
        <button type="button" onClick={onReset} className="text-primary hover:underline font-semibold text-label-md">
          {t('Reset filters')}
        </button>
      }
    />
  );
}

/** Small media-query hook (used to swap the inline detail panel for a Drawer below xl). */
export function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : true);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
