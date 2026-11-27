import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { msg, useT } from '@/i18n/I18nContext';
import { cn, formatDate, initials } from '@/lib/format';
import type { ActivityActor, ActivityCategory, ActivityEntry, ActivityOutcome, ActivityTarget } from '@/types/activity';

/* ------------------------------- Labels / options ------------------------------ */

/** Labels are English source text (msg-marked): translate with t() where rendered; the CSV keeps English. */

export const categoryLabels: Record<ActivityCategory, string> = {
  data_sync: msg('Data sync'),
  campaigns: msg('Campaigns'),
  content: msg('Posts'),
  ai: msg('AI'),
  reports: msg('Reports'),
  leads: msg('Leads and comments'),
  security: msg('Security and accounts'),
  settings: msg('Settings'),
};

export const outcomeLabels: Record<ActivityOutcome, string> = {
  success: msg('Done'),
  in_progress: msg('Running'),
  warning: msg('Needs attention'),
  failed: msg('Failed'),
  resolved: msg('Fixed'),
};

export type OutcomeFilter = ActivityOutcome | 'issues' | '';
export type DateScope = 'period' | '7d' | 'today' | 'all';

export const dateScopes: Record<DateScope, { label: string; from?: string; to?: string }> = {
  period: { label: msg('Oct 1 – 31, 2024'), from: '2024-10-01', to: '2024-10-31' },
  '7d': { label: msg('Last 7 days'), from: '2024-10-25', to: '2024-10-31' },
  today: { label: msg('Today'), from: '2024-10-31', to: '2024-10-31' },
  all: { label: msg('All time') },
};

export interface ActivityFilterState {
  search: string;
  category: ActivityCategory | '';
  outcome: OutcomeFilter;
  /** Actor id, or "kind:member" / "kind:automated". */
  actor: string;
  account: string;
  date: DateScope;
}

export const defaultFilters: ActivityFilterState = { search: '', category: '', outcome: '', actor: '', account: '', date: 'period' };

/* ------------------------------------ Time ------------------------------------ */

const WEEKDAYS = [msg('Sunday'), msg('Monday'), msg('Tuesday'), msg('Wednesday'), msg('Thursday'), msg('Friday'), msg('Saturday')];

