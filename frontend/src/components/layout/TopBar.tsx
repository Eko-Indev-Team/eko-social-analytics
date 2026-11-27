import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppUi } from '@/app/AppUiContext';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { cn } from '@/lib/format';
import { accountService } from '@/services/accounts';
import { notificationService } from '@/services/notifications';
import { useAuth } from '@/app/AuthContext';
import { usePreviewState } from '@/app/PreviewStateContext';
import { useTheme } from '@/app/theme';
import { sessionUser, sessionWorkspace } from '@/services/workspace';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Misc';
import { useToast } from '@/components/ui/Toast';
import { msg, useT } from '@/i18n/I18nContext';
import { InstagramRing } from '@/components/ui/InstagramRing';
import { GlobalSearch } from './GlobalSearch';
import { LanguageMenu } from './LanguageMenu';

const DATE_PRESETS = [
  { id: 'last30', label: sessionWorkspace.reportingPeriod.label, covered: true },
  { id: 'last7', label: msg('Last 7 days: Oct 25 – Oct 31, 2024'), covered: false },
  { id: 'last90', label: msg('Last 90 days: Aug 3 – Oct 31, 2024'), covered: false },
  { id: 'qtd', label: msg('This quarter: Oct 1 – Oct 31, 2024'), covered: true },
] as const;

const statusMeta = {
  connected: { label: msg('Connected'), cls: 'text-status-active' },
  action_required: { label: msg('Needs action'), cls: 'text-status-paused' },
  expired: { label: msg('Expired'), cls: 'text-error' },
  syncing: { label: msg('Syncing'), cls: 'text-status-completed' },
} as const;

