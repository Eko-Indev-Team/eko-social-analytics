import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { InfoTip } from '@/components/ui/InfoTip';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { formatNumber } from '@/lib/format';
import { aiService } from '@/services/ai';
import type { CampaignAnalytics } from '@/types/ai';

function pct(v: number | null | undefined) {
  return v === null || v === undefined ? '—' : `${v.toFixed(2)}%`;
}

/** Plain calculated campaign numbers (no AI). These are the only figures AI insights may cite. */
export function CampaignAnalyticsPanel() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const q = useQuery('ai:campaign-analytics', () => aiService.campaignAnalytics(), { isEmpty: () => false });
  return (
    <section className="bg-surface-card border border-border-strong rounded-xl shadow-card p-5" aria-labelledby="det-analytics">
      <div className="flex items-start justify-between gap-2 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 id="det-analytics" className="font-heading text-[1.0625rem] font-semibold text-text-primary">
              {t('Numbers used by AI')}
            </h2>
            <InfoTip text={t('Worked out from your campaigns, posts and leads, without AI. AI insights may only use these numbers.')} />
          </div>
          <p className="text-body-sm text-text-secondary">{t('Calculated, no AI.')}</p>
        </div>
        <button type="button" className="text-label-sm text-primary font-semibold hover:underline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? t('Hide definitions') : t('Show definitions')}
        </button>
      </div>
      <QueryState query={q} loading={<Skeleton className="h-40" />}>
        {(a: CampaignAnalytics) => (
          <div className="space-y-4">
            <p className="text-[0.75rem] text-text-tertiary flex items-center gap-1.5">
              {t('{start} to {end}, compared with {prevStart} to {prevEnd}', { start: a.periodStart, end: a.periodEnd, prevStart: a.previousStart, prevEnd: a.previousEnd })}
              <InfoTip text={t('Sources: {sources}', { sources: a.sources.map((s) => s.replace('_', ' ')).join(', ') })} />
            </p>
            {a.insufficient.length > 0 && (
              <p className="text-[0.75rem] text-amber-300 flex items-center gap-1.5">
                {t('Not enough data for: {list}.', { list: a.insufficient.map((s) => s.replace(/_/g, ' ')).join(', ') })}
                <InfoTip
                  text={t('These are shown as unavailable, not guessed. Each rate needs at least {items} posts; conversion needs at least {leads} leads.', {
                    items: a.thresholds.minItems,
                    leads: a.thresholds.minLeads,
                  })}
                />
              </p>
            )}
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[680px] text-body-sm">
                <thead>
                  <tr className="border-b border-border-strong text-text-secondary text-[0.75rem] font-semibold">
                    <th className="py-2 px-2">{t('Campaign')}</th>
                    <th className="py-2 px-2 text-right">{t('Posts')}</th>
                    <th className="py-2 px-2 text-right">{t('People reached')}</th>
                    <th className="py-2 px-2 text-right">{t('Engagement')}</th>
                    <th className="py-2 px-2 text-right">{t('Leads')}</th>
                    <th className="py-2 px-2 text-right">{t('Leads per 1,000 reached')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {a.campaigns.map((c) => (
                    <tr key={c.campaignId}>
                      <td className="py-2 px-2 font-semibold text-text-primary">{c.name}</td>
                      <td className="py-2 px-2 text-right tnum">{c.posts}</td>
                      <td className="py-2 px-2 text-right tnum">{formatNumber(c.reach as number | null)}</td>
                      <td className="py-2 px-2 text-right tnum">
                        {pct(c.engagementRate)} {!c.engagementRateSufficient && <Badge tone="neutral">{t('few posts')}</Badge>}
                      </td>
                      <td className="py-2 px-2 text-right tnum">{c.leads}</td>
                      <td className="py-2 px-2 text-right tnum">{c.leadYield === null ? '—' : c.leadYield.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2 text-[0.75rem]">
              {a.formats.map((f) => (
                <span key={f.type} className="px-2.5 py-1 rounded-full bg-surface-canvas text-text-secondary">
                  {f.sufficient
                    ? t('{type}: {rate} ({count} items)', { type: f.type, rate: pct(f.engagementRate), count: f.items })
                    : t('{type}: {rate} ({count} items) — too few to compare', { type: f.type, rate: pct(f.engagementRate), count: f.items })}
                </span>
              ))}
            </div>
            {open && (
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-[0.75rem]">
                {Object.entries(a.definitions).map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-semibold text-text-primary">{k.replace(/_/g, ' ')}</dt>
                    <dd className="text-text-secondary">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </QueryState>
    </section>
  );
}
