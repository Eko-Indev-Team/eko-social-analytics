import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/format';

/** Brand card: rounded border, surface background, the brand card shadow (callers add the padding). */
export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-xl border border-slate-800 bg-slate-900 shadow-card', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  iconClassName,
  actions,
  className,
  titleAddon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  iconClassName?: string;
  actions?: ReactNode;
  className?: string;
  titleAddon?: ReactNode;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {icon && <span className={cn('flex items-center', iconClassName)}>{icon}</span>}
          <h3 className="font-heading text-[1.0625rem] leading-6 font-semibold text-text-primary">{title}</h3>
          {titleAddon}
        </div>
        {subtitle && <p className="text-body-sm text-text-secondary mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
