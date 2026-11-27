import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Overlay';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { accountDetailService } from '@/services/accountDetails';
import type { InstagramAccount } from '@/types/domain';

/** "Review permissions": compares the sample account's granted permissions with what SocialBoard asks for. */
export function ReviewPermissionsModal({ account, onClose, onReconnect }: { account: InstagramAccount | null; onClose: () => void; onReconnect: () => void }) {
  const t = useT();
  const catalog = useQuery('accounts:scopes', accountDetailService.scopeCatalog);
  const scopes = catalog.data ?? [];
  const missingMandatory = account ? scopes.filter((s) => s.mandatory && !account.scopes.includes(s.scope)) : [];

  return (
    <Modal
      open={!!account}
      onClose={onClose}
      size="md"
      icon="key"
      title={t('Review permissions')}
      subtitle={account ? `${account.displayName} (@${account.handle})` : undefined}
      footer={
        <>
          <Button onClick={onClose}>{t('Close')}</Button>
          <Button
            variant="primary"
            icon="sync_problem"
            onClick={() => {
              onClose();
              onReconnect();
            }}
          >
            {t('Reconnect')}
          </Button>
        </>
      }
    >
      {account && (
        <div className="space-y-3">
          {account.statusNote && <p className={cn('text-body-sm font-medium', account.status === 'expired' ? 'text-error' : 'text-amber-300')}>{account.statusNote}</p>}
          <ul className="divide-y divide-border-subtle">
            {scopes.map((s) => {
              const granted = account.scopes.includes(s.scope);
              return (
                <li key={s.scope} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-[0.75rem] text-primary font-semibold">{s.scope}</code>
                      {s.mandatory && <span className="text-[0.6875rem] px-2 py-0.5 rounded-full bg-surface-card-subtle text-text-secondary">{t('Required')}</span>}
                    </div>
                    <p className="text-body-sm text-text-secondary mt-1">{s.detailDescription}</p>
                  </div>
                  <span className={cn('inline-flex items-center gap-1 text-[0.75rem] font-semibold whitespace-nowrap', granted ? 'text-status-active' : 'text-error')}>
                    <Icon name={granted ? 'check_circle' : 'cancel'} className="text-[1rem]" />
                    {granted ? t('Given') : t('Missing')}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-body-sm text-text-tertiary">
            {missingMandatory.length > 0
              ? t('Required permissions missing: {count}. Sample data.', { count: missingMandatory.length })
              : t('All required permissions are given. Sample data.')}
          </p>
        </div>
      )}
    </Modal>
  );
}
