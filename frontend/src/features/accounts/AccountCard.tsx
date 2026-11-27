import { Link, useNavigate } from 'react-router-dom';
import { Button, LinkButton } from '@/components/ui/Button';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { InstagramAccount } from '@/types/domain';
import { accountTypeLabel, availabilityCategories, availabilityIcon, canSync } from './accountMeta';
import { AccountStatusPill } from './AccountStatusPill';
import type { useAccountActions } from './useAccountActions';

type Actions = ReturnType<typeof useAccountActions>;

export function AccountAvatar({ account, size = 'md' }: { account: InstagramAccount; size?: 'md' | 'lg' }) {
  const t = useT();
  const dims = size === 'lg' ? 'w-16 h-16 rounded-xl' : 'w-12 h-12 rounded-xl';
  if (account.status === 'expired') {
    return (
      <div className={cn(dims, 'bg-surface-card-subtle text-text-tertiary font-bold flex items-center justify-center text-lg border border-border-strong flex-shrink-0')}>
        <Icon name="link_off" className="text-[1.5rem]" />
      </div>
    );
  }
  if (account.avatarUrl) {
    return (
      <div className="relative flex-shrink-0">
        <img alt={t('{name} logo', { name: account.displayName })} className={cn(dims, 'object-contain p-1.5 bg-surface-card border border-border-strong')} src={account.avatarUrl} />
        {account.verified && (
          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center ring-2 ring-surface-card" title={t('Verified')}>
            <Icon name="verified" filled className="text-[0.8125rem]" />
          </span>
        )}
      </div>
    );
  }
  return (
    <div className={cn(dims, 'bg-surface-container text-text-primary font-bold flex items-center justify-center text-lg border border-border-strong flex-shrink-0')} aria-hidden>
      {account.initials}
    </div>
  );
}

function AccountMoreMenu({ account, actions }: { account: InstagramAccount; actions: Actions }) {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(account.externalId);
      toast({ tone: 'success', title: t('Account ID copied'), description: account.externalId });
    } catch {
      toast({ tone: 'warning', title: t('Could not copy'), description: t('Account ID: {id}', { id: account.externalId }) });
    }
  };
  return (
    <Dropdown
      label={t('Actions for @{handle}', { handle: account.handle })}
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={t('More actions for @{handle}', { handle: account.handle })}
          className="h-8 w-8 text-text-secondary hover:text-text-primary hover:bg-surface-canvas rounded-lg flex items-center justify-center transition"
        >
          <Icon name="more_vert" className="text-[1.125rem]" />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuItem icon="open_in_new" onClick={() => (close(), navigate(`/accounts/${account.id}`))}>
            {t('View details')}
          </MenuItem>
          {canSync(account) && (
            <MenuItem icon="sync" onClick={() => (close(), actions.sync(account))}>
              {t('Sync now')}
            </MenuItem>
          )}
          <MenuItem icon="key" onClick={() => (close(), actions.reviewPermissions(account))}>
            {t('Review permissions')}
          </MenuItem>
          <MenuItem icon="sync_problem" onClick={() => (close(), actions.reconnect())}>
            {t('Reconnect')}
          </MenuItem>
          <MenuItem icon="content_copy" onClick={() => (close(), copyId())}>
            {t('Copy account ID')}
          </MenuItem>
          <div className="my-1 border-t border-border-subtle" />
          <MenuItem icon="link_off" danger onClick={() => (close(), actions.requestDisconnect(account))}>
            {t('Disconnect')}
          </MenuItem>
        </>
      )}
    </Dropdown>
  );
}

/** Small pills showing which kinds of data the account gives (posts, audience, comments, stories). */
function AvailabilityPills({ account }: { account: InstagramAccount }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-2">
      {availabilityCategories.map((c) => {
        const d = account.dataAvailability[c.key];
        const meta = availabilityIcon[d.level];
        return (
          <span
            key={c.key}
            title={`${d.label} · ${d.detail}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-canvas border border-border-subtle text-[0.75rem] text-text-secondary"
          >
            <Icon name={meta.icon} className={cn('text-[0.875rem]', meta.cls)} />
            {t(c.label)}
            <span className={cn('font-semibold', meta.valueCls)}>{d.label}</span>
          </span>
        );
      })}
    </div>
  );
}

/** One account card from the overview list. */
export function AccountCard({ account, actions }: { account: InstagramAccount; actions: Actions }) {
  const t = useT();
  const expired = account.status === 'expired';
  const attention = account.status === 'action_required';

  return (
    <article
      className={cn(
        'bg-surface-card rounded-xl shadow-card p-5 transition border',
        expired ? 'border-border-strong opacity-80 hover:opacity-100' : attention ? 'border-amber-800' : 'border-border-strong hover:border-slate-600',
      )}
      aria-label={`${account.displayName} (@${account.handle})`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <AccountAvatar account={account} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/accounts/${account.id}`} className={cn('font-heading text-[1.0625rem] font-semibold hover:underline', expired ? 'text-text-secondary' : 'text-text-primary')}>
                {account.displayName}
              </Link>
              <span className="text-label-md text-text-tertiary">@{account.handle}</span>
              <AccountStatusPill status={account.status} />
              {account.isPrimary && <span className="text-[0.6875rem] px-2 py-0.5 rounded-full bg-surface-container-low text-primary font-semibold">{t('Main')}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-text-secondary mt-1">
              <span>{t(accountTypeLabel[account.type])}</span>
              <span aria-hidden>·</span>
              <span>{t('Last sync: {time}', { time: account.lastSyncedAt })}</span>
              {(expired || attention) && account.statusNote && (
                <>
                  <span aria-hidden>·</span>
                  <span className={attention ? 'text-amber-300' : undefined}>{account.statusNote}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {expired ? (
            <>
              <Button icon="sync_problem" onClick={actions.reconnect}>
                {t('Reconnect')}
              </Button>
              <Button size="icon" aria-label={t('Disconnect @{handle}', { handle: account.handle })} onClick={() => actions.requestDisconnect(account)}>
                <Icon name="delete_outline" className="text-[1.125rem]" />
              </Button>
            </>
          ) : attention ? (
            <>
              <Button icon="key" onClick={() => actions.reviewPermissions(account)}>
                {t('Review permissions')}
              </Button>
              <LinkButton to={`/accounts/${account.id}`}>{t('View details')}</LinkButton>
              <AccountMoreMenu account={account} actions={actions} />
            </>
          ) : (
            <>
              <Button icon="sync" loading={actions.isSyncing(account.id)} onClick={() => actions.sync(account)}>
                {t('Sync now')}
              </Button>
              <LinkButton to={`/accounts/${account.id}`} variant="primary">
                {t('View details')}
              </LinkButton>
              <AccountMoreMenu account={account} actions={actions} />
            </>
          )}
        </div>
      </div>

      {!expired && (
        <div className="mt-4">
          <AvailabilityPills account={account} />
        </div>
      )}
    </article>
  );
}
