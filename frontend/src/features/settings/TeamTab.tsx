import { useMemo, useState } from 'react';
import { useAuth } from '@/app/AuthContext';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Overlay';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { modeText } from '@/lib/config';
import { cn } from '@/lib/format';
import { sessionUser, workspaceService } from '@/services/workspace';
import type { TeamMember } from '@/types/domain';
import { InviteMemberModal } from './InviteMemberModal';
import { ConfirmModal, roleLabel, SectionTitle } from './settingsUi';

type Access = TeamMember['access'];
export type AssignableAccess = Exclude<Access, 'Owner'>;

export const accessStyles: Record<Access, string> = {
  Owner: 'bg-amber-900/40 text-amber-300 border-amber-800',
  Admin: 'bg-purple-900/40 text-purple-300 border-purple-800',
  Editor: 'bg-sky-900/40 text-sky-300 border-sky-800',
  Viewer: 'bg-slate-800 text-slate-300 border-slate-800',
};

/** What each role can do (English; translate with t()). */
export const accessDescriptions: Record<Access, string> = {
  Owner: msg('Everything, including roles and billing.'),
  Admin: msg('Campaigns, Instagram accounts, team and settings.'),
  Editor: msg('Dashboards, reports, AI insights, content and comments.'),
  Viewer: msg('Can look at everything but not change it.'),
};

const SEAT_LIMIT = 10;

