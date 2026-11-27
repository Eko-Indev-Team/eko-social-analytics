import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Misc';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { useT, type Translate } from '@/i18n/I18nContext';
import { authService } from '@/services/auth';
import type { AuthSessionInfo } from '@/types/auth';
import { ConfirmModal, FieldError, inputCls, labelCls, roleLabel, SectionTitle, SettingsCard } from './settingsUi';

const MIN_LENGTH = 12;

function when(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function device(s: AuthSessionInfo, t: Translate) {
  const ua = s.userAgent ?? '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : t('Browser');
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '';
  if (!ua) return t('Unknown device');
  return os ? t('{browser} on {os}', { browser, os }) : browser;
}

/** Security settings backed by the real auth API: identity, password change, sessions and revocation. */
export function ApiSecurityTab({ retentionDays }: { retentionDays: number }) {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const { me, logout } = useAuth();
  const sessionsQ = useQuery('auth:sessions', authService.sessions);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [touched, setTouched] = useState(false);
  const pwError = !current
    ? t('Enter your current password.')
    : next.length < MIN_LENGTH
      ? t('The new password needs at least {count} characters.', { count: MIN_LENGTH })
      : next !== repeat
        ? t('The new passwords do not match.')
        : undefined;

  const changePassword = useMutation((v: { current: string; next: string }) => authService.changePassword(v.current, v.next), {
    invalidate: ['auth:sessions'],
    onSuccess: (r) => {
      setCurrent('');
      setNext('');
      setRepeat('');
      setTouched(false);
      toast({
        tone: 'success',
        title: t('Password changed'),
        description: r.revokedSessions ? t('Other devices signed out: {count}', { count: r.revokedSessions }) : t('You stay signed in here.'),
      });
    },
    onError: (e) => {
      setCurrent('');
      toast({ tone: 'error', title: t('Password not changed'), description: e.message });
    },
  });
  const revokeOne = useMutation(authService.revokeSession, {
    invalidate: ['auth:sessions'],
    onSuccess: () => toast({ tone: 'success', title: t('Device signed out'), description: t('That device must sign in again.') }),
    onError: (e) => toast({ tone: 'error', title: t('Could not sign out that device'), description: e.message }),
  });
  const revokeOthers = useMutation(() => authService.revokeOtherSessions(), {
    invalidate: ['auth:sessions'],
    onSuccess: (r) => {
      setConfirmRevokeAll(false);
      toast({ tone: 'success', title: t('Other devices signed out'), description: t('Devices signed out: {count}', { count: r.revoked }) });
    },
    onError: (e) => toast({ tone: 'error', title: t('Could not sign out other devices'), description: e.message }),
  });

  const submitPassword = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (pwError || changePassword.isPending) return;
    changePassword.mutate({ current, next });
  };

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const others = (sessionsQ.data ?? []).filter((s) => !s.current);

  return (
    <section className="flex flex-col gap-6">
      <SettingsCard>
        <SectionTitle title={t('Your account')} />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar name={me?.user.name ?? ''} size="sm" />
            <div>
              <div className="text-label-md font-bold text-text-primary">{me?.user.name}</div>
              <div className="text-xs text-text-secondary">
                {me ? t('{email} · {role} in {workspace}', { email: me.user.email, role: t(roleLabel(me.role)), workspace: me.workspace.name }) : null}
              </div>
              {me && <div className="text-[0.6875rem] text-text-tertiary mt-0.5">{t('Signed in until {date} at the latest.', { date: when(me.session.absoluteExpiresAt) })}</div>}
            </div>
          </div>
          <Button icon="logout" onClick={() => void signOut()}>
            {t('Sign out')}
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard>
        <SectionTitle title={t('Change password')} subtitle={t('This signs you out on all other devices.')} />
        <form onSubmit={submitPassword} noValidate className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
          <div>
            <label htmlFor="pw-current" className={labelCls}>
              {t('Current password')}
            </label>
            <input id="pw-current" type="password" autoComplete="current-password" className={inputCls} value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pw-new" className={labelCls}>
              {t('New password')}
            </label>
            <input id="pw-new" type="password" autoComplete="new-password" className={inputCls} value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pw-repeat" className={labelCls}>
              {t('Repeat new password')}
            </label>
            <input id="pw-repeat" type="password" autoComplete="new-password" className={inputCls} value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          </div>
          <div className="md:col-span-3 flex items-center justify-between gap-3 flex-wrap">
            <div>
              {touched ? (
                <FieldError message={pwError} />
              ) : (
                <span className="text-[0.6875rem] text-text-tertiary">{t('At least {count} characters.', { count: MIN_LENGTH })}</span>
              )}
            </div>
            <Button type="submit" variant="primary" loading={changePassword.isPending}>
              {t('Update password')}
            </Button>
          </div>
        </form>
      </SettingsCard>

      <SettingsCard>
        <SectionTitle
          title={t('Signed-in devices')}
          subtitle={t('Where your account is signed in now.')}
          actions={
            <Button size="sm" variant="danger" icon="logout" disabled={others.length === 0} onClick={() => setConfirmRevokeAll(true)}>
              {t('Sign out other devices')}
            </Button>
          }
        />
        <QueryState query={sessionsQ} loading={<Skeleton className="h-16" />} empty={<p className="text-body-sm text-text-secondary">{t('No active sessions.')}</p>}>
          {(sessions) => (
            <ul className="divide-y divide-border-subtle">
              {sessions.map((s) => (
                <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <Icon name="devices" className="text-text-secondary mt-0.5" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-label-md font-semibold text-text-primary">{device(s, t)}</span>
                        {s.current && <span className="text-[0.6875rem] bg-emerald-900/40 text-emerald-300 px-2 py-0.5 rounded-full">{t('This device')}</span>}
                      </div>
                      <div className="text-[0.6875rem] text-text-tertiary">
                        {t('Last active {date}', { date: when(s.lastSeenAt) })}
                        {s.ipAddress ? ` · ${s.ipAddress}` : ''}
                      </div>
                    </div>
                  </div>
                  {!s.current && (
                    <Button size="xs" variant="ghost" disabled={revokeOne.isPending} onClick={() => revokeOne.mutate(s.id)}>
                      {t('Sign out')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </QueryState>

        <p className="mt-4 text-xs text-text-tertiary flex items-center gap-1.5">
          <Icon name="history" className="text-[1rem]" />
          {t('Sign-ins and account changes are kept in the activity log for {days} days.', { days: retentionDays })}
        </p>
      </SettingsCard>

      <ConfirmModal
        open={confirmRevokeAll}
        onClose={() => setConfirmRevokeAll(false)}
        onConfirm={() => void revokeOthers.mutate()}
        title={t('Sign out other devices?')}
        confirmLabel={t('Sign them out')}
        icon="logout"
      >
        <p>{t('Devices to sign out: {count}. This device stays signed in.', { count: others.length })}</p>
      </ConfirmModal>
    </section>
  );
}
