import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Td, Th, Tr } from '@/components/tables/DataTable';
import { CampaignStatusBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { useTable } from '@/hooks/useTable';
import { useT } from '@/i18n/I18nContext';
import { formatCompact, formatDateRange, formatNumber } from '@/lib/format';
import type { Campaign, CampaignMetrics } from '@/types/domain';

type RunCampaign = Campaign & { metrics: CampaignMetrics };
type SortKey = 'name' | 'views' | 'leads';

const accessors: Record<SortKey, (c: RunCampaign) => string | number> = {
  name: (c) => c.name.toLowerCase(),
  views: (c) => c.metrics.views,
  leads: (c) => c.metrics.leads,
};

/** Campaigns that have run: name, status, views and leads; a row opens the campaign. */
export function CampaignPerformanceTable({ campaigns }: { campaigns: Campaign[] }) {
  const t = useT();
  const navigate = useNavigate();
  const withMetrics = useMemo(() => campaigns.filter((c): c is RunCampaign => c.metrics !== null), [campaigns]);
  const table = useTable<RunCampaign, SortKey>(withMetrics, { accessors, initialSort: { key: 'views', direction: 'desc' }, pageSize: 50 });

  return (
    <section className="lg:col-span-2 bg-surface-card border border-border-strong rounded-xl shadow-card p-5 min-w-0" aria-labelledby="dash-campaigns-title">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 id="dash-campaigns-title" className="font-heading text-[1.0625rem] font-semibold text-text-primary">
            {t('Your campaigns')}
          </h3>
          <p className="text-body-sm text-text-secondary">{t('Tap a campaign to see more')}</p>
        </div>
        <Link to="/campaigns" className="text-label-md text-text-primary hover:text-primary-container font-semibold flex items-center gap-1 shrink-0">
          <span>{t('See all')} ({campaigns.length})</span>
          <Icon name="arrow_forward" className="text-[1rem]" />
        </Link>
      </div>
      {withMetrics.length === 0 ? (
        <p className="text-body-sm text-text-secondary py-8 text-center border border-dashed border-border-strong rounded-lg">{t('No campaign numbers yet.')}</p>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse min-w-[480px]">
            <thead>
              <tr>
                <Th sortKey="name" sort={table.sort} onSort={table.toggleSort} className="!px-2.5">
                  {t('Campaign')}
                </Th>
                <Th className="!px-2.5">{t('Status')}</Th>
                <Th sortKey="views" sort={table.sort} onSort={table.toggleSort} align="right" className="!px-2.5">
                  {t('Views')}
                </Th>
                <Th sortKey="leads" sort={table.sort} onSort={table.toggleSort} align="right" className="!px-2.5">
                  {t('Leads')}
                </Th>
                <Th className="!px-2.5 w-8">
                  <span className="sr-only">{t('Open')}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((c) => (
                <Tr key={c.id} onClick={() => navigate(`/campaigns/${c.id}`)} className="group" label={`${t('Open')} ${c.name}`}>
                  <Td className="!px-2.5">
                    <div className="font-semibold text-text-primary group-hover:text-primary-container transition-colors">{c.name}</div>
                    <span className="text-[0.75rem] text-text-tertiary">{formatDateRange(c.startDate, c.endDate)}</span>
                  </Td>
                  <Td className="!px-2.5">
                    <CampaignStatusBadge status={c.status} />
                  </Td>
                  <Td align="right" className="!px-2.5 font-semibold">
                    {formatCompact(c.metrics.views)}
                  </Td>
                  <Td align="right" className="!px-2.5 font-bold">
                    {formatNumber(c.metrics.leads)}
                  </Td>
                  <Td align="right" className="!px-2.5 text-text-tertiary group-hover:text-text-primary">
                    <Icon name="chevron_right" className="text-[1.125rem]" />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
