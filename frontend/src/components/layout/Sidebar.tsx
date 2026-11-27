import { NavLink } from 'react-router-dom';
import { useAppUi } from '@/app/AppUiContext';
import { useQuery } from '@/hooks/useQuery';
import { cn } from '@/lib/format';
import { commentsService } from '@/services/comments';
import { leadService } from '@/services/leads';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n/I18nContext';
import { footerNav, mainNav, type NavItem } from './navigation';

type NavCounts = { comments?: number; leads?: number };

function NavBadge({ item, counts }: { item: NavItem; counts: NavCounts }) {
  if (!item.badge) return null;
  if (item.badge.kind === 'ai')
    return <span className="ml-auto font-mono-code text-[0.5625rem] font-bold px-1.5 py-0.5 rounded-full bg-sky-950 text-sky-300">AI</span>;
  const value = counts[item.badge.key];
  if (value === undefined) return null;
  return item.badge.key === 'comments' ? (
    <span className="ml-auto font-mono-code text-[0.625rem] font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-white tnum">{value}</span>
  ) : (
    <span className="ml-auto font-mono-code text-[0.625rem] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-navy tnum">{value}</span>
  );
}

function SideLink({ item, counts, onNavigate }: { item: NavItem; counts: NavCounts; onNavigate?: () => void }) {
  const t = useT();
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          // Tile nav item: each link is its own bordered box; active = gold wash, gold border and gold text.
          'flex items-center gap-3 rounded-md px-3 py-2.5 font-mono-code text-[0.8125rem] tracking-tight border transition-colors',
          isActive
            ? 'bg-gold/10 border-gold/60 text-gold font-bold'
            : 'bg-white/[0.06] border-white/10 text-slate-300 font-medium hover:bg-white/10 hover:text-slate-100',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={item.icon} className={cn('text-[1.125rem]', isActive ? 'text-gold' : item.iconClassName ?? 'text-slate-400')} />
          <span className="truncate">{t(item.label)}</span>
          <NavBadge item={item} counts={counts} />
        </>
      )}
    </NavLink>
  );
}

/** Fixed 240px control column (desktop) / slide-in drawer (mobile). */
export function Sidebar() {
  const t = useT();
  const { openCreateCampaign, mobileNavOpen, setMobileNavOpen } = useAppUi();
  // Badge counts come from the same services as the Comments / Leads screens (demo store or API).
  const commentSummary = useQuery('comments:summary', commentsService.summary);
  const leadSummary = useQuery('leads:summary', leadService.summary);
  const counts: NavCounts = { comments: commentSummary.data?.needsResponse, leads: leadSummary.data?.qualifiedLeads };
  const close = () => setMobileNavOpen(false);

  const content = (
    <>
      <div className="flex flex-col gap-4 min-h-0">
        <div className="flex items-center gap-3 px-2 py-1">
          <img alt="Eko" className="h-8 w-auto shrink-0" src="/eko-wordmark.svg" />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-heading text-headline-sm text-slate-100 font-bold tracking-tight">SocialBoard</span>
            </div>
            <span className="text-label-sm font-semibold ig-gradient-text truncate">{t('Instagram analytics')}</span>
          </div>
          <button type="button" className="ml-auto lg:hidden p-1 text-slate-400" onClick={close} aria-label={t('Close menu')}>
            <Icon name="close" className="text-[1.25rem]" />
          </button>
        </div>
        <button
          type="button"
          className="w-full bg-gold hover:bg-gold-hover text-navy text-sm font-semibold rounded-md px-6 py-2.5 transition-colors flex items-center justify-center gap-2"
          onClick={() => {
            close();
            openCreateCampaign();
          }}
        >
          <Icon name="add_circle" className="text-[1.125rem]" />
          <span>{t('New campaign')}</span>
        </button>
        <nav className="flex flex-col gap-2 mt-1 overflow-y-auto custom-scrollbar min-h-0" aria-label={t('Main menu')}>
          {mainNav.flatMap((section) => section.items).map((item) => (
            <SideLink key={item.to} item={item} counts={counts} onNavigate={close} />
          ))}
        </nav>
      </div>
      <nav className="border-t border-slate-800 pt-3 flex flex-col gap-2" aria-label={t('More')}>
        {footerNav.map((item) => (
          <SideLink key={item.to} item={item} counts={counts} onNavigate={close} />
        ))}
      </nav>
    </>
  );

  return (
    <>
      <aside className="hidden lg:flex fixed top-0 left-0 h-screen w-60 z-30 bg-slate-950 border-r border-slate-800 flex-col justify-between gap-4 p-4 select-none">{content}</aside>
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-navy/40 animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <aside className="h-full w-72 max-w-[85vw] bg-slate-950 border-r border-slate-800 flex flex-col justify-between gap-4 p-4 animate-slide-in-left" aria-label={t('Menu')}>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
