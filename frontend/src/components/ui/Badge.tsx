import type { ReactNode } from 'react';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { CampaignHealth, CampaignStatus, LeadStatus } from '@/types/domain';
import { Icon } from './Icon';

/** Status chip: a soft pill (px-2 py-0.5 rounded-full text-[11px]) on a 40% tint. */
export type Tone = 'active' | 'paused' | 'draft' | 'completed' | 'scheduled' | 'ai' | 'error' | 'neutral' | 'amber';

// Brand status chips: a 40% tint with the -300 text step (section 4), re-themed for light mode by theme.css.
const tones: Record<Tone, { pill: string; dot: string }> = {
  active: { pill: 'bg-emerald-900/40 text-emerald-300', dot: 'bg-status-active' },
  paused: { pill: 'bg-amber-900/40 text-amber-300', dot: 'bg-status-paused' },
  draft: { pill: 'bg-slate-800 text-slate-300', dot: 'bg-status-draft' },
  completed: { pill: 'bg-sky-900/40 text-sky-300', dot: 'bg-status-completed' },
  scheduled: { pill: 'bg-sky-900/40 text-sky-300', dot: 'bg-tertiary' },
  ai: { pill: 'bg-purple-900/40 text-purple-300', dot: 'bg-ai-accent' },
  error: { pill: 'bg-rose-900/40 text-rose-300', dot: 'bg-error' },
  neutral: { pill: 'bg-slate-800 text-slate-300', dot: 'bg-text-tertiary' },
  amber: { pill: 'bg-amber-900/40 text-amber-300', dot: 'bg-gold' },
};

export function Badge({
  tone = 'neutral',
  dot,
  icon,
  iconFilled,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  icon?: string;
  iconFilled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const t = tones[tone];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap', t.pill, className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', t.dot)} />}
      {icon && <Icon name={icon} filled={iconFilled} className="text-[0.8125rem] -mx-0.5" />}
      {children}
    </span>
  );
}

/** Small "AI" marker (purple pill, spark icon). `label` is English source text and is translated here. */
export function AiBadge({ label = msg('Made by AI'), className }: { label?: string; className?: string }) {
  const t = useT();
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold bg-purple-900/40 text-purple-300 whitespace-nowrap',
        className,
      )}
    >
      <Icon name="auto_awesome" className="text-[0.75rem]" />
      {t(label)}
    </span>
  );
}

/** Small "Sample data" marker so sample values are never mistaken for live metrics. `label` is translated here. */
export function DemoBadge({ className, label = msg('Sample data') }: { className?: string; label?: string }) {
  const t = useT();
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold bg-slate-800 text-slate-300 whitespace-nowrap',
        className,
      )}
      title={t('Sample data, not from Instagram')}
    >
      <Icon name="science" className="text-[0.75rem]" />
      {t(label)}
    </span>
  );
}

const campaignStatus: Record<CampaignStatus, { tone: Tone; label: string }> = {
  active: { tone: 'active', label: msg('Active') },
  paused: { tone: 'paused', label: msg('Paused') },
  completed: { tone: 'completed', label: msg('Completed') },
  scheduled: { tone: 'scheduled', label: msg('Scheduled') },
  draft: { tone: 'draft', label: msg('Draft') },
};

export function CampaignStatusBadge({ status, className }: { status: CampaignStatus; className?: string }) {
  const t = useT();
  const s = campaignStatus[status];
  return (
    <Badge tone={s.tone} dot className={className}>
      {t(s.label)}
    </Badge>
  );
}

const health: Record<CampaignHealth, { tone: Tone; label: string; icon: string; filled?: boolean }> = {
  excellent: { tone: 'active', label: msg('Excellent'), icon: 'star', filled: true },
  good: { tone: 'completed', label: msg('Good'), icon: 'thumb_up' },
  needs_attention: { tone: 'paused', label: msg('Needs attention'), icon: 'warning' },
};

/** `fallback` is English source text (e.g. "Draft", "Not rated") and is translated here. */
export function HealthBadge({ value, fallback }: { value: CampaignHealth | null; fallback?: string }) {
  const t = useT();
  if (!value) return <Badge tone={fallback === 'Draft' ? 'draft' : 'neutral'}>{fallback ? t(fallback) : '—'}</Badge>;
  const h = health[value];
  return (
    <Badge tone={h.tone} icon={h.icon} iconFilled={h.filled} className="gap-1">
      {t(h.label)}
    </Badge>
  );
}

const leadStatus: Record<LeadStatus, { tone: Tone; label: string }> = {
  new: { tone: 'completed', label: msg('New') },
  contacted: { tone: 'paused', label: msg('Contacted') },
  qualified: { tone: 'ai', label: msg('Qualified') },
  converted: { tone: 'active', label: msg('Converted') },
  lost: { tone: 'draft', label: msg('Lost') },
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const t = useT();
  const s = leadStatus[status];
  return <Badge tone={s.tone}>{t(s.label)}</Badge>;
}

/** English source labels (msg-marked): translate with t() where rendered; CSV exports keep English. */
export const leadStatusLabel = (s: LeadStatus) => leadStatus[s].label;
export const campaignStatusLabel = (s: CampaignStatus) => campaignStatus[s].label;
