import { Pagination, TableShell, Td, Th, Tr } from '@/components/tables/DataTable';
import { LeadStatusBadge } from '@/components/ui/Badge';
import { QualificationBadge } from '@/features/ads/QualificationBadge';
import type { SortState } from '@/hooks/useTable';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { scoreChipClass, type LeadRow } from './leadUtils';

export type LeadSortKey = 'name' | 'score' | 'lastContact';

interface TableModel {
  rows: LeadRow[];
  sort: SortState<LeadSortKey> | undefined;
  toggleSort: (key: LeadSortKey) => void;
  page: number;
  pageCount: number;
  setPage: (p: number) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
  total: number;
  rangeStart: number;
  rangeEnd: number;
}

/** Leads table: name, campaign (with the post it came from), score, status, last contact. Clicking a row opens the lead. */
export function LeadsTable({ table, onManage, selectedId }: { table: TableModel; onManage: (id: string) => void; selectedId: string | null }) {
  const t = useT();
  return (
    <>
      <TableShell>
        <thead>
          <tr>
            <Th sortKey="name" sort={table.sort} onSort={table.toggleSort}>
              {t('Name')}
            </Th>
            <Th>{t('Campaign')}</Th>
            <Th sortKey="score" sort={table.sort} onSort={table.toggleSort} align="center">
              {t('Score')}
            </Th>
            <Th>{t('Status')}</Th>
            <Th>{t('Fit')}</Th>
            <Th sortKey="lastContact" sort={table.sort} onSort={table.toggleSort}>
              {t('Last contact')}
            </Th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((l) => (
            <Tr key={l.id} onClick={() => onManage(l.id)} selected={l.id === selectedId} label={t('Open lead {name}', { name: l.name })}>
              <Td className="py-3.5">
                <div className="font-semibold text-text-primary">{l.name}</div>
                <span className="text-xs text-text-tertiary">
                  @{l.handle} · {l.location}
                </span>
              </Td>
              <Td className="py-3.5 max-w-[260px]">
                <div className="text-xs font-semibold text-text-primary truncate">{l.campaignName}</div>
                {l.contentLabel && <div className="text-xs text-text-tertiary truncate">{l.contentLabel}</div>}
              </Td>
              <Td align="center" className="py-3.5">
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold tnum', scoreChipClass(l.score, l.status))}>{l.score}</span>
              </Td>
              <Td className="py-3.5">
                <LeadStatusBadge status={l.status} />
              </Td>
              <Td className="py-3.5">
                {l.qualificationStatus ? <QualificationBadge status={l.qualificationStatus} /> : <span className="text-xs text-text-tertiary">{t('Not checked')}</span>}
              </Td>
              <Td className="py-3.5 text-xs text-text-tertiary whitespace-nowrap">{l.lastContact}</Td>
            </Tr>
          ))}
        </tbody>
      </TableShell>
      <Pagination
        page={table.page}
        pageCount={table.pageCount}
        onPage={table.setPage}
        rangeStart={table.rangeStart}
        rangeEnd={table.rangeEnd}
        total={table.total}
        pageSize={table.pageSize}
        onPageSize={table.setPageSize}
      />
    </>
  );
}
