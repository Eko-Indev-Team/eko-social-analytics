import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { Badge, type Tone } from '@/components/ui/Badge';
import { QUALIFICATION_STATUSES, type QualificationStatus, type SbiReason } from '@/lib/qualification';
import type { QualificationCounts } from '@/types/ads';

/** Display order: best first. */
export const QUALIFICATION_ORDER = QUALIFICATION_STATUSES;

const META: Record<QualificationStatus, { label: string; tone: Tone; icon: string; bar: string; hint: string }> = {
  sbi_strong: {
    label: msg('Strongly qualified · SBI'),
    tone: 'active',
    icon: 'verified',
    bar: 'bg-status-active',
    hint: msg('Right pincode, 12th pass or more, and can invest.'),
  },
  esaf_strong: {
    label: msg('Strongly qualified · ESAF'),
    tone: 'completed',
    icon: 'verified',
    bar: 'bg-status-completed',
    hint: msg('Not a fit for SBI, but said yes to ESAF (no investment needed).'),
  },
  esaf_pitch: {
    label: msg('Pitch ESAF'),
    tone: 'amber',
    icon: 'campaign',
    bar: 'bg-gold',
    hint: msg('Not a fit for SBI. Call and offer ESAF (no investment needed).'),
  },
  needs_info: {
    label: msg('Check details'),
    tone: 'ai',
    icon: 'help',
    bar: 'bg-ai-accent',
    hint: msg('Some answers are missing. Call to check.'),
  },
  not_qualified: {
    label: msg('Not qualified'),
    tone: 'draft',
    icon: 'block',
    bar: 'bg-text-tertiary',
    hint: msg('Below 12th, or said no to ESAF.'),
  },
};

/** English label (msg-marked); translate with t() where rendered. */
export const qualificationLabel = (status: QualificationStatus) => META[status]?.label ?? status;
export const qualificationHint = (status: QualificationStatus) => META[status]?.hint ?? '';
export const qualificationTone = (status: QualificationStatus): Tone => META[status]?.tone ?? 'neutral';

export function QualificationBadge({ status, className }: { status: QualificationStatus | null | undefined; className?: string }) {
  const t = useT();
  if (!status || !META[status]) return <Badge className={className}>{t('Not checked')}</Badge>;
  const m = META[status];
  return (
    <span title={t(m.hint)} className="inline-flex">
      <Badge tone={m.tone} icon={m.icon} className={cn('gap-1', className)}>
        {t(m.label)}
      </Badge>
    </span>
  );
}

const REASONS: Record<SbiReason, string> = {
  pincode_mismatch: msg('Pincode is outside the SBI area'),
  pincode_unknown: msg('Pincode not known'),
  education_below_12th: msg('Studied below 12th'),
  education_unknown: msg('Education not known'),
  cannot_invest: msg('Cannot invest'),
  investment_unknown: msg('Investment answer missing'),
};

/** SBI reason code → plain words (msg-marked English). Unknown codes pass through. */
export const sbiReasonLabel = (reason: string) => REASONS[reason as SbiReason] ?? reason;

/** Why the lead is not SBI-strong, in plain words. Nothing for SBI-strong leads. */
export function ReasonList({ status, reasons, className }: { status: QualificationStatus; reasons: string[]; className?: string }) {
  const t = useT();
  if (status === 'sbi_strong' || reasons.length === 0) return null;
  return <span className={cn('text-[0.75rem] text-text-tertiary', className)}>{reasons.map((r) => t(sbiReasonLabel(r))).join(' · ')}</span>;
}

/** Stacked bar + legend of leads per status. `onSelect` makes legend items clickable (e.g. to filter). */
export function QualificationCountsBar({
  counts,
  onSelect,
  className,
}: {
  counts: QualificationCounts;
  onSelect?: (status: QualificationStatus) => void;
  className?: string;
}) {
  const t = useT();
  const total = QUALIFICATION_ORDER.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-card-subtle" role="img" aria-label={t('Leads by status')}>
        {total > 0 &&
          QUALIFICATION_ORDER.map((s) =>
            counts[s] ? <div key={s} className={META[s].bar} style={{ width: `${(counts[s] / total) * 100}%` }} title={`${t(META[s].label)}: ${counts[s]}`} /> : null,
          )}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {QUALIFICATION_ORDER.map((s) => {
          const value = counts[s] ?? 0;
          const pct = total ? Math.round((value / total) * 100) : 0;
          const body = (
            <>
              <span className="flex items-center gap-1.5 text-[0.75rem] text-text-secondary">
                <span className={cn('h-2 w-2 rounded-full shrink-0', META[s].bar)} />
                {t(META[s].label)}
              </span>
              <span className="font-heading text-[1.25rem] font-bold text-text-primary tnum">
                {value.toLocaleString('en-IN')} <span className="text-[0.75rem] font-medium text-text-tertiary">{pct}%</span>
              </span>
            </>
          );
          return (
            <li key={s}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(s)}
                  title={t(META[s].hint)}
                  className="w-full text-left flex flex-col gap-0.5 rounded-lg border border-border-strong px-3 py-2 hover:border-slate-600 hover:bg-surface-canvas transition-colors"
                >
                  {body}
                </button>
              ) : (
                <div className="flex flex-col gap-0.5 rounded-lg border border-border-strong px-3 py-2" title={t(META[s].hint)}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
