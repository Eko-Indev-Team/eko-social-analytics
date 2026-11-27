import { Skeleton } from '@/components/ui/States';
import type { QueryResult } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { cn, formatNumber, formatPercent } from '@/lib/format';
import type { Campaign } from '@/types/domain';
import { SectionCard, UnavailableNote } from './SectionCard';

export interface CampaignFunnel {
  funnel: { readonly new: number; readonly contacted: number; readonly qualified: number; readonly converted: number };
  channels: ReadonlyArray<{ readonly label: string; readonly share: number; readonly leads: number }>;
}

const STAGES = [
  { key: 'new', label: msg('New'), box: 'bg-surface-canvas', value: 'text-text-primary' },
  { key: 'contacted', label: msg('Contacted'), box: 'bg-sky-900/40', value: 'text-sky-300' },
  { key: 'qualified', label: msg('Qualified'), box: 'bg-amber-900/40', value: 'text-amber-300' },
  { key: 'converted', label: msg('Converted'), box: 'bg-emerald-900/40', value: 'text-emerald-300' },
] as const;

const CHANNEL_BARS = ['bg-primary-container', 'bg-slate-600', 'bg-slate-600', 'bg-slate-700'];

/** Lead totals from campaign metrics; stages and sources from `leadService.campaignFunnel`. */
export function LeadsSnapshot({ campaign, query }: { campaign: Campaign; query: QueryResult<CampaignFunnel | null> }) {
  const t = useT();
  const m = campaign.metrics;
  return (
    <SectionCard icon="contact_page" iconClassName="bg-amber-400/15 text-amber-400" title={t('Leads')} link={{ to: '/leads', label: t('See all') }}>
      {!m ? (
        <UnavailableNote icon="contact_page">{t('Numbers show up after it starts.')}</UnavailableNote>
      ) : (
        <div className="mt-4 flex flex-col gap-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <span className="text-body-sm text-text-secondary block">{t('Leads')}</span>
              <span className="font-heading text-[1.75rem] leading-none font-bold text-text-primary tnum">{formatNumber(m.leads)}</span>
            </div>
            <div className="text-right">
              <span className="text-body-sm text-text-secondary block">{t('Conversion')}</span>
              <span className="font-heading text-[1.25rem] font-bold text-status-active tnum">{formatPercent(m.conversionRate, 1)}</span>
            </div>
          </div>
          {query.status === 'loading' ? (
            <Skeleton className="h-28" />
          ) : !query.data ? (
            <UnavailableNote flush>{t('No stage or source breakdown for this campaign in the sample data.')}</UnavailableNote>
          ) : (
            <>
              <div>
                <span className="text-body-sm text-text-secondary mb-2 block">{t('Stages')}</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  {STAGES.map((s) => (
                    <div key={s.key} className={cn('p-2 rounded-lg', s.box)}>
                      <span className="block text-[0.6875rem] text-text-secondary">{t(s.label)}</span>
                      <span className={cn('font-bold text-sm tnum', s.value)}>{query.data!.funnel[s.key]}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-body-sm text-text-secondary mb-2 block">{t('Where leads came from')}</span>
                <div className="space-y-2.5">
                  {query.data.channels.map((c, i) => (
                    <div key={c.label}>
                      <div className="flex justify-between gap-2 text-xs mb-1">
                        <span className="font-medium text-text-primary">{c.label}</span>
                        <span className="font-semibold text-text-primary tnum whitespace-nowrap">{t('{share}% ({count} leads)', { share: c.share, count: c.leads })}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', CHANNEL_BARS[i] ?? 'bg-slate-700')} style={{ width: `${c.share}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </SectionCard>
  );
}