/** Shared TopNavBar from the export: account pill, search, sync status, date range, alerts, profile. */
export function TopBar() {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const auth = useAuth();
  const signOut = async () => {
    await auth.logout();
    toast({ tone: 'success', title: t('Signed out') });
    navigate('/login', { replace: true });
  };
  const { setMobileNavOpen, lastSyncedLabel, setLastSyncedLabel } = useAppUi();
  const { theme, toggle: toggleTheme } = useTheme();
  const preview = usePreviewState();
  const accounts = useQuery('accounts:list', accountService.list);
  const unread = useQuery('notifications:unread', notificationService.unreadCount);
  const [preset, setPreset] = useState<(typeof DATE_PRESETS)[number]['id']>('last30');
  const primary = accounts.data?.find((a) => a.isPrimary);

  const sync = useMutation(() => accountService.requestSync(accountService.primaryId), {
    invalidate: ['accounts'],
    onSuccess: () => {
      setLastSyncedLabel('Synced just now');
      toast({ tone: 'demo', title: t('Sample data refreshed'), description: t('No Instagram account is connected yet, so the sample data was reloaded.') });
    },
  });

  const currentPreset = DATE_PRESETS.find((p) => p.id === preset)!;

  return (
    <header className="fixed top-0 left-0 lg:left-60 right-0 h-14 z-20 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 px-4 lg:px-6">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button type="button" className="lg:hidden p-1.5 -ml-1 text-text-secondary hover:text-text-primary" onClick={() => setMobileNavOpen(true)} aria-label={t('Open menu')}>
          <Icon name="menu" className="text-[1.375rem]" />
        </button>
        <img src="/eko-wordmark.svg" alt="Eko" className="h-8 w-auto lg:hidden" />

        <Dropdown
          align="left"
          label={t('Instagram accounts')}
          className="w-72"
          trigger={({ toggle, open }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-haspopup="menu"
              className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface-canvas border border-border-strong text-text-primary text-label-md hover:bg-surface-card-subtle transition-colors"
            >
              <InstagramRing>
                <Avatar name={primary?.displayName ?? sessionWorkspace.name} src={primary?.avatarUrl} size="xs" />
              </InstagramRing>
              <span className="font-semibold text-text-primary font-headline-sm text-xs whitespace-nowrap">{primary?.displayName ?? sessionWorkspace.name}</span>
              <span className="text-text-tertiary font-normal hidden 2xl:inline">@{primary?.handle ?? 'ekoindia'}</span>
              <Icon name="verified" filled className="text-status-completed text-[1rem]" />
              <Icon name="arrow_drop_down" className="text-[1rem] text-text-secondary" />
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-3 pt-1.5 pb-2 text-[0.625rem] font-bold uppercase tracking-wider text-text-tertiary">{t('Instagram accounts')}</div>
              {(accounts.data ?? []).map((a) => (
                <MenuItem
                  key={a.id}
                  active={a.isPrimary}
                  onClick={() => {
                    close();
                    if (a.isPrimary) return;
                    navigate(`/accounts/${a.id}`);
                    toast({ tone: 'info', title: t('Showing details for @{handle}', { handle: a.handle }) });
                  }}
                >
                  <span className="block font-semibold">{a.displayName}</span>
                  <span className={cn('block text-[0.6875rem]', statusMeta[a.status].cls)}>
                    @{a.handle} · {t(statusMeta[a.status].label)}
                  </span>
                </MenuItem>
              ))}
              <div className="border-t border-border-strong mt-1 pt-1">
                <MenuItem
                  icon="add"
                  onClick={() => {
                    close();
                    navigate('/accounts/connect');
                  }}
                >
                  {t('Connect Instagram account')}
                </MenuItem>
              </div>
            </>
          )}
        </Dropdown>

        <GlobalSearch className="min-w-[9rem] max-w-72 flex-1" />
      </div>

      <div className="flex items-center gap-2 lg:gap-3 shrink-0">
        {/* Sync: just an icon; hovering shows when the data was last synced. */}
        <div className="relative group">
          <button
            type="button"
            className="relative p-1 text-text-secondary hover:text-text-primary"
            onClick={() => sync.mutate()}
            aria-label={`${t(lastSyncedLabel)}. ${t('Sync now')}`}
          >
            <Icon name="sync" className={cn('text-[1.375rem]', sync.isPending && 'animate-spin')} />
            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-[9999px] bg-status-active ring-2 ring-slate-900" />
          </button>
          <div
            role="tooltip"
            className="pointer-events-none absolute right-0 top-full mt-2 z-40 whitespace-nowrap rounded-lg border border-border-strong bg-surface-card px-3 py-2 shadow-flyout opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 transition-all"
          >
            <p className="text-label-md font-semibold text-text-primary">{t(lastSyncedLabel)}</p>
            <p className="text-[0.6875rem] text-text-tertiary">{t('Sync now')}</p>
          </div>
        </div>

        <Dropdown
          label={t('Date range')}
          className="w-80"
          trigger={({ toggle, open }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-haspopup="menu"
              aria-label={`${t('Date range')}: ${t(currentPreset.label)}`}
              title={t(currentPreset.label)}
              className="p-1 text-text-secondary hover:text-text-primary"
            >
              <Icon name="calendar_today" className="text-[1.375rem]" />
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-3 pt-1.5 pb-2 border-b border-border-strong mb-1">
                <p className="text-[0.625rem] font-bold uppercase tracking-wider text-text-tertiary">{t('Selected range')}</p>
                <p className="text-label-md font-semibold text-text-primary">{t(currentPreset.label)}</p>
              </div>
              {DATE_PRESETS.map((p) => (
                <MenuItem
                  key={p.id}
                  active={p.id === preset}
                  onClick={() => {
                    close();
                    setPreset(p.id);
                    if (!p.covered)
                      toast({ tone: 'warning', title: t('Sample data covers Oct 1 – Oct 31, 2024 only') });
                  }}
                >
                  {t(p.label)}
                </MenuItem>
              ))}
            </>
          )}
        </Dropdown>

        <div className="h-5 w-px bg-border-strong mx-1 hidden sm:block" />
        <LanguageMenu />
        <button
          type="button"
          className="p-1 text-text-secondary hover:text-text-primary"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? t('Light theme') : t('Dark theme')}
          title={theme === 'dark' ? t('Light theme') : t('Dark theme')}
        >
          <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} className="text-[1.375rem]" />
        </button>
        <button type="button" className="relative p-1 text-text-secondary hover:text-text-primary" onClick={() => navigate('/notifications')} aria-label={t('Notifications ({count} unread)', { count: unread.data ?? 0 })}>
          <Icon name="notifications" className="text-[1.375rem]" />
          {(unread.data ?? 0) > 0 && (
            <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-gold text-[0.625rem] font-bold text-navy flex items-center justify-center tnum">{unread.data}</span>
          )}
        </button>
        <Dropdown
          label={t('Account')}
          className="w-60"
          trigger={({ toggle, open }) => (
            <button type="button" className="flex items-center gap-2 pl-1" onClick={toggle} aria-expanded={open} aria-haspopup="menu" aria-label={t('Account menu')}>
              <Avatar name={auth.displayName} />
              <span className="hidden xl:flex flex-col text-left">
                <span className="font-label-sm text-xs text-text-primary font-bold leading-none">{auth.displayName}</span>
                <span className="text-[0.625rem] text-text-secondary leading-tight">{t(auth.displayRole)}</span>
              </span>
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-3 pt-1.5 pb-2 border-b border-border-strong">
                <p className="text-label-md font-semibold text-text-primary truncate">{auth.displayName}</p>
                <p className="text-[0.6875rem] text-text-tertiary truncate">{auth.me ? `${auth.me.user.email} · ${auth.workspaceName}` : sessionUser.email}</p>
              </div>
              <MenuItem icon="switch_account" onClick={() => { close(); navigate('/accounts'); }}>{t('Instagram accounts')}</MenuItem>
              <MenuItem icon="settings" onClick={() => { close(); navigate('/settings'); }}>{t('Settings')}</MenuItem>
              <MenuItem icon="toggle_on" onClick={() => { close(); preview.setBarVisible(!preview.barVisible); }}>{preview.barVisible ? t('Hide page states') : t('Show page states')}</MenuItem>
              <MenuItem icon="shield_person" onClick={() => { close(); navigate('/settings?tab=security'); }}>{t('Security & sessions')}</MenuItem>
              {auth.status === 'authenticated' ? (
                <MenuItem icon="logout" danger onClick={() => { close(); void signOut(); }}>{t('Sign out')}</MenuItem>
              ) : (
                <>
                  <MenuItem icon="login" onClick={() => { close(); navigate('/login'); }}>{t('Sign in / Sign up')}</MenuItem>
                  <p className="px-3 py-2 text-[0.6875rem] text-text-tertiary">{t('Demo mode has no accounts.')}</p>
                </>
              )}
            </>
          )}
        </Dropdown>
      </div>
      {/* Thin Instagram-gradient line under the header: a quiet hint of the platform. */}
      <span className="ig-gradient absolute inset-x-0 -bottom-px h-px opacity-60 pointer-events-none" aria-hidden />
    </header>
  );
}
