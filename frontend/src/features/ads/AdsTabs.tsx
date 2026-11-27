import { NavLink } from 'react-router-dom';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { Icon } from '@/components/ui/Icon';

/** The Ads module's pages. The sidebar has a single "Ads" tile; these tabs move between the pages. */
export const ADS_TABS = [
  { to: '/ads', label: msg('Dashboard'), icon: 'space_dashboard', end: true },
  { to: '/ads/leads', label: msg('Ad leads'), icon: 'contact_page' },
  { to: '/ads/performance', label: msg('Performance'), icon: 'monitoring' },
  { to: '/ads/experiments', label: msg('Experiments'), icon: 'science' },
  { to: '/ads/signups', label: msg('Website signups'), icon: 'how_to_reg' },
  { to: '/ads/overview', label: msg('Overview'), icon: 'compare_arrows' },
  { to: '/ads/studio', label: msg('Ad Studio'), icon: 'brush' },
] as const;

/** Underline tabs (links) shown at the top of every Ads page. */
export function AdsTabs({ className }: { className?: string }) {
  const t = useT();
  return (
    <nav aria-label={t('Ads pages')} className={cn('flex items-center gap-1 border-b border-border-strong overflow-x-auto no-scrollbar', className)}>
      {ADS_TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={'end' in tab ? tab.end : false}
          className={({ isActive }) =>
            cn(
              'px-3 py-2.5 text-label-md whitespace-nowrap border-b-2 -mb-px flex items-center gap-1.5 transition-colors',
              isActive ? 'border-primary-container text-text-primary font-semibold' : 'border-transparent text-text-secondary hover:text-text-primary font-medium',
            )
          }
        >
          <Icon name={tab.icon} className="text-[1rem]" />
          {t(tab.label)}
        </NavLink>
      ))}
    </nav>
  );
}
