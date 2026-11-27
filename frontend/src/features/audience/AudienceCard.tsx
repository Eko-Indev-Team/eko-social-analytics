import type { ReactNode } from 'react';
import { InfoTip } from '@/components/ui/InfoTip';
import { cn } from '@/lib/format';

/** Standard Audience page card: short title, one subtitle line, optional (i) note and actions. Text arrives already translated. */
export function AudienceCard({
  title,
  subtitle,
  info,
  actions,
  className,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  info?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('bg-surface-card border border-border-strong rounded-xl shadow-card p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{title}</h3>
            {info && <InfoTip text={info} />}
          </div>
          {subtitle && <p className="text-body-sm text-text-secondary mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
