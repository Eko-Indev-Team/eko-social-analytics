import type { CSSProperties, ReactNode } from 'react';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { Icon } from './Icon';
import { InfoTip } from './InfoTip';

export type KpiTone = 'teal' | 'gold' | 'success' | 'ai' | 'warning' | 'igOrange' | 'igPink' | 'igPurple';

/** One accent colour per tone; the card's tint, glow, icon and top line are all mixed from it. */
const TONE_HEX: Record<KpiTone, string> = {
  teal: '#0ea5e9',
  gold: '#f5b82e',
  success: '#10b981',
  ai: '#8b5cf6',
  warning: '#f97316',
  igOrange: '#fb923c',
  igPink: '#ec4899',
  igPurple: '#a855f7',
};

const mix = (pct: number, base = 'var(--app-surface)') => `color-mix(in srgb, var(--kpi-tone) ${pct}%, ${base})`;

/**
 * Number tile: coloured icon circle, short label, big number and a small change pill.
 * `label` is English source text and is translated here; `hint` becomes an (i) tooltip instead of extra lines.
 */
export function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  footnote,
  hint,
  icon,
  tone = 'teal',
  highlight,
  className,
  onClick,
}: {
  label: string;
  value: ReactNode;
  /** Percent change; positive renders green, negative red. */
  delta?: number;
  deltaLabel?: string;
  footnote?: ReactNode;
  hint?: string;
  icon?: string;
  tone?: KpiTone;
  highlight?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const t = useT();
  const positive = (delta ?? 0) >= 0;
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={
        {
          '--kpi-tone': TONE_HEX[highlight ? 'gold' : tone],
          background: `radial-gradient(120% 90% at 100% 0%, ${mix(14)} 0%, var(--app-surface) 60%)`,
          borderColor: highlight ? mix(70) : mix(22, 'var(--app-border-strong)'),
        } as CSSProperties
      }
      className={cn(
        'group/kpi relative overflow-hidden text-left border rounded-2xl p-4 flex flex-col gap-3',
        'shadow-card transition-all duration-200',
        'kpi-card hover:-translate-y-1',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {/* Decorative: a thin tone-coloured line on top and a soft glow in the corner. */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, var(--kpi-tone), ${mix(0, 'transparent')})` }} />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-[9999px] blur-2xl opacity-25 transition-opacity duration-200 group-hover/kpi:opacity-40"
        style={{ background: 'var(--kpi-tone)' }}
      />
      <div className="relative flex items-center gap-2.5">
        {icon && (
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ring-1"
            style={{ background: `linear-gradient(135deg, ${mix(30)} 0%, ${mix(10)} 100%)`, color: 'var(--kpi-tone)', ['--tw-ring-color' as string]: mix(35) }}
          >
            <Icon name={icon} className="text-[1.25rem]" />
          </span>
        )}
        <span className="text-body-sm font-medium text-text-secondary leading-tight">{t(label)}</span>
        {hint &&
          (onClick ? (
            // The whole card is a button here, so the hint is a plain tooltip rather than a nested (i) button.
            <span title={t(hint)} className="ml-auto text-text-tertiary flex">
              <Icon name="info" className="text-[1rem]" />
            </span>
          ) : (
            <InfoTip text={t(hint)} className="ml-auto" />
          ))}
      </div>
      <div className="relative flex items-end justify-between gap-2 flex-wrap">
        <span className="font-heading text-[2rem] leading-none font-extrabold tracking-tight text-text-primary tnum">{value}</span>
        {delta !== undefined && (
          <span
            className={cn(
              'text-[0.6875rem] font-semibold flex items-center gap-0.5 rounded-full px-2 py-0.5',
              positive ? 'bg-status-active-subtle text-status-active' : 'bg-error-container text-error',
            )}
            title={deltaLabel ? t(deltaLabel) : undefined}
          >
            <Icon name={positive ? 'arrow_upward' : 'arrow_downward'} className="text-[0.75rem]" />
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      {footnote && <span className="relative text-[0.75rem] text-text-tertiary -mt-1">{footnote}</span>}
    </Wrapper>
  );
}
