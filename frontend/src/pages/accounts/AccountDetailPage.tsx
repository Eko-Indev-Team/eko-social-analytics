import { useNavigate, useParams } from 'react-router-dom';
import { Button, LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ErrorState, PageSkeleton, QueryState, Skeleton } from '@/components/ui/States';
import { AccountDetailHeader, AccountDetailTitle } from '@/features/accounts/detail/AccountDetailHeader';
import { CapabilitiesMatrix } from '@/features/accounts/detail/CapabilitiesMatrix';
import { LinkedCampaigns } from '@/features/accounts/detail/LinkedCampaigns';
import { ScopesCard } from '@/features/accounts/detail/ScopesCard';
import { SyncHistoryLog } from '@/features/accounts/detail/SyncHistoryLog';
import { TelemetryTiles } from '@/features/accounts/detail/TelemetryTiles';
import { useAccountActions } from '@/features/accounts/useAccountActions';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { NotFoundError } from '@/lib/api/source';
import { accountDetailService } from '@/services/accountDetails';
import { accountService } from '@/services/accounts';
import type { InstagramAccount } from '@/types/domain';

function AccountNotFound({ id }: { id: string }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6 bg-surface-card border border-border-strong rounded-xl shadow-card">
      <div className="w-14 h-14 rounded-full bg-primary-container/15 flex items-center justify-center mb-4">
        <Icon name="person_off" className="text-[1.875rem] text-primary" />
      </div>
      <h1 className="font-heading text-[1.75rem] leading-9 font-bold text-text-primary">{t('Account not found')}</h1>
      <p className="text-body-md text-text-secondary mt-2 max-w-md">{t('There is no account with ID {id}. It may have been disconnected.', { id })}</p>
      <div className="flex gap-2 mt-6 flex-wrap justify-center">
        <LinkButton to="/accounts" variant="primary" icon="arrow_back">
          {t('Back to accounts')}
        </LinkButton>
        <LinkButton to="/accounts/connect" icon="add">
          {t('Connect account')}
        </LinkButton>
      </div>
    </div>
  );
}

function StatusCallout({ account, onReconnect }: { account: InstagramAccount; onReconnect: () => void }) {
  const t = useT();
  if (account.status === 'connected' || account.status === 'syncing') return null;
  const expired = account.status === 'expired';
  return (
    <div
      className={
        expired
          ? 'p-4 rounded-xl border border-error/20 bg-error-container/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3'
          : 'p-4 rounded-xl border border-amber-800 bg-amber-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3'
      }
    >
      <div className="flex items-start gap-3">
        <Icon name={expired ? 'link_off' : 'lock_clock'} className={expired ? 'text-error text-[1.375rem]' : 'text-status-paused text-[1.375rem]'} />
        <div>
          <p className="font-semibold text-text-primary text-body-md">{expired ? t('Login expired. Data has stopped.') : t('Login needs renewing')}</p>
          {account.statusNote && <p className="text-body-sm text-text-secondary mt-0.5">{account.statusNote}</p>}
        </div>
      </div>
      <Button variant={expired ? 'primary' : 'secondary'} icon={expired ? 'sync_problem' : 'key'} onClick={onReconnect} className="self-start sm:self-auto">
        {expired ? t('Reconnect') : t('Renew login')}
      </Button>
    </div>
  );
}

/** Instagram account detail (sample account). */
export default function AccountDetailPage() {
  const t = useT();
  const { accountId = '' } = useParams();
  const navigate = useNavigate();
  const account = useQuery(`accounts:detail:${accountId}`, () => accountService.get(accountId));
  const telemetry = useQuery(`accounts:telemetry:${accountId}`, () => accountDetailService.telemetry(accountId), { enabled: account.status === 'success' });
  const logs = useQuery(`accounts:sync-logs:${accountId}`, () => accountDetailService.syncLogs(accountId));
  const catalog = useQuery('accounts:scopes', accountDetailService.scopeCatalog);
  const summary = useQuery('accounts:summary', accountDetailService.summary);
  const actions = useAccountActions({ onDisconnected: () => navigate('/accounts') });
  useDocumentTitle(account.data ? `${account.data.displayName} (@${account.data.handle})` : t('Instagram account'));

  return (
    <QueryState
      query={account}
      loading={<PageSkeleton />}
      error={(err, retry) => (err instanceof NotFoundError ? <AccountNotFound id={accountId} /> : <ErrorState error={err} onRetry={retry} />)}
    >
      {(acc) => (
        <div className="flex flex-col gap-6">
          <AccountDetailTitle account={acc} />
          <QueryState query={telemetry} loading={<PageSkeleton />}>
            {(tel) => (
              <>
                <AccountDetailHeader account={acc} telemetry={tel} actions={actions} />
                <StatusCallout account={acc} onReconnect={actions.reconnect} />
                <TelemetryTiles tiles={tel.tiles} />
                <QueryState query={logs} loading={<Skeleton className="h-72" />}>
                  {(rows) => <SyncHistoryLog entries={rows} handle={acc.handle} totalRuns={tel.totalSyncRuns} />}
                </QueryState>
                <CapabilitiesMatrix rows={tel.capabilities} version={summary.data?.meta.graphApiVersion ?? 'v19.0'} onRefresh={telemetry.refetch} refreshing={telemetry.isFetching} />
                <ScopesCard telemetry={tel} catalog={catalog.data ?? []} handle={acc.handle} />
              </>
            )}
          </QueryState>
          <LinkedCampaigns accountId={acc.id} handle={acc.handle} />
          {actions.overlays}
        </div>
      )}
    </QueryState>
  );
}