export function TeamTab() {
  const t = useT();
  const toast = useToast();
  const auth = useAuth();
  const youId = auth.me?.member.id ?? sessionUser.id;
  const canManage = auth.can('team:manage');
  const canManageAdmins = auth.can('admins:manage');
  const teamQ = useQuery('workspace:team', workspaceService.team);
  const [filter, setFilter] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [editAccess, setEditAccess] = useState<AssignableAccess>('Editor');
  const [removing, setRemoving] = useState<TeamMember | null>(null);

  const updateAccess = useMutation(workspaceService.updateMemberAccess, {
    invalidate: ['workspace', 'activity'],
    onSuccess: (m) => {
      toast({ title: t('Role updated'), description: t('{name} is now {role}.', { name: m.name, role: t(roleLabel(m.access)) }) });
      setEditing(null);
    },
    onError: (e) => toast({ tone: 'error', title: t('Could not change the role'), description: e.message }),
  });
  const approve = useMutation(workspaceService.approveMember, {
    invalidate: ['workspace', 'activity'],
    onSuccess: (m) => toast({ tone: 'success', title: t('Sign-up approved'), description: t('{name} can now sign in as {role}.', { name: m.name, role: t(roleLabel(m.access)) }) }),
    onError: (e) => toast({ tone: 'error', title: t('Could not approve'), description: e.message }),
  });
  const remove = useMutation(workspaceService.removeMember, {
    invalidate: ['workspace', 'activity'],
    onSuccess: () => {
      toast({
        tone: 'demo',
        title: removing?.status === 'pending' ? t('Sign-up declined') : removing?.status === 'invited' ? t('Invitation cancelled') : t('Member removed'),
        description: modeText(t('Demo only: refreshing the page brings the sample team back.'), t('Removed from this workspace.')),
      });
      setRemoving(null);
    },
    onError: (e) => toast({ tone: 'error', title: t('Could not remove member'), description: e.message }),
  });

  const team = useMemo(() => teamQ.data ?? [], [teamQ.data]);
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? team.filter((m) => [m.name, m.email, m.role, m.access].join(' ').toLowerCase().includes(q)) : team;
  }, [team, filter]);
  const active = team.filter((m) => m.status === 'active').length;
  const invitedCount = team.filter((m) => m.status === 'invited').length;
  const awaitingCount = team.filter((m) => m.status === 'pending').length;

  const statusLabel = (m: TeamMember) =>
    m.status === 'pending' ? t('Waiting for approval') : m.status === 'invited' ? t('Invited') : m.status === 'active' ? t('Active') : t('Suspended');

  return (
    <section className="flex flex-col gap-6">
      <div className="bg-surface-card border border-border-strong rounded-xl shadow-card overflow-hidden">
        <div className="p-5 pb-4">
          <SectionTitle
            className="mb-3"
            title={t('Team members')}
            subtitle={t('{used} of {limit} seats used · {active} active · {invited} invited', { used: team.length, limit: SEAT_LIMIT, active, invited: invitedCount })}
            actions={
              <Button
                variant="primary"
                icon="person_add"
                disabled={team.length >= SEAT_LIMIT || !canManage}
                title={!canManage ? t('Only owners and admins can invite people.') : team.length >= SEAT_LIMIT ? t('All seats are used.') : undefined}
                onClick={() => setInviteOpen(true)}
              >
                {t('Invite member')}
              </Button>
            }
          />
          {awaitingCount > 0 && (
            <p className="mb-3 flex items-center gap-1.5 rounded-full bg-amber-900/30 border border-amber-800 text-amber-300 text-body-sm px-3 py-1 w-fit">
              <Icon name="hourglass_top" className="text-[1rem]" />
              {t('{count} sign-ups waiting for approval', { count: awaitingCount })}
            </p>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <input
              type="search"
              aria-label={t('Search team members')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-9 px-3 text-sm rounded-lg bg-slate-950 border border-slate-700 text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focused w-full sm:w-64"
              placeholder={t('Search by name or email')}
            />
            <details className="text-body-sm text-text-secondary">
              <summary className="cursor-pointer select-none hover:text-text-primary">{t('What can each role do?')}</summary>
              <ul className="mt-2 space-y-1">
                {(Object.keys(accessDescriptions) as Access[]).map((a) => (
                  <li key={a}>
                    <span className="font-semibold text-text-primary">{t(roleLabel(a))}:</span> {t(accessDescriptions[a])}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>
        <QueryState
          query={teamQ}
          loading={
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          }
          empty={<p className="p-6 text-center text-body-sm text-text-secondary">{t('No team members yet. Invite your first teammate.')}</p>}
        >
          {() => (
            <div className="overflow-x-auto custom-scrollbar border-t border-border-strong">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="text-text-secondary text-label-sm font-semibold">
                    <th className="py-3 px-5">{t('Member')}</th>
                    <th className="py-3 px-5">{t('Role')}</th>
                    <th className="py-3 px-5">{t('Status')}</th>
                    <th className="py-3 px-5">{t('Last active')}</th>
                    <th className="py-3 px-5 text-right">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-body-md">
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 px-5 text-center text-body-sm text-text-secondary">
                        {t('No members match “{query}”.', { query: filter })}
                      </td>
                    </tr>
                  )}
                  {visible.map((m) => {
                    const you = m.id === youId;
                    const manageable = canManage && !you && (m.access !== 'Admin' || canManageAdmins);
                    const invited = m.status === 'invited';
                    const awaiting = m.status === 'pending';
                    return (
                      <tr key={m.id} className={cn('transition-colors', awaiting ? 'bg-amber-900/20 hover:bg-amber-900/30' : 'hover:bg-surface-canvas')}>
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-3">
                            <Avatar name={m.name} src={m.avatarUrl} className={invited || awaiting ? 'border-dashed border-amber-400' : undefined} />
                            <div className="min-w-0">
                              <div className="font-semibold text-text-primary flex items-center gap-1.5">
                                <span>{m.name}</span>
                                {you && <span className="text-[0.6875rem] bg-amber-900/40 text-amber-300 px-1.5 rounded-full">{t('You')}</span>}
                              </div>
                              <div className="text-xs text-text-tertiary">
                                {m.email}
                                {m.role ? ` · ${m.role}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-5">
                          <span className={cn('text-label-sm font-semibold px-2 py-0.5 rounded-full border', accessStyles[m.access])}>{t(roleLabel(m.access))}</span>
                        </td>
                        <td className="py-3 px-5">
                          <span className="flex items-center gap-1.5 text-label-sm">
                            <span className={cn('w-2 h-2 rounded-full', invited || awaiting ? 'bg-gold' : m.status === 'active' ? 'bg-status-active' : 'bg-text-tertiary')} />
                            <span className={invited || awaiting ? 'text-amber-300 font-medium' : 'text-text-primary'}>{statusLabel(m)}</span>
                          </span>
                        </td>
                        <td className="py-3 px-5 text-xs text-text-secondary">{you ? t('Now') : m.lastActive}</td>
                        <td className="py-3 px-5 text-right whitespace-nowrap">
                          {m.access === 'Owner' || !manageable ? (
                            <span className="text-label-sm text-text-tertiary">—</span>
                          ) : awaiting ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button size="xs" variant="primary" icon="check" disabled={approve.isPending} onClick={() => approve.mutate(m.id)}>
                                {t('Approve')}
                              </Button>
                              <Button size="xs" variant="ghost" onClick={() => setRemoving(m)}>
                                {t('Decline')}
                              </Button>
                            </div>
                          ) : invited ? (
                            <div className="flex items-center justify-end gap-3">
                              <button
                                type="button"
                                className="text-label-sm text-primary font-medium hover:underline"
                                onClick={() => toast({ tone: 'demo', title: t('Invite not sent again'), description: t('There is no email service yet, so nothing was sent to {email}.', { email: m.email }) })}
                              >
                                {t('Resend')}
                              </button>
                              <button type="button" className="text-label-sm text-error hover:underline" onClick={() => setRemoving(m)}>
                                {t('Cancel invite')}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-3">
                              <button
                                type="button"
                                className="text-label-sm text-text-secondary hover:text-text-primary"
                                onClick={() => {
                                  setEditing(m);
                                  setEditAccess(m.access as AssignableAccess);
                                }}
                              >
                                {t('Change role')}
                              </button>
                              <button type="button" className="text-label-sm text-error hover:underline" onClick={() => setRemoving(m)}>
                                {t('Remove')}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </div>

      <InviteMemberModal open={inviteOpen} onClose={() => setInviteOpen(false)} existingEmails={team.map((m) => m.email.toLowerCase())} canGrantAdmin={canManageAdmins} />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        size="sm"
        icon="manage_accounts"
        title={t('Change role')}
        subtitle={editing ? `${editing.name} · ${editing.email}` : undefined}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>{t('Cancel')}</Button>
            <Button
              variant="primary"
              loading={updateAccess.isPending}
              disabled={!editing || editing.access === editAccess}
              onClick={() => editing && updateAccess.mutate(editing.id, editAccess)}
            >
              {t('Save role')}
            </Button>
          </>
        }
      >
        <label htmlFor="edit-access" className="block text-label-sm font-semibold text-text-primary mb-1">
          {t('Role')}
        </label>
        <Select id="edit-access" className="w-full" value={editAccess} onChange={(e) => setEditAccess(e.target.value as AssignableAccess)}>
          {((canManageAdmins ? ['Admin', 'Editor', 'Viewer'] : ['Editor', 'Viewer']) as AssignableAccess[]).map((a) => (
            <option key={a} value={a}>
              {t(roleLabel(a))}
            </option>
          ))}
        </Select>
        <p className="text-body-sm text-text-secondary mt-2">{t(accessDescriptions[editAccess])}</p>
      </Modal>

      <ConfirmModal
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.id)}
        loading={remove.isPending}
        title={removing?.status === 'pending' ? t('Decline this sign-up?') : removing?.status === 'invited' ? t('Cancel this invitation?') : t('Remove this member?')}
        confirmLabel={removing?.status === 'pending' ? t('Decline') : removing?.status === 'invited' ? t('Cancel invite') : t('Remove member')}
        icon="person_remove"
      >
        <p>
          {removing?.status === 'pending'
            ? t('{email} will not get access. They can apply again later.', { email: removing?.email ?? '' })
            : removing?.status === 'invited'
              ? t('The invitation for {email} will stop working.', { email: removing?.email ?? '' })
              : t('{name} will lose access to this workspace.', { name: removing?.name ?? '' })}
        </p>
        <p className="text-text-tertiary">{modeText(t('Demo only: this changes the sample team for this session.'), t('No outside account is deleted.'))}</p>
      </ConfirmModal>
    </section>
  );
}