/** "2024-10-31T10:30:14" → { date: "Oct 31, 2024", time: "10:30:14 AM IST" } (values are already IST). */
export function formatIst(ts: string) {
  const [h, m, s] = ts.slice(11, 19).split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const time = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${suffix}`;
  return { date: formatDate(ts), time: `${time} IST`, short: time };
}

/** English weekday (msg-marked); translate with t() where rendered. */
export function weekdayLabel(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/* ------------------------------------ Pills ----------------------------------- */

const kindTones = {
  neutral: 'bg-surface-card-subtle text-text-secondary border border-border-strong',
  ai: 'bg-ai-subtle text-ai-accent border border-ai-border',
  warning: 'bg-status-paused-subtle text-status-paused border border-amber-800',
};

export function KindPill({ entry }: { entry: ActivityEntry }) {
  const iconClass = entry.kindTone === 'ai' ? 'text-ai-accent' : entry.kindTone === 'warning' ? 'text-status-paused' : entry.kindIconClass;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold', kindTones[entry.kindTone])}>
      <Icon name={entry.kindIcon} className={cn('text-[0.8125rem]', iconClass)} />
      <span>{entry.kind}</span>
    </span>
  );
}

const outcomeStyles: Record<ActivityOutcome, { pill: string; dot: string }> = {
  success: { pill: 'bg-status-active-subtle text-status-active border border-emerald-800', dot: 'bg-status-active' },
  in_progress: { pill: 'bg-tertiary-fixed/30 text-tertiary border border-tertiary/20', dot: 'bg-tertiary animate-pulse' },
  warning: { pill: 'bg-status-paused-subtle text-status-paused border border-amber-800', dot: 'bg-status-paused' },
  failed: { pill: 'bg-error-container/60 text-error border border-error/20', dot: 'bg-error' },
  resolved: { pill: 'bg-status-completed-subtle text-status-completed border border-sky-800', dot: 'bg-status-completed' },
};

/** Friendly translated outcome; the record's own label (e.g. "Action Req.") is kept as a tooltip. */
export function OutcomePill({ entry }: { entry: Pick<ActivityEntry, 'outcome' | 'outcomeLabel'> }) {
  const t = useT();
  const s = outcomeStyles[entry.outcome];
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold whitespace-nowrap', s.pill)} title={entry.outcomeLabel}>
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
      <span>{t(outcomeLabels[entry.outcome])}</span>
    </span>
  );
}

export const outcomeTextClass: Record<ActivityOutcome, string> = {
  success: 'text-status-active',
  in_progress: 'text-tertiary',
  warning: 'text-status-paused',
  failed: 'text-error',
  resolved: 'text-status-completed',
};

export const rowTint: Partial<Record<ActivityOutcome, string>> = {
  warning: 'bg-amber-900/20',
  resolved: 'bg-amber-900/20',
  failed: 'bg-rose-900/20',
};

export function ActorCell({ actor }: { actor?: ActivityActor }) {
  const t = useT();
  if (!actor) return <span className="text-text-tertiary text-[0.75rem]">{t('Unknown')}</span>;
  if (actor.kind === 'member') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-4 h-4 rounded-full bg-surface-container-high text-[0.5625rem] font-bold flex items-center justify-center shrink-0">{initials(actor.name)}</span>
        <span className="text-text-secondary font-medium text-[0.75rem]">{actor.shortLabel}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Icon name={actor.icon ?? 'memory'} className={cn('text-[0.9375rem]', actor.kind === 'ai' ? 'text-ai-accent' : 'text-text-tertiary')} />
      <span className="text-text-secondary text-[0.75rem]">{actor.shortLabel}</span>
    </div>
  );
}

export function TargetChip({ target }: { target: ActivityTarget }) {
  const t = useT();
  const cls = cn(
    'text-[0.75rem] bg-surface-canvas px-2 py-0.5 rounded-full',
    target.emphasis === 'strong' && 'font-semibold text-text-primary',
    target.emphasis === 'warning' && 'text-status-paused font-semibold',
    !target.emphasis && 'text-text-secondary',
  );
  if (!target.to) return <span className={cls}>{target.label}</span>;
  return (
    <Link
      to={target.to}
      onClick={(e: MouseEvent) => e.stopPropagation()}
      className={cn(cls, 'hover:text-text-primary hover:underline transition-colors')}
      title={target.module ? t('Open {name}', { name: target.module }) : undefined}
    >
      {target.label}
    </Link>
  );
}

/* ------------------------------------- CSV ------------------------------------ */

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Client-side CSV of the given (filtered) entries. Demo data only — generated in the browser. */
export function downloadActivityCsv(entries: ActivityEntry[], actorLookup: (id: string) => ActivityActor | undefined) {
  const header = ['event_id', 'timestamp_ist', 'category', 'event_type', 'title', 'summary', 'related_entity', 'entity_route', 'actor', 'actor_type', 'outcome', 'response_status'];
  const lines = entries.map((e) => {
    const actor = actorLookup(e.actorId);
    return [
      e.id,
      e.timestamp.replace('T', ' '),
      categoryLabels[e.category],
      e.kind,
      e.title,
      e.summary,
      e.target.label,
      e.target.to ?? '',
      actor?.name ?? e.actorId,
      actor?.kind === 'member' ? 'operator' : 'automated',
      e.outcomeLabel ?? outcomeLabels[e.outcome],
      e.responseStatus,
    ]
      .map(csvCell)
      .join(',');
  });
  const csv = ['# SocialBoard audit log export - DEMO DATA generated in your browser from prototype sample records (not retrieved from Meta or any server)', header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'socialboard-audit-log-demo.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
