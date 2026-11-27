import { Breadcrumbs } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { Insight } from '@/types/insights';
import { categoryMeta, PriorityPill } from './insightMeta';

/** Breadcrumbs, title with a few calm chips, "Mark as reviewed" and a More menu (print brief, dismiss / restore). */
export function InsightDetailHeader({
  insight,
  disclaimer,
  busy,
  onExport,
  onDismiss,
  onRestore,
  onToggleReviewed,
}: {
  insight: Insight;
  disclaimer: string;
  busy: boolean;
  onExport: () => void;
  onDismiss: () => void;
  onRestore: () => void;
  onToggleReviewed: () => void;
}) {
  const t = useT();
  const reviewed = insight.status === 'reviewed';
  const dismissed = insight.status === 'dismissed';
  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { label: t('AI Insights'), to: '/ai-insights' },
          { label: t(categoryMeta[insight.category].label), to: '/ai-insights' },
          { label: insight.title },
        ]}
        className="font-label-md text-label-md"
      />
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityPill priority={insight.priority} />
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold bg-ai-subtle text-ai-accent">
              <Icon name="auto_awesome" filled className="text-[0.75rem]" />
              {t('{percent}% sure', { percent: insight.confidence })}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold bg-surface-card-subtle text-text-secondary">{t(categoryMeta[insight.category].label)}</span>
            <span className="inline-flex items-center gap-1 text-body-sm text-text-tertiary">
              <Icon name="schedule" className="text-[0.875rem]" />
              {insight.generatedAt}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <h1 className="font-heading text-[1.75rem] leading-9 font-bold text-text-primary">{insight.title}</h1>
            <InfoTip text={disclaimer} className="mt-2.5" />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleReviewed}
            disabled={busy || dismissed}
            aria-pressed={reviewed}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-2 border font-label-md text-label-md font-semibold rounded-lg transition-opacity disabled:opacity-50',
              reviewed ? 'bg-status-active-solid border-status-active-solid text-white' : 'bg-status-active-subtle border-status-active text-text-primary hover:opacity-90',
            )}
          >
            <Icon name="check_circle" filled className={cn('text-[1.125rem]', reviewed ? 'text-white' : 'text-status-active')} />
            <span>{reviewed ? t('Reviewed') : t('Mark as reviewed')}</span>
          </button>
          <Dropdown
            label={t('More')}
            trigger={({ toggle, open }) => (
              <Button icon="more_horiz" onClick={toggle} aria-expanded={open} aria-label={t('More')}>
                {t('More')}
              </Button>
            )}
          >
            {(close) => (
              <>
                <MenuItem icon="print" onClick={() => (close(), onExport())}>
                  {t('Print or save as PDF')}
                </MenuItem>
                {dismissed ? (
                  <MenuItem icon="visibility" onClick={() => (close(), !busy && onRestore())}>
                    {t('Restore insight')}
                  </MenuItem>
                ) : (
                  <MenuItem icon="visibility_off" danger onClick={() => (close(), !busy && onDismiss())}>
                    {t('Dismiss insight')}
                  </MenuItem>
                )}
              </>
            )}
          </Dropdown>
        </div>
      </div>

      {dismissed && (
        <p className="flex items-center gap-2 text-body-sm text-text-secondary" role="status">
          <Icon name="visibility_off" className="text-[1rem]" />
          {t('This insight is dismissed. Restore it from the More menu.')}
        </p>
      )}
    </div>
  );
}
