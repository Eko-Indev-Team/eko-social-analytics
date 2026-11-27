import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Overlay';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { TeamMember } from '@/types/domain';

const ROLE_LABELS: Record<TeamMember['access'], string> = {
  Owner: msg('Owner'),
  Admin: msg('Admin'),
  Editor: msg('Editor'),
  Viewer: msg('Viewer'),
};

/** English role label (translate with t()). */
export const roleLabel = (role: TeamMember['access']) => ROLE_LABELS[role] ?? role;

/** Export field styles (Settings screen inputs use 4px radius + focus ring). */
export const inputCls =
  'w-full h-9 px-3 text-sm rounded bg-slate-950 border border-slate-700 text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focused font-medium';
export const labelCls = 'block font-label-sm text-label-sm text-text-primary mb-1';

export function SettingsCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('bg-surface-card border border-border-strong rounded-xl shadow-card p-5', className)}>{children}</div>;
}

/** Card title with one short subtitle line and optional actions on the right. */
export function SectionTitle({ title, subtitle, actions, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 mb-4', className)}>
      <div className="min-w-0">
        <h2 className="font-heading text-[1.0625rem] font-semibold text-text-primary flex items-center gap-1.5">{title}</h2>
        {subtitle && <p className="text-body-sm text-text-secondary mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

/** Export-styled switch (brand amber or AI indigo track). */
export function Switch({
  checked,
  onChange,
  label,
  tone = 'brand',
  size = 'sm',
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  tone?: 'brand' | 'ai';
  size?: 'sm' | 'md';
  disabled?: boolean;
}) {
  const track = size === 'md' ? 'w-11 h-6' : 'w-10 h-5';
  const knob = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  const shift = size === 'md' ? 'translate-x-5' : 'translate-x-5';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
        track,
        checked ? (tone === 'ai' ? 'bg-ai-accent' : 'bg-primary-container') : 'bg-slate-700',
      )}
    >
      <span className={cn('absolute top-[2px] left-[2px] bg-white border rounded-full transition-transform', knob, checked ? `${shift} border-white` : 'border-slate-700')} />
    </button>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-[0.6875rem] text-error font-medium mt-1" role="alert">
      {message}
    </p>
  );
}

/** Confirmation dialog for destructive / irreversible-looking actions. */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
  icon = 'warning',
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  icon?: string;
  loading?: boolean;
}) {
  const t = useT();
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      icon={icon}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>{t('Cancel')}</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-body-sm text-text-secondary space-y-2">{children}</div>
    </Modal>
  );
}

/** Masked secret placeholder — the prototype holds no real tokens or keys. */
export const MASKED_SECRET = '•••• demo';
