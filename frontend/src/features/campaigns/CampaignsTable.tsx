import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CampaignStatusBadge, HealthBadge } from '@/components/ui/Badge';
import { Checkbox, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback } from '@/components/ui/Misc';
import { Skeleton } from '@/components/ui/States';
import { Pagination, TableShell, Td, Th, Tr } from '@/components/tables/DataTable';
import type { useTable } from '@/hooks/useTable';
import { useT } from '@/i18n/I18nContext';
import { cn, formatCompact, formatDateRange, formatNumber, formatPercent } from '@/lib/format';
import type { Campaign, CampaignHealth } from '@/types/domain';
import { codeNumber, creativesLabel, metric, OBJECTIVE_LABEL } from './campaignUtils';
import { RowActionsMenu } from './RowActionsMenu';

export type CampaignSortKey = 'name' | 'objective' | 'status' | 'startDate' | 'views' | 'reach' | 'engagementRate' | 'leads' | 'conversionRate' | 'health' | 'created';

const healthRank: Record<CampaignHealth, number> = { excellent: 3, good: 2, needs_attention: 1 };

export const campaignSortAccessors: Record<CampaignSortKey, (c: Campaign) => string | number | null> = {
  name: (c) => c.name.toLowerCase(),
  objective: (c) => c.objective,
  status: (c) => c.status,
  startDate: (c) => c.startDate,
  views: (c) => metric(c, 'views'),
  reach: (c) => metric(c, 'reach'),
  engagementRate: (c) => metric(c, 'engagementRate'),
  leads: (c) => metric(c, 'leads'),
  conversionRate: (c) => metric(c, 'conversionRate'),
  health: (c) => (c.health ? healthRank[c.health] : null),
  created: codeNumber,
};

type CampaignTable = ReturnType<typeof useTable<Campaign, CampaignSortKey>>;

const engClass = (v: number) => (v >= 4.5 ? 'text-status-active' : v < 4 ? 'text-status-paused' : 'text-text-primary');

/**
 * Campaigns list. By default: Campaign, Status, Dates, Views, Leads and row actions.
 * "More columns" adds Goal, People reached, Engagement, Conversion and Rating.
 */
