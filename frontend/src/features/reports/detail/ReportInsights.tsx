import { BarList } from '@/components/charts/BarList';
import { AiBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { msg, useT } from '@/i18n/I18nContext';
import { modeText } from '@/lib/config';
import { formatCompact, formatNumber } from '@/lib/format';
import type { ReportDetail } from '@/types/reports';

/** Audience and places (account-level audience summary, shared with the Audience screen). */
export function AudienceSection({ detail }: { detail: ReportDetail }) {
  const t = useT();
  const a = detail.audience;
  return (
    <section className="bg-surface-card rounded-xl border border-border-strong shadow-card p-5 space-y-4" data-print-section="audience">
      <div>
        <h3 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('Audience and places')}</h3>
        <p className="text-body-sm text-text-secondary">
          {t('{followers} followers · {pct}% of views from non-followers', { followers: formatCompact(a.followers), pct: a.nonFollowerReachPct })}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-body-sm font-semibold text-text-secondary mb-2">{t('Top states')}</p>
          <BarList items={a.topStates.map((s) => ({ label: s.label, value: s.share, sublabel: t('{count} leads', { count: formatNumber(s.leads) }) }))} />
        </div>
        <div>
          <p className="text-body-sm font-semibold text-text-secondary mb-2">{t('Age groups')}</p>
          <BarList items={a.age.map((x) => ({ label: x.label, value: x.share, sublabel: x.note }))} barClassName="bg-tertiary" />
        </div>
      </div>
    </section>
  );
}

/** AI tips: the report's own narrative when present, otherwise built from the post-type breakdown. */
export function AiRecommendations({ detail, onApply }: { detail: ReportDetail; onApply: () => void }) {
  const t = useT();
  const { report, computed } = detail;
  const n = report.narrative;
  const top = computed.formats[0];
  const observed =
    n?.observed ??
    (top
      ? t('{format} brought {share}% of engagement and {leads} leads in {period}, with {rate}% average engagement.', {
          format: t(top.label),
          share: top.share.toFixed(0),
          leads: formatNumber(top.leads),
          period: computed.periodLabel,
          rate: top.avgEngagementRate.toFixed(2),
        })
      : t('No post activity in this period.'));
  const recommendation =
    n?.recommendation ??
    (top
      ? t('Make more {format} next month and reuse the hook of your best post ("{post}"). Check this report again in two weeks.', {
          format: t(top.label),
          post: computed.creatives[0]?.content.title ?? '—',
        })
      : t('Publish posts for these campaigns first, then check back for tips.'));
  return (
    <section className="bg-surface-card rounded-xl border border-border-strong shadow-card p-5 space-y-4" data-print-section="recommendations">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-8 h-8 rounded-full bg-ai-subtle text-ai-accent flex items-center justify-center">
          <Icon name="psychology" className="text-[1.125rem]" />
        </span>
        <h3 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('AI tips')}</h3>
        <AiBadge />
        {n && <span className="text-body-sm text-text-tertiary">{t('Confidence: {pct}%', { pct: n.confidencePct })}</span>}
        <InfoTip
          text={
            n?.modelLabel ??
            t(modeText(msg('Simple rules on sample data, not from Instagram. Check before you act on it.'), msg('Simple rules on your saved data. Check before you act on it.')))
          }
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-surface-canvas space-y-2">
          <p className="text-body-sm font-semibold text-text-secondary flex items-center gap-1.5">
            <Icon name="sensors" className="text-[1rem]" />
            {t('What happened')}
          </p>
          <p className="text-body-md text-text-primary leading-relaxed">{observed}</p>
        </div>
        <div className="p-4 rounded-lg bg-ai-subtle/50 border border-ai-border space-y-2">
          <p className="text-body-sm font-semibold text-ai-accent flex items-center gap-1.5">
            <Icon name="bolt" className="text-[1rem]" />
            {t('What to do next')}
          </p>
          <p className="text-body-md text-text-primary leading-relaxed">{recommendation}</p>
          <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-body-sm">
            {n?.projectedImpact && <span className="text-ai-accent font-semibold">{n.projectedImpact}</span>}
            <button type="button" onClick={onApply} className="ml-auto text-text-primary font-semibold hover:text-ai-accent flex items-center gap-1 print:hidden">
              {t('Use in a new campaign')}
              <Icon name="arrow_forward" className="text-[1rem]" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
