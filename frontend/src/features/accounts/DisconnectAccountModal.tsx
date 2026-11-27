import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Overlay';
import { useT } from '@/i18n/I18nContext';
import { modeText } from '@/lib/config';
import type { InstagramAccount } from '@/types/domain';

/** Confirmation before removing a sample account from the list. */
export function DisconnectAccountModal({
  account,
  pending,
  onCancel,
  onConfirm,
}: {
  account: InstagramAccount | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  return (
    <Modal
      open={!!account}
      onClose={onCancel}
      size="sm"
      icon="link_off"
      title={t('Disconnect account?')}
      subtitle={account ? `${account.displayName} (@${account.handle})` : undefined}
      footer={
        <>
          <Button onClick={onCancel}>{t('Cancel')}</Button>
          <Button variant="danger" icon="link_off" loading={pending} onClick={onConfirm} data-autofocus>
            {t('Disconnect')}
          </Button>
        </>
      }
    >
      <div className="space-y-2 text-body-sm text-text-secondary">
        <p>{t('SocialBoard will stop getting data from @{handle}.', { handle: account?.handle ?? '' })}</p>
        <p className="text-text-tertiary">
          {modeText(
            t('Demo only: the account is hidden until you reload the page. Nothing changes on Instagram.'),
            t('Sample accounts cannot be disconnected yet. The server will say no and nothing changes.'),
          )}
        </p>
      </div>
    </Modal>
  );
}
