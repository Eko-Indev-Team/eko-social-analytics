import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppUi } from '@/app/AppUiContext';
import { useToast } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useMutation';
import { useT } from '@/i18n/I18nContext';
import { accountService } from '@/services/accounts';
import type { InstagramAccount } from '@/types/domain';
import { canSync } from './accountMeta';
import { DisconnectAccountModal } from './DisconnectAccountModal';
import { ReviewPermissionsModal } from './ReviewPermissionsModal';

/**
 * Honest account actions shared by the overview cards and the detail header.
 * Nothing here calls Instagram/Meta: sync refreshes the demo label, disconnect edits the local demo list.
 */
export function useAccountActions(options: { onDisconnected?: (account: InstagramAccount) => void } = {}) {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const { setLastSyncedLabel } = useAppUi();
  const [pendingSyncId, setPendingSyncId] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<InstagramAccount | null>(null);
  const [permissionsTarget, setPermissionsTarget] = useState<InstagramAccount | null>(null);

  const syncOne = useMutation((id: string) => accountService.requestSync(id), { invalidate: ['accounts'] });
  const syncMany = useMutation((ids: string[]) => Promise.all(ids.map((id) => accountService.requestSync(id))), { invalidate: ['accounts'] });
  const disconnect = useMutation((id: string) => accountService.disconnect(id), { invalidate: ['accounts'] });

  const sync = async (account: InstagramAccount) => {
    if (!canSync(account)) {
      toast({ tone: 'warning', title: t('@{handle} cannot sync', { handle: account.handle }), description: t('This account login has expired. Reconnect it to sync again.') });
      return;
    }
    setPendingSyncId(account.id);
    const result = await syncOne.mutate(account.id);
    setPendingSyncId(null);
    if (!result) return;
    if (account.status === 'connected') setLastSyncedLabel('Synced just now');
    toast({
      tone: 'demo',
      title: t('Demo sync for @{handle}', { handle: account.handle }),
      description:
        account.status === 'connected'
          ? t('Sample account: only the "last sync" time was updated. Instagram was not called.')
          : t('Sample account: it needs a new login, so nothing changed. Instagram was not called.'),
    });
  };

  const syncAll = async (accounts: InstagramAccount[]) => {
    const eligible = accounts.filter(canSync);
    if (eligible.length === 0) {
      toast({ tone: 'warning', title: t('No accounts to sync'), description: t('None of these accounts has a working login.') });
      return;
    }
    const result = await syncMany.mutate(eligible.map((a) => a.id));
    if (!result) return;
    setLastSyncedLabel('Synced just now');
    toast({
      tone: 'demo',
      title: t('Demo sync: {count} accounts', { count: eligible.length }),
      description: t('Sample accounts: only the "last sync" times were updated. Instagram was not called.'),
    });
  };

  const confirmDisconnect = async () => {
    if (!disconnectTarget) return;
    const target = disconnectTarget;
    const result = await disconnect.mutate(target.id);
    if (!result) return;
    setDisconnectTarget(null);
    toast({
      tone: 'demo',
      title: t('@{handle} removed', { handle: target.handle }),
      description: t('Demo only: reload the page to bring the sample accounts back.'),
    });
    options.onDisconnected?.(target);
  };

  const reconnect = () => navigate('/accounts/connect');

  const overlays = (
    <>
      <DisconnectAccountModal account={disconnectTarget} pending={disconnect.isPending} onCancel={() => setDisconnectTarget(null)} onConfirm={confirmDisconnect} />
      <ReviewPermissionsModal account={permissionsTarget} onClose={() => setPermissionsTarget(null)} onReconnect={reconnect} />
    </>
  );

  return {
    sync,
    syncAll,
    isSyncing: (id: string) => pendingSyncId === id,
    isSyncingAll: syncMany.isPending,
    requestDisconnect: setDisconnectTarget,
    reviewPermissions: setPermissionsTarget,
    reconnect,
    overlays,
  };
}
