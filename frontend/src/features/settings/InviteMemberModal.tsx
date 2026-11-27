import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useMutation';
import { msg, useT } from '@/i18n/I18nContext';
import { isDemoMode } from '@/lib/config';
import { workspaceService } from '@/services/workspace';
import type { TeamMember } from '@/types/domain';
import { FieldError, inputCls, labelCls } from './settingsUi';

type AssignableAccess = Exclude<TeamMember['access'], 'Owner'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const roleOptions: Array<{ value: AssignableAccess; label: string }> = [
  { value: 'Editor', label: msg('Editor: reports, AI and content') },
  { value: 'Viewer', label: msg('Viewer: can look, not change') },
  { value: 'Admin', label: msg('Admin: full control') },
];

export function InviteMemberModal({ open, onClose, existingEmails, canGrantAdmin = true }: { open: boolean; onClose: () => void; existingEmails: string[]; canGrantAdmin?: boolean }) {
  const t = useT();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [access, setAccess] = useState<AssignableAccess>('Editor');
  const [touched, setTouched] = useState(false);
  // api mode: the one-time invitation link returned by the server (no email service exists yet).
  const [issued, setIssued] = useState<{ email: string; url: string; hours: number } | null>(null);

  useEffect(() => {
    if (open) {
      setIssued(null);
      setEmail('');
      setJobTitle('');
      setAccess('Editor');
      setTouched(false);
    }
  }, [open]);

  const trimmed = email.trim().toLowerCase();
  const error = !trimmed
    ? t('Enter a work email address.')
    : !EMAIL_RE.test(trimmed)
      ? t('Enter a valid email, like name@eko.co.in.')
      : existingEmails.includes(trimmed)
        ? t('This person is already a member or invited.')
        : undefined;

  const invite = useMutation(workspaceService.inviteMember, {
    invalidate: ['workspace', 'activity'],
    onSuccess: (m) => {
      const withLink = m as TeamMember & { inviteUrl?: string; inviteExpiresInHours?: number };
      if (!isDemoMode && withLink.inviteUrl) {
        setIssued({ email: m.email, url: withLink.inviteUrl, hours: withLink.inviteExpiresInHours ?? 72 });
        return;
      }
      toast({ tone: 'demo', title: t('{email} invited', { email: m.email }), description: t('Demo only: added to the sample team. No email was sent.') });
      onClose();
    },
    onError: (e) => toast({ tone: 'error', title: t('Invite failed'), description: e.message }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (error) return;
    invite.mutate({ email: trimmed, access, role: jobTitle });
  };

  if (issued) {
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(issued.url);
        toast({ title: t('Link copied') });
      } catch {
        toast({ tone: 'error', title: t('Copy failed'), description: t('Select the link and copy it yourself.') });
      }
    };
    return (
      <Modal
        open={open}
        onClose={onClose}
        size="sm"
        icon="link"
        title={t('Invitation ready')}
        subtitle={t('Send this one-time link to {email}.', { email: issued.email })}
        footer={
          <>
            <Button onClick={() => void copy()} icon="content_copy">
              {t('Copy link')}
            </Button>
            <Button variant="primary" onClick={onClose}>
              {t('Done')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label htmlFor="invite-link" className={labelCls}>
            {t('Invitation link')}
          </label>
          <input id="invite-link" readOnly value={issued.url} onFocus={(e) => e.currentTarget.select()} className={`${inputCls} font-mono text-xs`} />
          <p className="text-xs text-text-secondary">
            {t('No email was sent. The link works once, expires in {hours} hours and is shown only now.', { hours: issued.hours })}
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      icon="person_add"
      title={t('Invite member')}
      subtitle={t('Add a teammate to this workspace.')}
      footer={
        <>
          <Button onClick={onClose}>{t('Cancel')}</Button>
          <Button variant="primary" type="submit" form="invite-member-form" loading={invite.isPending}>
            {t('Send invite')}
          </Button>
        </>
      }
    >
      <form id="invite-member-form" onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="invite-email" className={labelCls}>
            {t('Work email')} <span className="text-error">*</span>
          </label>
          <input
            id="invite-email"
            type="email"
            data-autofocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={touched && !!error}
            placeholder={t('name@eko.co.in')}
            className={`${inputCls} font-normal ${touched && error ? 'border-error' : ''}`}
          />
          {touched && <FieldError message={error} />}
        </div>
        <div>
          <label htmlFor="invite-title" className={labelCls}>
            {t('Job title')} <span className="text-text-tertiary font-normal">({t('optional')})</span>
          </label>
          <input id="invite-title" type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder={t('e.g. Campaign analyst')} className={`${inputCls} font-normal`} />
        </div>
        <div>
          <label htmlFor="invite-role" className={labelCls}>
            {t('Role')}
          </label>
          <select id="invite-role" className={inputCls} value={access} onChange={(e) => setAccess(e.target.value as AssignableAccess)}>
            {roleOptions.filter((o) => canGrantAdmin || o.value !== 'Admin').map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.label)}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-text-secondary">
          {isDemoMode ? t('Demo only: the person is added to the sample team. No email is sent.') : t('You will get a one-time link to share. No email is sent.')}
        </p>
      </form>
    </Modal>
  );
}
