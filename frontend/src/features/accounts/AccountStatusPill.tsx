import { Icon } from '@/components/ui/Icon';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { AccountStatus } from '@/types/domain';

const styles: Record<AccountStatus, { label: string; cls: string; dot?: string; icon?: string }> = {
  connected: { label: msg('Connected'), cls: 'bg-status-active-subtle border-emerald-800 text-status-active font-semibold', dot: 'bg-status-active' },
  action_required: { label: msg('Needs reconnect'), cls: 'bg-status-paused-subtle border-amber-800 text-status-paused font-bold', icon: 'warning' },
  expired: { label: msg('Expired'), cls: 'bg-surface-card-subtle border-border-strong text-status-draft font-semibold', dot: 'bg-slate-600' },
  syncing: { label: msg('Syncing'), cls: 'bg-status-completed-subtle border-sky-800 text-status-completed font-semibold', icon: 'sync' },
};

/** Account status pill (optionally prefixed on the detail header). */
export function AccountStatusPill({ status, prefix, className }: { status: AccountStatus; prefix?: string; className?: string }) {
  const t = useT();
  const s = styles[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-label-sm font-label-sm border whitespace-nowrap', s.cls, className)}>
      {s.dot && <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />}
      {s.icon && <Icon name={s.icon} className="text-[0.8125rem]" />}
      {prefix}
      {t(s.label)}
    </span>
  );
}

/** English status label; translate with t(). */
export const accountStatusLabel = (status: AccountStatus) => styles[status].label;
