import { PageHeader } from '@/components/layout/PageHeader';
import { Button, LinkButton } from '@/components/ui/Button';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { useToast } from '@/components/ui/Toast';
import { useT } from '@/i18n/I18nContext';
import { cn, formatDate } from '@/lib/format';
import type { AccountTelemetry, HealthTone } from '@/types/accounts';
import type { InstagramAccount } from '@/types/domain';
import { AccountAvatar } from '../AccountCard';
import { accountTypeLabel } from '../accountMeta';
import { AccountStatusPill } from '../AccountStatusPill';
import type { useAccountActions } from '../useAccountActions';

const toneIcon: Record<HealthTone, { icon: string; cls: string }> = {
  active: { icon: 'verified_user', cls: 'text-status-active' },
  warning: { icon: 'lock_clock', cls: 'text-status-paused' },
  error: { icon: 'gpp_bad', cls: 'text-error' },
};

export function AccountDetailTitle({ account }: { account: InstagramAccount }) {
  const t = useT();
  return (
    <PageHeader
      breadcrumbs={[{ label: t('Instagram accounts'), to: '/accounts' }, { label: `@${account.handle}` }]}
      title={account.displayName}
      titleAddon={
        <span className="flex items-center gap-1.5 text-[0.75rem] text-text-tertiary">
          {t('Sample data')}
          <InfoTip text={t('This is a sample account. Sync and login actions explain what would happen; Instagram is not called.')} />
        </span>
      }
      actions={
        <LinkButton to="/accounts" icon="arrow_back">
          {t('Back to accounts')}
        </LinkButton>
      }
    />
  );
}

export function AccountDetailHeader({
  account,
  telemetry,
  actions,
}: {
  account: InstagramAccount;
  telemetry: AccountTelemetry;
  actions: ReturnType<typeof useAccountActions>;
}) {
  const t = useT();
  const toast = useToast();
  const token = toneIcon[telemetry.token.tone];
  const testConnection = () =>
    toast({
      tone: 'demo',
      title: t('Connection test not available'),
      description: t('@{handle} is a sample account, so nothing was sent to Instagram.', { handle: account.handle }),
    });

  const facts = [
    { icon: 'schedule', cls: 'text-text-tertiary', label: t('Last sync'), value: account.lastSyncedAt.startsWith('Just now') ? account.lastSyncedAt : telemetry.lastSync.label },
    { icon: 'timelapse', cls: 'text-text-tertiary', label: t('Sync schedule'), value: telemetry.cadence.label },
    { icon: token.icon, cls: token.cls, label: t('Login'), value: `${telemetry.token.label} ${telemetry.token.detail ?? ''}`.trim() },
  ];

  return (
    <div className="bg-surface-card border border-border-strong rounded-xl p-5 shadow-card">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
        <div className="flex items-center gap-4 min-w-0">
          <AccountAvatar account={account} size="lg" />
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-label-md text-text-secondary">@{account.handle}</span>
              <AccountStatusPill status={account.status} />
            </div>
            <div className="text-body-sm text-text-secondary">
              {t(accountTypeLabel[account.type])} · {t('Connected {date}', { date: formatDate(account.connectedSince) })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {account.status === 'expired' ? (
            <Button variant="primary" size="md" icon="sync_problem" onClick={actions.reconnect}>
              {t('Reconnect')}
            </Button>
          ) : (
            <Button variant="primary" size="md" icon="sync" loading={actions.isSyncing(account.id)} onClick={() => actions.sync(account)}>
              {t('Sync now')}
            </Button>
          )}
          <Dropdown
            label={t('More actions')}
            trigger={({ toggle, open }) => (
              <Button size="md" iconRight="expand_more" onClick={toggle} aria-expanded={open} aria-haspopup="menu">
                {t('More')}
              </Button>
            )}
          >
            {(close) => (
              <>
                <MenuItem icon="network_check" onClick={() => (close(), testConnection())}>
                  {t('Test connection')}
                </MenuItem>
                {account.status !== 'expired' && (
                  <MenuItem icon="key" onClick={() => (close(), actions.reconnect())}>
                    {t('Renew login')}
                  </MenuItem>
                )}
                <MenuItem icon="key" onClick={() => (close(), actions.reviewPermissions(account))}>
                  {t('Review permissions')}
                </MenuItem>
                <div className="my-1 border-t border-border-subtle" />
                <MenuItem icon="link_off" danger onClick={() => (close(), actions.requestDisconnect(account))}>
                  {t('Disconnect')}
                </MenuItem>
              </>
            )}
          </Dropdown>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-body-sm">
        {facts.map((f) => (
          <div key={f.label} className="flex items-start gap-2">
            <Icon name={f.icon} className={cn('text-[1.125rem]', f.cls)} />
            <div>
              <dt className="text-text-tertiary text-[0.75rem]">{f.label}</dt>
              <dd className="text-text-primary font-semibold">{f.value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