export function CampaignsTable({
  table,
  selected,
  onSelect,
  onOpen,
  onEdit,
  onToggleStatus,
  onDuplicate,
}: {
  table: CampaignTable;
  selected: Set<string>;
  onSelect: (ids: string[], on: boolean) => void;
  onOpen: (c: Campaign) => void;
  onEdit: (c: Campaign) => void;
  onToggleStatus: (c: Campaign) => void;
  onDuplicate: (c: Campaign) => void;
}) {
  const t = useT();
  const [wide, setWide] = useState(false);
  const { rows, allRows, sort, toggleSort } = table;
  const allIds = allRows.map((c) => c.id);
  const selectedCount = allIds.filter((id) => selected.has(id)).length;
  const sortProps = { sort, onSort: toggleSort };

  return (
    <section className="bg-surface-card rounded-xl border border-border-strong overflow-hidden shadow-card" aria-labelledby="campaigns-table-title">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div>
          <h2 id="campaigns-table-title" className="font-heading text-[1.0625rem] font-semibold text-text-primary">
            {t('All campaigns')}
          </h2>
          <p className="text-body-sm text-text-secondary">{t('Tap a campaign for a quick look')}</p>
        </div>
        <button
          type="button"
          onClick={() => setWide((w) => !w)}
          aria-expanded={wide}
          className="text-label-md font-semibold text-text-secondary hover:text-text-primary flex items-center gap-1 shrink-0"
        >
          <Icon name="view_column" className="text-[1.125rem]" />
          {wide ? t('Fewer columns') : t('More columns')}
        </button>
      </div>
      <TableShell>
        <thead>
          <tr>
            <Th className="w-10 text-center">
              <Checkbox
                label={t('Select all campaigns')}
                checked={selectedCount > 0 && selectedCount === allIds.length}
                indeterminate={selectedCount > 0 && selectedCount < allIds.length}
                onChange={(on) => onSelect(allIds, on)}
                className="border-border-strong"
              />
            </Th>
            <Th sortKey="name" {...sortProps}>
              {t('Campaign')}
            </Th>
            {wide && (
              <Th sortKey="objective" {...sortProps} className="px-3">
                {t('Goal')}
              </Th>
            )}
            <Th sortKey="status" {...sortProps} className="px-3">
              {t('Status')}
            </Th>
            <Th sortKey="startDate" {...sortProps} className="px-3">
              {t('Dates')}
            </Th>
            <Th sortKey="views" {...sortProps} align="right" className="px-3">
              {t('Views')}
            </Th>
            {wide && (
              <Th sortKey="reach" {...sortProps} align="right" className="px-3">
                {t('People reached')}
              </Th>
            )}
            {wide && (
              <Th sortKey="engagementRate" {...sortProps} align="right" className="px-3">
                {t('Engagement')}
              </Th>
            )}
            <Th sortKey="leads" {...sortProps} align="right" className="px-3">
              {t('Leads')}
            </Th>
            {wide && (
              <Th sortKey="conversionRate" {...sortProps} align="right" className="px-3">
                {t('Conversion')}
              </Th>
            )}
            {wide && (
              <Th sortKey="health" {...sortProps} align="center">
                {t('Rating')}
              </Th>
            )}
            <Th className="w-8 px-2">
              <span className="sr-only">{t('Actions')}</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const m = c.metrics;
            const isSelected = selected.has(c.id);
            return (
              <Tr key={c.id} onClick={() => onOpen(c)} selected={isSelected} className="group" label={t('Quick look: {name}', { name: c.name })}>
                <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                  <Checkbox label={t('Select {name}', { name: c.name })} checked={isSelected} onChange={(on) => onSelect([c.id], on)} className="border-border-strong" />
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3 min-w-[220px]">
                    <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 bg-surface-canvas flex items-center justify-center text-text-tertiary">
                      {c.thumbnailUrl ? (
                        <ImageWithFallback src={c.thumbnailUrl} alt="" className="h-full w-full" />
                      ) : (
                        <Icon name={c.status === 'draft' ? 'draft' : c.status === 'scheduled' ? 'schedule' : 'campaign'} className="text-[1.25rem]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link
                        to={`/campaigns/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-body-sm text-text-primary group-hover:text-primary-container hover:underline transition-colors"
                      >
                        {c.name}
                      </Link>
                      <div className="text-[0.75rem] text-text-tertiary flex items-center gap-1.5">
                        <span>{c.code}</span>
                        {wide && (
                          <>
                            <span aria-hidden>·</span>
                            <span>{creativesLabel(c, t)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                {wide && (
                  <td className="py-3 px-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[0.75rem] font-medium bg-surface-card-subtle text-text-secondary whitespace-nowrap">{t(OBJECTIVE_LABEL[c.objective])}</span>
                  </td>
                )}
                <td className="py-3 px-3">
                  <CampaignStatusBadge status={c.status} />
                </td>
                <td className={cn('py-3 px-3 text-[0.75rem] whitespace-nowrap', c.startDate ? 'text-text-secondary' : 'text-text-tertiary')}>{formatDateRange(c.startDate, c.endDate)}</td>
                <Td align="right" className={cn('px-3 font-medium', !m && 'text-text-tertiary')}>
                  {m ? formatCompact(m.views) : '—'}
                </Td>
                {wide && (
                  <Td align="right" className={cn('px-3 font-medium', !m && 'text-text-tertiary')}>
                    {m ? formatCompact(m.reach) : '—'}
                  </Td>
                )}
                {wide && (
                  <Td align="right" className={cn('px-3 font-semibold', m ? engClass(m.engagementRate) : 'text-text-tertiary')}>
                    {m ? formatPercent(m.engagementRate) : '—'}
                  </Td>
                )}
                <Td align="right" className={cn('px-3 font-bold', !m && 'text-text-tertiary font-normal')}>
                  {m ? formatNumber(m.leads) : '—'}
                </Td>
                {wide && (
                  <Td align="right" className={cn('px-3 font-semibold', !m && 'text-text-tertiary font-normal')}>
                    {m ? formatPercent(m.conversionRate, 1) : '—'}
                  </Td>
                )}
                {wide && (
                  <td className="py-3 px-4 text-center">
                    <HealthBadge value={c.health} fallback={c.status === 'draft' ? 'Draft' : c.status === 'scheduled' ? 'Scheduled' : 'Not rated'} />
                  </td>
                )}
                <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <RowActionsMenu label={t('Actions for {name}', { name: c.name })}>
                    {(close) => (
                      <>
                        <MenuItem icon="visibility" onClick={() => (close(), onOpen(c))}>
                          {t('Quick look')}
                        </MenuItem>
                        <Link
                          to={`/campaigns/${c.id}`}
                          role="menuitem"
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-label-md text-left text-text-primary hover:bg-surface-canvas"
                        >
                          <Icon name="open_in_new" className="text-[1rem] text-text-secondary" />
                          {t('Open campaign')}
                        </Link>
                        <MenuItem icon="edit" onClick={() => (close(), onEdit(c))}>
                          {t('Edit')}
                        </MenuItem>
                        {(c.status === 'active' || c.status === 'paused') && (
                          <MenuItem icon={c.status === 'active' ? 'pause' : 'play_arrow'} onClick={() => (close(), onToggleStatus(c))}>
                            {c.status === 'active' ? t('Pause') : t('Resume')}
                          </MenuItem>
                        )}
                        <MenuItem icon="content_copy" onClick={() => (close(), onDuplicate(c))}>
                          {t('Copy as draft')}
                        </MenuItem>
                      </>
                    )}
                  </RowActionsMenu>
                </td>
              </Tr>
            );
          })}
        </tbody>
      </TableShell>
      <Pagination
        page={table.page}
        pageCount={table.pageCount}
        onPage={table.setPage}
        rangeStart={table.rangeStart}
        rangeEnd={table.rangeEnd}
        total={table.total}
        noun={t('campaigns')}
        pageSize={table.pageSize}
        onPageSize={table.setPageSize}
        pageSizes={[10, 25, 50]}
      />
    </section>
  );
}

export function CampaignsTableSkeleton() {
  const t = useT();
  return (
    <div className="bg-surface-card rounded-xl border border-border-strong p-5 space-y-3 shadow-card" role="status" aria-label={t('Loading campaigns')}>
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
