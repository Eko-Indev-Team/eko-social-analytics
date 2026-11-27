import type { ReactNode } from 'react';
import { AiBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { msg, useT } from '@/i18n/I18nContext';
import { modeText } from '@/lib/config';
import { formatCompact, formatNumber } from '@/lib/format';
import type { ReportDetail } from '@/types/reports';

function Pillar({ label, icon, iconClass, title, foot }: { label: string; icon: string; iconClass: string; title: string; foot: ReactNode }) {
  return (
    <div className="p-4 rounded-lg bg-surface-canvas flex flex-col justify-between gap-2">
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <Icon name={icon} className={`text-[1.125rem] ${iconClass}`} />
          <span className="text-body-sm font-medium text-text-secondary">{label}</span>
        </div>
        <div className="text-[0.9375rem] font-semibold text-text-primary leading-snug">{title}</div>
      </div>
      <div className="text-body-sm text-text-secondary">{foot}</div>
    </div>
  );
}

/** AI summary: a few short sentences plus 4 small tiles; every figure comes from the computed report. */
export function ExecutiveSummary({ detail, cplBenchmark }: { detail: ReportDetail; cplBenchmark: number }) {
  const t = useT();
  const { report, computed } = detail;
  const tot = computed.totals;
  const top = computed.formats[0];
  const runnerUp = computed.formats[1];
  const states = computed.topStates.slice(0, 2);
  const stateShare = states.reduce((a, s) => a + s.share, 0);
  const stateLeads = states.reduce((a, s) => a + s.leads, 0);
  const allStateLeads = computed.topStates.reduce((a, s) => a + s.leads, 0);
  const subject = report.scope === 'account' ? t('Your whole account') : computed.campaigns.map((c) => c.name).join(', ') || t('The selected posts');
  const cplDelta = tot.cpl !== null ? ((tot.cpl - cplBenchmark) / cplBenchmark) * 100 : null;

  const sentences = [
    t('{subject} got {views} views and {leads} leads ({period}).', { subject, views: formatCompact(tot.views), leads: formatNumber(tot.leads), period: computed.periodLabel }),
    tot.conversionRate !== null ? t('Conversion rate: {rate}%.', { rate: tot.conversionRate.toFixed(1) }) : null,
    tot.cpl !== null ? t('Cost per lead: ₹{cpl}.', { cpl: Math.round(tot.cpl) }) : null,
    top ? t('{format} brought {share}% of engagement and {leads} leads.', { format: t(top.label), share: top.share.toFixed(0), leads: formatNumber(top.leads) }) : null,
    top && runnerUp && computed.efficiencyRatio !== null ? t('That is {ratio}x more leads per view than the next best type.', { ratio: computed.efficiencyRatio.toFixed(1) }) : null,
    states[0] ? t('Most people reached were in {state} ({share}%).', { state: states[0].label, share: states[0].share }) : null,
  ].filter(Boolean);

  return (
    <section className="bg-surface-card rounded-xl border border-border-strong shadow-card p-5 space-y-4" data-print-section="summary">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-8 h-8 rounded-full bg-ai-subtle text-ai-accent flex items-center justify-center">
          <Icon name="auto_awesome" className="text-[1.125rem]" />
        </span>
        <h2 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('AI summary')}</h2>
        <AiBadge />
        <InfoTip text={t(modeText(msg('Written from sample data, not from Instagram. Check before you act on it.'), msg('Written from your saved data. Check before you act on it.')))} />
      </div>
      <p className="text-body-md text-text-primary leading-relaxed">{sentences.join(' ')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Pillar
          label={t('Best post type')}
          icon="smart_display"
          iconClass="text-primary-container"
          title={top ? t(top.label) : '—'}
          foot={
            <>
              {t('{count} leads', { count: formatNumber(top?.leads ?? 0) })}
              {tot.avgWatchSec !== null && ` · ${t('{sec}s average watch', { sec: tot.avgWatchSec.toFixed(1) })}`}
            </>
          }
        />
        <Pillar
          label={t('Top places')}
          icon="map"
          iconClass="text-tertiary"
          title={states.map((s) => s.label).join(', ')}
          foot={t('{reach}% of people reached · {leads}% of leads', {
            reach: stateShare,
            leads: allStateLeads ? Math.round((stateLeads / allStateLeads) * 100) : 0,
          })}
        />
        {report.narrative?.responseVelocity ? (
          <Pillar
            label={t('Reply speed')}
            icon="speed"
            iconClass="text-status-paused"
            title={report.narrative.responseVelocity.title}
            foot={
              <>
                <span className="font-semibold text-text-primary">{report.narrative.responseVelocity.highlight}</span> {report.narrative.responseVelocity.detail}
              </>
            }
          />
        ) : (
          <Pillar
            label={t('Comments')}
            icon="forum"
            iconClass="text-status-paused"
            title={formatNumber(tot.comments)}
            foot={t('{pct}% became leads', { pct: tot.comments ? ((tot.leads / tot.comments) * 100).toFixed(1) : '0' })}
          />
        )}
        <Pillar
          label={t('Cost per lead')}
          icon="payments"
          iconClass="text-status-active"
          title={tot.cpl !== null ? `₹${Math.round(tot.cpl)}` : t('Not tracked')}
          foot={cplDelta !== null ? t('{pct}% vs usual ₹{bench}', { pct: Math.round(cplDelta), bench: cplBenchmark }) : t('Spend is tracked per campaign, not per post.')}
        />
      </div>
    </section>
  );
}
