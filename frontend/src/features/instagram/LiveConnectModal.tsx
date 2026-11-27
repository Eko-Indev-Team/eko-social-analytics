import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Overlay';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { instagramService } from '@/services/instagram';
import { META_DOCS_URL } from '@/features/accounts/AccountsOverview';
import { LiveStateBadge } from './LiveConnectionsSection';
import { scopeDescriptions } from './liveMeta';
import { useInstagramActions } from './useInstagramActions';

const requirements = [
  msg('A Business or Creator account. Personal accounts cannot be connected.'),
  msg('You can sign in to that Instagram account in this browser.'),
  msg('While the app is in test mode, the account must be added as a tester.'),
];

/** API mode: the real connect step. Starts Meta's official Instagram Login; nothing is simulated. */
export function LiveConnectModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const status = useQuery('instagram:status', instagramService.status);
  const actions = useInstagramActions();
  const data = status.data;

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      icon="add_link"
      title={t('Connect an Instagram account')}
      subtitle={t('You sign in on Instagram. We never see your password.')}
      footer={
        <>
          <Button onClick={onClose}>{t('Cancel')}</Button>
          <Button
            variant="primary"
            icon={actions.connecting ? 'progress_activity' : 'open_in_new'}
            onClick={() => void actions.connect()}
            loading={actions.connecting}
            disabled={!data?.enabled || !data.canManage}
          >
            {actions.connecting ? t('Opening Instagram…') : t('Continue with Instagram')}
          </Button>
        </>
      }
    >
      {status.status === 'loading' ? (
        <Skeleton className="h-40" />
      ) : status.error || !data ? (
        <ErrorState title={t('Could not load the Instagram status')} error={status.error} onRetry={status.refetch} />
      ) : (
        <div className="space-y-5 text-body-sm">
          <LiveStateBadge state={actions.connecting ? 'connecting' : 'not_connected'} />
          {!data.enabled && (
            <Notice tone="warning" title={t('Not set up on this server')}>
              {t('An admin needs to set these server settings:')} <span className="font-mono text-[0.75rem]">{data.missingConfig.join(', ')}</span>
            </Notice>
          )}
          {data.enabled && !data.canManage && (
            <Notice tone="warning" title={t('Owner or admin needed')}>
              {t('You can view connected accounts but not add new ones.')}
            </Notice>
          )}
          <div>
            <h3 className="font-semibold text-text-primary mb-2">{t('Before you continue')}</h3>
            <ul className="space-y-1.5">
              {requirements.map((r) => (
                <li key={r} className="flex items-start gap-2 text-text-secondary">
                  <Icon name="check_circle" className="text-[1rem] text-status-active mt-0.5" />
                  <span>{t(r)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-text-primary mb-2">{t('Permissions we ask for')}</h3>
            <ul className="divide-y divide-border-subtle">
              {data.requestedScopes.map((scope) => (
                <li key={scope} className="py-2">
                  <code className="text-[0.75rem] font-semibold text-text-primary">{scope}</code>
                  <p className="text-text-secondary text-[0.75rem] mt-0.5">{scopeDescriptions[scope] ? t(scopeDescriptions[scope]) : t('Read access.')}</p>
                </li>
              ))}
            </ul>
            <p className="text-[0.75rem] text-text-tertiary mt-2">
              {t('You can say no to optional permissions; that data then shows as unavailable. We never post or read messages.')}{' '}
              <a href={META_DOCS_URL} target="_blank" rel="noopener noreferrer" className="underline">
                {t('Instagram API docs')}
              </a>
            </p>
          </div>
        </div>
      )}
      {actions.overlays}
    </Modal>
  );
}
