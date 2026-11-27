import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { dashboardService } from '@/services/dashboard';
import type { ExecutiveBriefTone } from '@/types/dashboard';

const toneStyles: Record<ExecutiveBriefTone, { box: string; label: string; text: string }> = {
  working: { box: 'bg-surface-canvas border-border-subtle', label: 'text-status-active', text: 'text-text-primary text-xs' },
  declining: { box: 'bg-surface-canvas border-border-subtle', label: 'text-status-paused', text: 'text-text-primary text-xs' },
  opportunity: { box: 'bg-surface-canvas border-border-subtle', label: 'text-tertiary', text: 'text-text-primary text-xs' },
  action: { box: 'bg-amber-900/40 border-amber-800', label: 'text-primary', text: 'text-text-primary text-xs font-medium' },
};

/** AI Executive Brief card (what is working / declining / opportunity / recommended action). */
export function ExecutiveBrief() {
  const t = useT();
  const brief = useQuery('dashboard:brief', dashboardService.executiveBrief);

  return (
    <section className="bg-surface-card border border-border-strong rounded-xl shadow-card p-5 flex flex-col justify-between" aria-labelledby="dash-brief-title">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-ai-subtle text-ai-accent flex items-center justify-center">
              <Icon name="auto_awesome" className="text-[1.125rem]" />
            </span>
            <h3 id="dash-brief-title" className="font-heading text-[1.0625rem] font-semibold text-text-primary">
              {t('AI summary')}
            </h3>
          </div>
          <InfoTip text={t('Written by AI from sample data. Check before you act on it. Generated {date}.', { date: brief.data?.generatedAt ?? '—' })} />
        </div>
        <QueryState
          query={brief}
          loading={
            <div className="space-y-3.5">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          }
          empty={<p className="text-body-sm text-text-secondary py-6 text-center">{t('No AI summary yet.')}</p>}
        >
          {(data) => (
            <div className="space-y-3.5 text-body-sm">
              {data.items.map((item) => {
                const s = toneStyles[item.tone];
                return (
                  <div key={item.id} className={cn('p-3 rounded-lg border', s.box)}>
                    <span className={cn('font-bold text-[0.6875rem] uppercase tracking-wide block mb-0.5', s.label)}>{t(item.label)}</span>
                    <p className={s.text}>
                      {item.segments.map((seg, i) => (seg.strong ? <strong key={i}>{seg.text}</strong> : <span key={i}>{seg.text}</span>))}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </QueryState>
      </div>
      <Link
        to="/ai-insights"
        className="mt-4 w-full py-2 bg-surface-canvas hover:bg-slate-800 border border-border-strong rounded-lg text-label-md font-semibold text-text-primary text-center transition-colors block"
      >
        {t('See all AI tips')} →
      </Link>
    </section>
  );
}
