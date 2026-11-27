import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pagination, TableShell, Th, Tr } from '@/components/tables/DataTable';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { useTable } from '@/hooks/useTable';
import { msg, useT } from '@/i18n/I18nContext';
import { cn, formatDate } from '@/lib/format';
import type { ReportListItem } from '@/types/reports';
import { ReportStatusBadge, ReportTypeBadge } from './ReportBadges';
import { formatPeriod } from './reportMetrics';

/** Optional columns; Type and Dates show by default, the rest open from "Columns". */
type ColumnKey = 'type' | 'period' | 'campaigns' | 'generated';
const columnLabels: Record<ColumnKey, string> = { type: msg('Type'), period: msg('Dates'), campaigns: msg('Campaigns'), generated: msg('Created') };

export interface ReportRowActions {
  onDownload: (r: ReportListItem) => void;
  onDuplicate: (r: ReportListItem) => void;
  onToggleArchive: (r: ReportListItem) => void;
  onEdit: (r: ReportListItem) => void;
}

const canDownload = (r: ReportListItem) => r.status === 'ready' || r.status === 'ready_demo' || r.status === 'archived';

export function ReportsTable({ items, totalCount, actions }: { items: ReportListItem[]; totalCount: number; actions: ReportRowActions }) {
  const t = useT();
  const navigate = useNavigate();
  const [visible, setVisible] = useState<Record<ColumnKey, boolean>>({ type: true, period: true, campaigns: false, generated: false });
  const table = useTable<ReportListItem, 'title' | 'generated'>(items, {
    accessors: { title: (r) => r.title.toLowerCase(), generated: (r) => r.generatedAt },
    initialSort: { key: 'generated', direction: 'desc' },
    pageSize: 6,
  });
  const show = (k: ColumnKey) => visible[k];

  return (
    <section className="bg-surface-card rounded-xl border border-border-strong shadow-card overflow-hidden">
      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('Your reports')}</h2>
          <p className="text-body-sm text-text-secondary">
            {items.length === totalCount ? t('{count} reports', { count: totalCount }) : t('{shown} of {total} reports', { shown: items.length, total: totalCount })}
          </p>
        </div>
        <Dropdown
          label={t('Columns')}
          trigger={({ toggle, open }) => (
            <button type="button" onClick={toggle} aria-expanded={open} className="text-label-md text-text-secondary hover:text-text-primary font-semibold flex items-center gap-1">
              <Icon name="view_column" className="text-[1rem]" /> {t('Columns')}
            </button>
          )}
        >
          {() =>
            (Object.keys(columnLabels) as ColumnKey[]).map((k) => (
              <MenuItem key={k} active={visible[k]} onClick={() => setVisible((v) => ({ ...v, [k]: !v[k] }))}>
                {t(columnLabels[k])}
              </MenuItem>
            ))
          }
        </Dropdown>
      </div>
      <TableShell>
        <thead>
          <tr>
            <Th sortKey="title" sort={table.sort} onSort={table.toggleSort}>
              {t('Report')}
            </Th>
            {show('type') && <Th>{t(columnLabels.type)}</Th>}
            {show('period') && <Th>{t(columnLabels.period)}</Th>}
            {show('campaigns') && <Th>{t(columnLabels.campaigns)}</Th>}
            {show('generated') && (
              <Th sortKey="generated" sort={table.sort} onSort={table.toggleSort}>
                {t(columnLabels.generated)}
              </Th>
            )}
            <Th>{t('Status')}</Th>
            <Th align="right">
              <span className="sr-only">{t('Actions')}</span>
            </Th>
          </tr>
        </thead>
        <tbody className="text-body-md">
          {table.rows.map((r) => {
            const archived = r.status === 'archived';
            return (
              <Tr key={r.id} onClick={() => navigate(`/reports/${r.id}`)} label={t('Open {name}', { name: r.title })} className="group">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3" title={r.code}>
                    <span
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                        archived ? 'bg-surface-card-subtle text-text-tertiary' : r.status === 'failed' ? 'bg-error-container text-error' : 'bg-status-completed-subtle text-status-completed',
                      )}
                    >
                      <Icon name={r.icon} className="text-[1rem]" />
                    </span>
                    <div className="max-w-[280px] min-w-0">
                      <div className={cn('font-semibold whitespace-normal transition-colors', archived ? 'text-text-secondary' : 'text-text-primary group-hover:text-primary')}>{r.title}</div>
                      <div className="text-body-sm text-text-tertiary tnum">{formatDate(r.generatedAt)}</div>
                    </div>
                  </div>
                </td>
                {show('type') && (
                  <td className="py-3 px-4">
                    <ReportTypeBadge type={r.type} muted={archived} />
                  </td>
                )}
                {show('period') && <td className="py-3 px-4 text-text-secondary text-label-md tnum whitespace-nowrap">{formatPeriod(r.period)}</td>}
                {show('campaigns') && (
                  <td className="py-3 px-4">
                    <span className={cn('font-medium whitespace-normal block max-w-[240px]', archived ? 'text-text-secondary' : 'text-text-primary')}>{r.summary.primary}</span>
                    <div className="text-body-sm text-text-tertiary tnum">{r.summary.secondary}</div>
                  </td>
                )}
                {show('generated') && <td className="py-3 px-4 text-text-secondary text-body-sm tnum max-w-[150px] whitespace-normal">{r.generatedLabel}</td>}
                <td className="py-3 px-4">
                  <ReportStatusBadge status={r.status} />
                </td>
                <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => actions.onDownload(r)}
                      className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-canvas"
                      title={canDownload(r) ? t('Download CSV') : t('Available once the report is ready')}
                      aria-label={t('Download CSV for {name}', { name: r.title })}
                    >
                      <Icon name="file_download" className="text-[1.125rem]" />
                    </button>
                    <Dropdown
                      label={t('More options for {name}', { name: r.title })}
                      trigger={({ toggle, open }) => (
                        <button type="button" onClick={toggle} aria-expanded={open} className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-canvas" aria-label={t('More options')}>
                          <Icon name="more_vert" className="text-[1.125rem]" />
                        </button>
                      )}
                    >
                      {(close) => (
                        <>
                          <MenuItem icon="open_in_new" onClick={() => (close(), navigate(`/reports/${r.id}`))}>
                            {t('Open report')}
                          </MenuItem>
                          <MenuItem icon="tune" onClick={() => (close(), actions.onEdit(r))}>
                            {t('Edit settings')}
                          </MenuItem>
                          <MenuItem icon="content_copy" onClick={() => (close(), actions.onDuplicate(r))}>
                            {t('Duplicate')}
                          </MenuItem>
                          <MenuItem icon={archived ? 'unarchive' : 'archive'} onClick={() => (close(), actions.onToggleArchive(r))}>
                            {archived ? t('Restore') : t('Archive')}
                          </MenuItem>
                        </>
                      )}
                    </Dropdown>
                  </div>
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
        noun={t('reports')}
      />
    </section>
  );
}

export { canDownload };
