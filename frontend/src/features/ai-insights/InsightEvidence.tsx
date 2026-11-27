import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AiBadge, DemoBadge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { Insight, InsightReasoning, InsightTelemetry } from '@/types/insights';
import { RichText } from './insightMeta';

function SectionShell({ title, subtitle, tip, badge, children }: { title: string; subtitle?: string; tip?: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-surface-card border border-border-strong rounded-xl shadow-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{title}</h2>
            {tip && <InfoTip text={tip} />}
          </div>
          {subtitle && <p className="text-body-sm text-text-secondary mt-0.5">{subtitle}</p>}
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

/** Placeholder for sections without evidence in the demo dataset. */
export function MissingEvidence({ title, children }: { title: string; children?: ReactNode }) {
  const t = useT();
  return (
    <SectionShell title={title}>
      <div className="flex items-start gap-2.5 bg-surface-canvas rounded-lg p-3 text-body-sm text-text-secondary">
        <Icon name="science" className="text-[1.125rem] text-text-tertiary" />
        <div>
          <p className="font-semibold text-text-primary">{t('No details in the sample data')}</p>
          {children ?? <p className="mt-0.5">{t('This fills in once the server is connected.')}</p>}
        </div>
      </div>
    </SectionShell>
  );
}

const deltaTone = { positive: 'text-status-active', negative: 'text-error', neutral: 'text-text-tertiary' } as const;
const segTone = { active: 'bg-status-active', primary: 'bg-primary-container', muted: 'bg-border-strong' } as const;

/** 1. Observed performance telemetry (comparison table + optional retention breakdown). */
export function TelemetrySection({ telemetry: tel }: { telemetry: InsightTelemetry }) {
  const t = useT();
  return (
    <SectionShell title={tel.title} subtitle={tel.subtitle} tip={t('Measured numbers, not estimates.')} badge={<DemoBadge />}>
      <div className="overflow-x-auto custom-scrollbar border border-border-strong rounded-lg">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr className="bg-surface-canvas border-b border-border-strong">
              <th className="py-2.5 px-3.5 text-label-sm font-label-sm text-text-secondary">{t('Number')}</th>
              <th className="py-2.5 px-3.5 text-label-sm font-label-sm text-text-primary font-bold bg-amber-900/40 border-x border-border-strong">
                <span className="flex items-center gap-1">
                  <Icon name={tel.primaryIcon} className="text-[0.875rem] text-primary" />
                  {tel.primaryLabel}
                </span>
              </th>
              <th className="py-2.5 px-3.5 text-label-sm font-label-sm text-text-secondary">
                <span className="flex items-center gap-1">
                  <Icon name={tel.comparisonIcon} className="text-[0.875rem]" />
                  {tel.comparisonLabel}
                </span>
              </th>
              <th className="py-2.5 px-3.5 text-label-sm font-label-sm text-text-secondary text-right">{t('Change')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-strong font-body-sm text-body-sm">
            {tel.rows.map((r) => (
              <tr key={r.label} className={cn('hover:bg-surface-canvas', r.emphasis && 'bg-emerald-900/40')}>
                <td className={cn('py-2.5 px-3.5', r.emphasis ? 'font-bold text-text-primary' : 'font-medium text-text-secondary')}>{r.label}</td>
                <td className={cn('py-2.5 px-3.5 text-text-primary border-x border-border-strong tnum', r.emphasis ? 'font-extrabold bg-amber-900/40' : 'font-semibold bg-amber-900/20')}>
                  {r.primary} {r.primaryNote && <span className="font-normal text-xs text-text-secondary">{r.primaryNote}</span>}
                </td>
                <td className={cn('py-2.5 px-3.5 text-text-secondary tnum', r.emphasis && 'font-semibold')}>
                  {r.comparison} {r.comparisonNote && <span className="font-normal text-xs text-text-tertiary">{r.comparisonNote}</span>}
                </td>
                <td className={cn('py-2.5 px-3.5 text-right tnum', r.emphasis ? 'font-extrabold' : 'font-bold', deltaTone[r.deltaTone ?? 'positive'])}>{r.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tel.retention && (
        <div className="rounded-lg p-4 bg-surface-canvas space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-body-sm font-semibold text-text-primary flex items-center gap-1.5">
              <Icon name="stacked_line_chart" className="text-[1rem] text-primary" />
              {tel.retention.title}
            </span>
            <span className="font-label-sm text-label-sm text-text-secondary font-semibold">{tel.retention.headline}</span>
          </div>
          <div className="w-full bg-border-strong h-2.5 rounded-full overflow-hidden flex" role="img" aria-label={tel.retention.segments.map((s) => s.title).join('; ')}>
            {tel.retention.segments.map((s) => (
              <div key={s.title} className={cn('h-full', segTone[s.tone])} style={{ width: `${s.width}%` }} title={s.title} />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-body-sm text-body-sm text-text-secondary">
            {tel.retention.notes.map((n) => (
              <div key={n.range} className="flex items-start gap-2 bg-surface-card p-2 rounded border border-border-strong">
                <span className="font-bold text-text-primary whitespace-nowrap">{n.range}</span>
                <span>{n.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionShell>
  );
}

const factorTone = { amber: 'bg-amber-900/40 text-amber-300', blue: 'bg-sky-900/40 text-tertiary', emerald: 'bg-emerald-900/40 text-status-active' } as const;

/** 2. AI reasoning & diagnostic breakdown. */
export function ReasoningSection({ reasoning }: { reasoning: InsightReasoning }) {
  const t = useT();
  return (
    <SectionShell title={t('Why AI thinks so')} subtitle={t('The main reasons behind this insight.')} badge={<AiBadge />}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reasoning.factors.map((f) => (
          <div key={f.title} className="bg-surface-canvas rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className={cn('p-1.5 rounded', factorTone[f.tone])}>
                <Icon name={f.icon} className="text-[1.125rem]" />
              </div>
              <h3 className="font-label-md text-label-md font-bold text-text-primary">{f.title}</h3>
            </div>
            <p className="font-body-sm text-body-sm text-text-secondary leading-relaxed">
              <RichText text={f.text} />
            </p>
          </div>
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-body-sm text-ai-accent">
        <Icon name="verified_user" className="text-[1rem]" />
        {t('How sure: {margin}', { margin: reasoning.errorMargin })}
        <InfoTip text={reasoning.confidenceNote} />
      </p>
    </SectionShell>
  );
}

const tagTone = {
  ai: 'px-2 py-0.5 rounded-full text-label-sm font-label-sm bg-ai-subtle border border-ai-border text-ai-accent font-semibold',
  positive: 'font-label-sm text-label-sm text-status-active font-bold',
  primary: 'font-label-sm text-label-sm text-primary font-bold',
} as const;

/** 3. Evidence-based next best actions with checkable steps (progress stored in the insights store). */
export function ActionPlanSection({ insight, busy, onToggleStep }: { insight: Insight; busy: boolean; onToggleStep: (stepId: string) => void }) {
  const t = useT();
  const steps = insight.detail?.steps ?? [];
  const done = steps.filter((s) => insight.completedStepIds.includes(s.id)).length;
  return (
    <SectionShell
      title={t('Next steps')}
      subtitle={t('Tick each step when your team has done it.')}
      tip={t('Your team does these steps. SocialBoard does not post, change budgets or edit campaigns.')}
      badge={<span className="text-body-sm text-text-tertiary tnum">{t('{done} of {total} done', { done, total: steps.length })}</span>}
    >
      <ol className="space-y-3">
        {steps.map((s, idx) => {
          const checked = insight.completedStepIds.includes(s.id);
          return (
            <li key={s.id} className={cn('rounded-lg p-4 bg-surface-canvas flex items-start gap-3', checked && 'bg-status-active-subtle/50')}>
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5', checked ? 'bg-status-active-solid text-white' : 'bg-slate-700 text-slate-100')}>
                {checked ? <Icon name="check" className="text-[0.875rem]" /> : idx + 1}
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={cn('font-label-md text-label-md font-bold text-text-primary', checked && 'line-through decoration-text-tertiary')}>{s.title}</span>
                  <span className={tagTone[s.tagTone]}>{s.tag}</span>
                </div>
                <p className="font-body-sm text-body-sm text-text-secondary">{s.description}</p>
              </div>
              <div className={cn('shrink-0 pt-1', busy && 'pointer-events-none opacity-60')}>
                <Checkbox checked={checked} onChange={() => onToggleStep(s.id)} label={checked ? t('Mark step {n} as not done', { n: idx + 1 }) : t('Mark step {n} as done', { n: idx + 1 })} />
              </div>
            </li>
          );
        })}
      </ol>
      {insight.detail?.quickLinks && (
        <div className="pt-2 flex flex-wrap items-center gap-3">
          {insight.detail.quickLinks.map((l) => (
            <Link
              key={l.to + l.label}
              to={l.to}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 font-label-md text-label-md rounded transition-colors',
                l.primary ? 'bg-primary-container hover:bg-brand-primary-hover text-on-primary-container font-bold shadow-sm' : 'bg-surface-canvas border border-border-strong hover:bg-surface-card text-text-primary font-semibold',
              )}
            >
              <span>{l.label}</span>
              <Icon name="arrow_forward" className="text-[1rem]" />
            </Link>
          ))}
        </div>
      )}
    </SectionShell>
  );
}
