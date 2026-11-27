import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LinkButton, Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { Avatar } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Overlay';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { cn, formatNumber } from '@/lib/format';
import { accountService } from '@/services/accounts';
import type { InstagramAccount } from '@/types/domain';
import { MASKED_SECRET, SectionTitle, SettingsCard } from './settingsUi';

const statusPill: Record<InstagramAccount['status'], { label: string; cls: string }> = {
  connected: { label: msg('Working'), cls: 'bg-emerald-900/40 text-emerald-300 border-emerald-800' },
  syncing: { label: msg('Syncing'), cls: 'bg-sky-900/40 text-sky-300 border-sky-800' },
  action_required: { label: msg('Needs attention'), cls: 'bg-amber-900/40 text-amber-300 border-amber-800' },
  expired: { label: msg('Login expired'), cls: 'bg-rose-900/40 text-error border-rose-800' },
};

function AccountCard({ account, onRaw, onDisconnect }: { account: InstagramAccount; onRaw: () => void; onDisconnect: () => void }) {
  const t = useT();
  const toast = useToast();
  const pill = statusPill[account.status];
  const healthy = account.status === 'connected';
  const reauth = () =>
    toast({
      tone: 'demo',
      title: healthy ? t('Login not checked') : t('Reconnect not available here'),
      description: t('These are sample accounts. Use the Instagram accounts page to connect a real one.'),
    });
  return (
    <div className="bg-surface-card border border-border-strong rounded-xl shadow-card p-5">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/accounts/${account.id}`} className="flex items-center gap-3 min-w-0 group">
          <Avatar name={account.displayName} src={account.avatarUrl} size="lg" className="w-12 h-12" />
          <div className="min-w-0">
            <h3 className="text-label-md font-bold text-text-primary group-hover:underline truncate">{account.displayName}</h3>
            <div className="text-body-sm text-text-secondary">
              @{account.handle} · {account.type === 'business' ? t('Business') : t('Creator')}
            </div>
          </div>
        </Link>
        <span className={cn('px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold border whitespace-nowrap', pill.cls)}>{t(pill.label)}</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-text-tertiary">{t('Posts and reels')}</dt>
          <dd className="font-medium text-text-primary tnum">{formatNumber(account.mediaCount)}</dd>
        </div>
        <div>
          <dt className="text-text-tertiary">{t('Last sync')}</dt>
          <dd className="font-medium text-text-primary">{account.lastSyncedAt}</dd>
        </div>
        {account.statusNote && !healthy && (
          <div className="col-span-2">
            <dd className={cn('font-medium', account.status === 'expired' ? 'text-error' : 'text-amber-300')}>{account.statusNote}</dd>
          </div>
        )}
      </dl>
      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        <button type="button" onClick={reauth} className={cn('text-label-sm font-semibold hover:underline flex items-center gap-1', healthy ? 'text-primary' : 'text-amber-300')}>
          <Icon name={healthy ? 'refresh' : 'sync_problem'} className="text-[1rem]" /> {healthy ? t('Check login') : t('Reconnect')}
        </button>
        <div className="flex items-center gap-3">
          <button type="button" className="text-label-sm text-text-secondary hover:text-text-primary" onClick={onRaw}>
            {t('Raw data')}
          </button>
          {!account.isPrimary && (
            <button type="button" className="text-label-sm text-error hover:underline" onClick={onDisconnect}>
              {t('Disconnect')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function InstagramTab() {
  const t = useT();
  const accountsQ = useQuery('accounts:list', accountService.list);
  const [raw, setRaw] = useState<InstagramAccount | null>(null);
  const [disconnecting, setDisconnecting] = useState<InstagramAccount | null>(null);
  const scopes = Array.from(new Set((accountsQ.data ?? []).flatMap((a) => a.scopes)));

  return (
    <section className="flex flex-col gap-6">
      <SettingsCard>
        <SectionTitle
          title={
            <>
              {t('Instagram accounts')}
              <span className="text-[0.6875rem] font-medium text-text-tertiary">{t('Sample data')}</span>
              <InfoTip text={t('These accounts and permissions are samples. Live connections are on the Instagram accounts page.')} />
            </>
          }
          subtitle={t('Accounts linked to this workspace.')}
          actions={
            <LinkButton to="/accounts" iconRight="arrow_forward">
              {t('Manage accounts')}
            </LinkButton>
          }
        />
        {scopes.length > 0 && (
          <details className="text-body-sm">
            <summary className="cursor-pointer select-none text-text-secondary hover:text-text-primary">{t('Permissions on record ({count})', { count: scopes.length })}</summary>
            <div className="flex flex-wrap gap-2 mt-3">
              {scopes.map((s) => (
                <span key={s} className="px-2.5 py-1 rounded-full bg-surface-canvas border border-border-strong text-xs font-mono text-text-primary flex items-center gap-1.5">
                  <Icon name="check" className="text-[0.875rem] text-emerald-400" /> {s}
                </span>
              ))}
            </div>
          </details>
        )}
      </SettingsCard>

      <QueryState
        query={accountsQ}
        loading={
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
          </div>
        }
        empty={
          <div className="p-6 text-center bg-surface-card border border-dashed border-border-strong rounded-xl text-body-sm text-text-secondary">
            {t('No Instagram accounts yet.')}{' '}
            <Link to="/accounts/connect" className="text-primary font-semibold hover:underline">
              {t('Connect an account')}
            </Link>
          </div>
        }
      >
        {(accounts) => (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((a) => (
              <AccountCard key={a.id} account={a} onRaw={() => setRaw(a)} onDisconnect={() => setDisconnecting(a)} />
            ))}
          </div>
        )}
      </QueryState>

      <p className="flex items-center gap-2 text-body-sm text-text-secondary px-1">
        <Icon name="lock" className="text-[1.125rem] text-text-tertiary" />
        {t('SocialBoard never asks for your Instagram password.')}
      </p>

      <Modal
        open={!!raw}
        onClose={() => setRaw(null)}
        size="lg"
        icon="data_object"
        title={t('Raw account data')}
        subtitle={raw ? t('@{handle} · sample record', { handle: raw.handle }) : undefined}
      >
        <div className="bg-slate-950 text-slate-200 p-3 rounded-lg font-mono text-[0.6875rem] overflow-x-auto custom-scrollbar border border-slate-700">
          <pre>{raw ? JSON.stringify({ ...raw, access_token: MASKED_SECRET }, null, 2) : ''}</pre>
        </div>
      </Modal>

      <Modal
        open={!!disconnecting}
        onClose={() => setDisconnecting(null)}
        size="sm"
        icon="link_off"
        title={t('Disconnect @{handle}?', { handle: disconnecting?.handle ?? '' })}
        footer={
          <>
            <Button onClick={() => setDisconnecting(null)}>{t('Cancel')}</Button>
            <LinkButton to={disconnecting ? `/accounts/${disconnecting.id}` : '/accounts'} variant="danger" iconRight="arrow_forward">
              {t('Open account page')}
            </LinkButton>
          </>
        }
      >
        <div className="text-body-sm text-text-secondary space-y-2">
          <p>{t('You disconnect an account from its own page, where you can see what will stop.')}</p>
          <p className="text-text-tertiary">{t('Nothing has been disconnected.')}</p>
        </div>
      </Modal>
    </section>
  );
}
