import { useState } from 'react';
import { useAuth } from '@/app/AuthContext';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Misc';
import { useToast } from '@/components/ui/Toast';
import { useT } from '@/i18n/I18nContext';
import { sessionUser } from '@/services/workspace';
import type { SettingsSession } from '@/types/settings';
import { ApiSecurityTab } from './ApiSecurityTab';
import { ConfirmModal, roleLabel, SectionTitle, SettingsCard } from './settingsUi';

export function SecurityTab(props: { session?: SettingsSession; retentionDays: number }) {
  const { status } = useAuth();
  // api mode: real password change + server sessions. demo mode: the honest prototype stubs below.
  return status === 'demo' ? <DemoSecurityTab {...props} /> : <ApiSecurityTab retentionDays={props.retentionDays} />;
}

function DemoSecurityTab({ session, retentionDays }: { session?: SettingsSession; retentionDays: number }) {
  const t = useT();
  const toast = useToast();
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const promises = [
    t('Instagram direct messages and passwords are never asked for.'),
    t('Activity is kept for {days} days.', { days: retentionDays }),
    t('This demo keeps sample data in your browser only.'),
  ];

  return (
    <section className="flex flex-col gap-6">
      <SettingsCard>
        <SectionTitle title={t('Your account')} subtitle={t('Demo mode uses a fixed sample user.')} />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar name={sessionUser.name} src={sessionUser.avatarUrl} size="sm" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-label-md font-bold text-text-primary">{sessionUser.name}</span>
                <span className="text-[0.6875rem] bg-emerald-900/40 text-emerald-300 px-2 py-0.5 rounded-full">{t('This device')}</span>
              </div>
              <div className="text-xs text-text-secondary">
                {sessionUser.role} · {t(roleLabel(sessionUser.access))}
              </div>
              <div className="text-[0.6875rem] text-text-tertiary mt-0.5">
                {session?.device ?? t('This browser')}
                {session?.startedAt ? ` · ${session.startedAt}` : ''}
              </div>
            </div>
          </div>
          <Button icon="logout" onClick={() => toast({ tone: 'demo', title: t('Sign-out not available'), description: t('The demo always uses the same sample user.') })}>
            {t('Sign out')}
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard>
        <SectionTitle
          title={t('Privacy')}
          actions={
            <Button size="sm" variant="danger" icon="logout" onClick={() => setConfirmRevoke(true)}>
              {t('Sign out other devices')}
            </Button>
          }
        />
        <ul className="space-y-2 text-body-sm text-text-secondary">
          {promises.map((p) => (
            <li key={p} className="flex items-start gap-2">
              <Icon name="verified" className="text-[1rem] text-emerald-400 mt-0.5" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </SettingsCard>

      <ConfirmModal
        open={confirmRevoke}
        onClose={() => setConfirmRevoke(false)}
        onConfirm={() => {
          setConfirmRevoke(false);
          toast({ tone: 'demo', title: t('Nothing was signed out'), description: t('The demo has no other devices to sign out.') });
        }}
        title={t('Sign out other devices?')}
        confirmLabel={t('Sign them out')}
        icon="logout"
      >
        <p>{t('Every other device would need to sign in again.')}</p>
        <p className="text-text-tertiary">{t('Demo only: nothing changes.')}</p>
      </ConfirmModal>
    </section>
  );
}
