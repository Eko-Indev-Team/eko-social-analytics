import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useT } from '@/i18n/I18nContext';

export function AudienceSkeleton() {
  const t = useT();
  return (
    <div className="flex flex-col gap-6" role="status" aria-label={t('Loading audience data')}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

export function AudienceEmpty({ onReset }: { onReset: () => void }) {
  const t = useT();
  return (
    <div className="p-16 flex flex-col items-center justify-center text-center bg-surface-card border border-dashed border-border-strong rounded-xl">
      <div className="w-14 h-14 rounded-full bg-surface-canvas flex items-center justify-center mb-4 text-text-tertiary">
        <Icon name="group_off" className="text-[1.75rem]" />
      </div>
      <h3 className="font-heading text-[1.125rem] font-semibold text-text-primary">{t('No audience data yet')}</h3>
      <p className="text-body-md text-text-secondary max-w-md mt-1 mb-6">{t('Nothing for these filters. Try all campaigns.')}</p>
      <Button variant="primary" onClick={onReset}>
        {t('Reset filters')}
      </Button>
    </div>
  );
}

export function AudienceError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const t = useT();
  const toast = useToast();
  return (
    <div className="p-16 flex flex-col items-center justify-center text-center bg-surface-card border border-border-strong rounded-xl" role="alert">
      <div className="w-14 h-14 rounded-full bg-error-container text-error flex items-center justify-center mb-4">
        <Icon name="error_outline" className="text-[1.75rem]" />
      </div>
      <h3 className="font-heading text-[1.125rem] font-semibold text-text-primary">{t('Could not load your audience')}</h3>
      <p className="text-body-md text-text-secondary max-w-md mt-1 mb-6">{message ?? t('Please try again.')}</p>
      <div className="flex items-center gap-3">
        <Button variant="primary" icon="refresh" onClick={onRetry}>
          {t('Try again')}
        </Button>
        <Button onClick={() => toast({ tone: 'demo', title: t('No saved copy'), description: t('This preview does not keep an offline copy of audience data.') })}>
          {t('Saved copy')}
        </Button>
      </div>
    </div>
  );
}
