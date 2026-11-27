import { msg } from '@/i18n/I18nContext';

/** Sidebar structure — mirrors the SideNavBar shared component in the Stitch export. */
export interface NavItem {
  label: string;
  to: string;
  icon: string;
  iconClassName?: string;
  badge?: { kind: 'count'; key: 'comments' | 'leads' } | { kind: 'ai' };
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

export const mainNav: NavSection[] = [
  {
    label: msg('Main'),
    items: [
      { label: msg('Dashboard'), to: '/dashboard', icon: 'dashboard' },
      { label: msg('Campaigns'), to: '/campaigns', icon: 'campaign' },
      { label: msg('Content'), to: '/content', icon: 'movie' },
      { label: msg('Publish'), to: '/instagram/publish', icon: 'send' },
      { label: msg('Audience'), to: '/audience', icon: 'group' },
      { label: msg('Comments'), to: '/comments', icon: 'chat_bubble', badge: { kind: 'count', key: 'comments' } },
      { label: msg('Leads'), to: '/leads', icon: 'contact_page', badge: { kind: 'count', key: 'leads' } },
    ],
  },
  {
    // One tile for the whole Ads module; the Ads pages switch between themselves with tabs (features/ads/AdsTabs).
    label: msg('Ads'),
    items: [{ label: msg('Ads'), to: '/ads', icon: 'ads_click' }],
  },
  {
    label: msg('Intelligence'),
    items: [{ label: msg('AI insights'), to: '/ai-insights', icon: 'auto_awesome', badge: { kind: 'ai' } }],
  },
  {
    label: msg('Reporting'),
    items: [{ label: msg('Reports'), to: '/reports', icon: 'assessment' }],
  },
];

export const footerNav: NavItem[] = [
  { label: msg('Activity log'), to: '/activity', icon: 'history' },
];
