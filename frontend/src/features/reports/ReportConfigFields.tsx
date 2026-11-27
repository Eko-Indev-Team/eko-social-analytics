import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { Campaign, CampaignStatus } from '@/types/domain';
import type { ReportMetricKey } from '@/types/reports';
import { metricOptions } from './reportOptions';

/** Building blocks of the "Create report" drawer. */

export function FieldLabel({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('block text-label-md text-text-primary font-semibold mb-1.5', className)}>
      {children}
    </label>
  );
}

/** `message` is English source text (msg-marked) and is translated here. */
export function FieldError({ message }: { message?: string }) {
  const t = useT();
  if (!message) return null;
  return (
    <p className="text-[0.6875rem] text-error font-medium mt-1" role="alert">
      {t(message)}
    </p>
  );
}

const statusTag: Record<CampaignStatus, { label: string; className: string }> = {
  active: { label: msg('Active'), className: 'text-status-active font-semibold' },
  completed: { label: msg('Completed'), className: 'text-status-completed font-semibold' },
  paused: { label: msg('Paused'), className: 'text-text-tertiary' },
  scheduled: { label: msg('Scheduled · no data yet'), className: 'text-text-tertiary' },
  draft: { label: msg('Draft · no data yet'), className: 'text-text-tertiary' },
};

export function CampaignPicker({
  campaigns,
  selected,
  onChange,
  error,
  disabled,
}: {
  campaigns: Campaign[];
  selected: string[];
  onChange: (ids: string[]) => void;
  error?: string;
  disabled?: boolean;
}) {
  const t = useT();
  const selectable = campaigns.filter((c) => c.metrics);
  const allSelected = selectable.every((c) => selected.includes(c.id));
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <span className="text-label-md text-text-primary font-semibold" id="campaign-selection-label">
          {t('Campaigns')}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(allSelected ? [] : selectable.map((c) => c.id))}
          className="text-label-sm text-primary font-semibold hover:underline disabled:opacity-50 disabled:no-underline"
        >
          {allSelected ? t('Clear') : t('Select all ({count})', { count: selectable.length })}
        </button>
      </div>
      {disabled && <p className="text-body-sm text-text-secondary mb-1.5">{t('This type covers your whole account.')}</p>}
      <div
        role="group"
        aria-labelledby="campaign-selection-label"
        className={cn('border rounded bg-surface-canvas p-3 space-y-2 max-h-56 overflow-y-auto custom-scrollbar', error ? 'border-error' : 'border-border-strong', disabled && 'opacity-60')}
      >
        {campaigns.map((c) => {
          const tag = statusTag[c.status];
          const noData = !c.metrics;
          return (
            <label key={c.id} className={cn('flex items-center gap-2.5 text-body-md text-text-primary', noData || disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
              <input
                type="checkbox"
                className="rounded border-slate-700 text-text-primary focus:ring-0"
                checked={selected.includes(c.id)}
                disabled={noData || disabled}
                onChange={() => toggle(c.id)}
              />
              <span className={cn('font-medium', noData && 'text-text-tertiary')}>{c.name}</span>
              <span className={cn('ml-auto text-label-sm whitespace-nowrap', tag.className)}>{t(tag.label)}</span>
            </label>
          );
        })}
      </div>
      <FieldError message={error} />
    </div>
  );
}

export function MetricChips({ value, onChange, error }: { value: ReportMetricKey[]; onChange: (v: ReportMetricKey[]) => void; error?: string }) {
  const t = useT();
  return (
    <div>
      <span className="block text-label-md text-text-primary font-semibold mb-2" id="metrics-label">
        {t('Numbers')}
      </span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="metrics-label">
        {metricOptions.map((m) => {
          const on = value.includes(m.value);
          return (
            <button
              key={m.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== m.value) : [...value, m.value])}
              className={cn(
                'px-2.5 py-1 rounded-full text-label-sm font-semibold flex items-center gap-1 transition-colors',
                on ? 'bg-primary-container text-on-primary-container' : 'bg-surface-card border border-border-strong text-text-secondary hover:border-border-focused',
              )}
            >
              {on ? t(m.label) : `+ ${t(m.label)}`}
              {on && <Icon name="check" className="text-[0.875rem]" />}
            </button>
          );
        })}
      </div>
      <FieldError message={error} />
    </div>
  );
}

export function CheckRow({ checked, onChange, children, className }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex items-center gap-1.5 cursor-pointer', className)}>
      <input type="checkbox" className="rounded border-slate-700 text-text-primary focus:ring-0" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}
