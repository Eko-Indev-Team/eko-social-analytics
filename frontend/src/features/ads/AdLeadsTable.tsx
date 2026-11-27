import { Fragment, useState, type ReactNode } from 'react';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { Icon } from '@/components/ui/Icon';
import { Pagination, TableShell, Td, Th } from '@/components/tables/DataTable';
import type { SortState } from '@/hooks/useTable';
import type { AdLead } from '@/types/ads';
import { EsafPitchControl } from './EsafPitch';
import { QualificationBadge, ReasonList } from './QualificationBadge';
import { formatDateTime } from './adsFormat';

export type AdLeadSortKey = 'created' | 'name' | 'status';

const STATUS_RANK = { sbi_strong: 0, esaf_strong: 1, esaf_pitch: 2, needs_info: 3, not_qualified: 4 } as const;

export const adLeadSortAccessors: Record<AdLeadSortKey, (l: AdLead) => string | number | null> = {
  created: (l) => l.createdTime ?? '',
  name: (l) => (l.name ?? '').toLowerCase() || null,
  status: (l) => STATUS_RANK[l.qualificationStatus] ?? 9,
};

export interface AdLeadTableModel {
  rows: AdLead[];
  sort: SortState<AdLeadSortKey> | undefined;
  toggleSort: (key: AdLeadSortKey) => void;
  page: number;
  pageCount: number;
  setPage: (p: number) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
  total: number;
  rangeStart: number;
  rangeEnd: number;
}

const yesNo = (v: boolean | null, yes: string, no: string, unknown: string) => (v === null ? unknown : v ? yes : no);

/** Ad leads: who, which ad, when, pincode, status (with plain-word reasons) and the ESAF pitch answer. Rows expand to show the form answers. */
export function AdLeadsTable({ table, showAd = true }: { table: AdLeadTableModel; showAd?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  const sortProps = { sort: table.sort, onSort: table.toggleSort };
  const cols = showAd ? 6 : 5;
  return (
    <>
      <TableShell>
        <thead>
          <tr>
            <Th<AdLeadSortKey> sortKey="name" {...sortProps}>
              {t('Lead')}
            </Th>
            {showAd && <Th>{t('Ad')}</Th>}
            <Th<AdLeadSortKey> sortKey="created" {...sortProps}>
              {t('Date')}
            </Th>
            <Th>{t('Pincode')}</Th>
            <Th<AdLeadSortKey> sortKey="status" {...sortProps}>
              {t('Status')}
            </Th>
            <Th>{t('ESAF pitch')}</Th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((lead) => {
            const expanded = open === lead.id;
            return (
              <Fragment key={lead.id}>
                <tr className={cn('border-b border-border-subtle', expanded && 'bg-surface-canvas')}>
                  <Td>
                    <button
                      type="button"
                      className="flex items-center gap-2 text-left group"
                      aria-expanded={expanded}
                      onClick={() => setOpen(expanded ? null : lead.id)}
                    >
                      <Icon name={expanded ? 'expand_less' : 'expand_more'} className="text-[1.125rem] text-text-tertiary group-hover:text-text-primary" />
                      <span className="min-w-0">
                        <span className="block font-semibold">{lead.name ?? t('Hidden')}</span>
                        <span className="block text-[0.75rem] text-text-tertiary tnum">{lead.phone ?? '—'}</span>
                      </span>
                    </button>
                  </Td>
                  {showAd && (
                    <Td>
                      <span className="block max-w-[14rem] truncate">{lead.adName ?? '—'}</span>
                      <span className="block max-w-[14rem] truncate text-[0.75rem] text-text-tertiary">{lead.campaignName ?? ''}</span>
                    </Td>
                  )}
                  <Td className="whitespace-nowrap text-text-secondary">{formatDateTime(lead.createdTime)}</Td>
                  <Td className="tnum">
                    {lead.submittedPincode ?? '—'}
                    {lead.pincodeMatch !== null && (
                      <Icon
                        name={lead.pincodeMatch ? 'check_circle' : 'cancel'}
                        className={cn('ml-1 text-[0.875rem] align-middle', lead.pincodeMatch ? 'text-status-active' : 'text-text-tertiary')}
                        label={lead.pincodeMatch ? t('In the SBI area') : t('Outside the SBI area')}
                      />
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1 max-w-[16rem]">
                      <QualificationBadge status={lead.qualificationStatus} />
                      <ReasonList status={lead.qualificationStatus} reasons={lead.sbiReasons} />
                    </div>
                  </Td>
                  <Td>
                    <EsafPitchControl lead={lead} compact />
                  </Td>
                </tr>
                {expanded && (
                  <tr className="border-b border-border-subtle bg-surface-canvas">
                    <td colSpan={cols} className="px-4 pb-4 pt-1">
                      <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 text-[0.8125rem]">
                        <Detail label={t('Education')}>{lead.educationLevel ?? t('Not known')}</Detail>
                        <Detail label={t('Can invest')}>{yesNo(lead.canInvest, t('Yes'), t('No'), t('Not known'))}</Detail>
                        {lead.answers ? (
                          lead.answers.map((a, i) => (
                            <Detail key={`${a.question}-${i}`} label={a.question}>
                              {a.answer || '—'}
                            </Detail>
                          ))
                        ) : (
                          <p className="sm:col-span-2 text-text-tertiary text-[0.75rem] flex items-center gap-1">
                            <Icon name="lock" className="text-[0.875rem]" />
                            {t('Names, phone numbers and answers are visible to editors and admins only.')}
                          </p>
                        )}
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
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
        pageSize={table.pageSize}
        onPageSize={table.setPageSize}
      />
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2 min-w-0">
      <dt className="text-text-tertiary shrink-0 max-w-[50%] truncate" title={label}>
        {label}
      </dt>
      <dd className="text-text-primary min-w-0 break-words">{children}</dd>
    </div>
  );
}
