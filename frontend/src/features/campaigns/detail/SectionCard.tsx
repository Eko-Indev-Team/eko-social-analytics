import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/format';

/** Campaign Detail card: icon circle + title (+ optional subtitle / addon) and an optional "See all" link. Pass translated text. */
export function SectionCard({
  icon,
  iconClassName,
  title,
  subtitle,
  addon,
  link,
  className,
  children,
}: {
  icon: string;
  iconClassName?: string;
  title: string;
  subtitle?: string;
  addon?: ReactNode;
  link?: { to: string; label: string };
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('bg-surface-card border border-border-strong rounded-xl shadow-card p-5 min-w-0', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-status-completed-subtle text-status-completed', iconClassName)}>
            <Icon name={icon} className="text-[1.125rem]" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{title}</h2>
              {addon}
            </div>
            {subtitle && <p className="text-body-sm text-text-secondary">{subtitle}</p>}
          </div>
        </div>
        {link && (
          <Link to={link.to} className="text-label-md text-text-primary hover:text-primary-container font-semibold flex items-center gap-1 shrink-0">
            {link.label}
            <Icon name="arrow_forward" className="text-[1rem]" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Short "nothing to show" line used inside sections. Pass translated text. */
export function UnavailableNote({ icon = 'info', children, className, flush }: { icon?: string; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <div className={cn(!flush && 'mt-4', 'flex items-start gap-2.5 p-3 rounded-lg bg-surface-canvas text-body-sm text-text-secondary', className)}>
      <Icon name={icon} className="text-[1.125rem] text-text-tertiary mt-px" />
      <div>{children}</div>
    </div>
  );
}
