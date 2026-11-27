import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';

/** Card shell for the analytics sections: short title, optional one-line subtitle, optional right-side content. */
export function SectionCard({
  title,
  subtitle,
  addon,
  right,
  className,
  children,
  as: Tag = 'div',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  addon?: ReactNode;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
  as?: 'div' | 'section';
}) {
  return (
    <Tag className={cn('bg-surface-card rounded-xl border border-border-strong p-5 shadow-card min-w-0', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{title}</h2>
            {addon}
          </div>
          {subtitle && <div className="text-body-sm text-text-secondary">{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </Tag>
  );
}

/** Placeholder for sections that only a few sample posts have. `title` and `reason` must already be translated. */
export function UnavailableSection({ title, className, reason }: { title: string; className?: string; reason?: ReactNode }) {
  const t = useT();
  return (
    <SectionCard title={title} className={className}>
      <div className="flex items-start gap-2.5 text-body-sm text-text-secondary">
        <Icon name="science" className="text-[1.125rem] text-text-tertiary mt-px" />
        <p>{reason ?? t('Only a few sample posts have this detail. The totals for this post are in the numbers above.')}</p>
      </div>
    </SectionCard>
  );
}
