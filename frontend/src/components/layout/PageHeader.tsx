import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { Icon } from '@/components/ui/Icon';

export interface Crumb {
  /** English source text, translated at render (data such as a campaign name passes through unchanged). */
  label: string;
  to?: string;
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const t = useT();
  return (
    <nav aria-label={t('Breadcrumb')} className={cn('flex items-center gap-1.5 font-label-sm text-label-sm text-text-secondary flex-wrap', className)}>
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
            {c.to && !last ? (
              <Link to={c.to} className="hover:text-text-primary hover:underline">
                {t(c.label)}
              </Link>
            ) : (
              <span className={cn(last && 'text-text-primary font-semibold')} aria-current={last ? 'page' : undefined}>
                {t(c.label)}
              </span>
            )}
            {!last && <Icon name="chevron_right" className="text-[0.875rem] text-text-tertiary" />}
          </span>
        );
      })}
    </nav>
  );
}

/** Standard page title block: optional breadcrumbs, title (+ addon badges), description, actions. */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  titleAddon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  titleAddon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col md:flex-row md:items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} className="mb-2" />}
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-heading text-[1.75rem] leading-9 font-bold text-text-primary">{title}</h1>
          {titleAddon}
        </div>
        {description && <p className="text-body-md text-text-tertiary mt-1 max-w-3xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
}
