import { TableShell } from '@/components/tables/DataTable';
import { useT } from '@/i18n/I18nContext';
import { cn, formatCompact, formatNumber } from '@/lib/format';
import { AudienceCard } from './AudienceCard';
import type { AudiencePageData } from './model';

/** Top states (canonical audienceSummary.topStates) + top cities table. */
export function LocationSection({ data }: { data: AudiencePageData }) {
  const t = useT();
  const { summary, intel } = data;
  const avgConversion = intel.cities.reduce((s, c) => s + c.conversionPct, 0) / intel.cities.length;
  const topCities = [...intel.cities].sort((a, b) => b.conversionPct - a.conversionPct).slice(0, 2);
  const stateLeads = summary.topStates.reduce((s, x) => s + x.leads, 0);

  return (
    <AudienceCard
      title={t('Places')}
      subtitle={t('Main market: {market}', { market: intel.primaryMarket })}
      info={t('State leads are leads with a known location ({count} in this period).', { count: stateLeads })}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 flex flex-col gap-3.5">
          <h4 className="text-label-md font-semibold text-text-secondary">{t('Top states')}</h4>
          {summary.topStates.map((s, i) => {
            const top = i === 0;
            return (
              <div key={s.label}>
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs mb-1">
                  <span className={cn('text-text-primary', top ? 'font-semibold' : 'font-medium')}>{s.label}</span>
                  <span className="tnum text-text-secondary">
                    {t('{share}% · {reach} reached · {leads} leads', { share: s.share, reach: formatCompact(s.reach), leads: s.leads })}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', top ? 'bg-primary-container' : 'bg-slate-600')} style={{ width: `${s.share}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="lg:col-span-5 flex flex-col gap-3 min-w-0">
          <h4 className="text-label-md font-semibold text-text-secondary">{t('Top cities')}</h4>
          <TableShell>
            <thead>
              <tr className="text-text-secondary text-label-sm font-semibold border-b border-border-strong">
                <th className="py-2 px-2.5 text-left">{t('City')}</th>
                <th className="py-2 px-2.5 text-right">{t('Reached')}</th>
                <th className="py-2 px-2.5 text-right">{t('Leads')}</th>
                <th className="py-2 px-2.5 text-right" title={t('Leads as a share of people who asked a question')}>
                  {t('Lead rate')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-body-sm">
              {intel.cities.map((c) => {
                const strong = c.conversionPct >= avgConversion + 1;
                return (
                  <tr key={c.city} className="hover:bg-surface-canvas">
                    <td className="py-2 px-2.5 font-medium text-text-primary whitespace-nowrap">{c.city}</td>
                    <td className="py-2 px-2.5 text-right tnum text-text-secondary">{formatNumber(c.reach)}</td>
                    <td className="py-2 px-2.5 text-right tnum font-semibold text-text-primary">{c.leads}</td>
                    <td className={cn('py-2 px-2.5 text-right tnum', strong ? 'text-status-active font-semibold' : 'text-text-secondary')}>{c.conversionPct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
          {topCities.length === 2 && (
            <p className="text-[0.75rem] text-text-secondary">
              {t('{first} and {second} turn the most people into leads.', {
                first: topCities[0].city.replace(/ \(.*\)/, ''),
                second: topCities[1].city.replace(/ \(.*\)/, ''),
              })}
            </p>
          )}
        </div>
      </div>
    </AudienceCard>
  );
}
