import { TableShell, Th } from '@/components/tables/DataTable';
import { useTable } from '@/hooks/useTable';
import { msg, useT } from '@/i18n/I18nContext';
import { cn, formatNumber, formatPercent } from '@/lib/format';
import type { AudienceSegmentRow, SegmentImpact } from '@/types/audience';
import { AudienceCard } from './AudienceCard';
import type { AudiencePageData } from './model';

type SegKey = 'label' | 'reach' | 'engagedUsers' | 'engagementRate' | 'leads' | 'conversionRate';

const impact: Record<SegmentImpact, { label: string; cls: string }> = {
  top: { label: msg('Best'), cls: 'bg-amber-400/15 text-amber-400' },
  high: { label: msg('Strong'), cls: 'bg-status-active-subtle text-status-active' },
  stable: { label: msg('Steady'), cls: 'bg-slate-800 text-text-secondary' },
  moderate: { label: msg('Average'), cls: 'bg-slate-800 text-text-secondary' },
  low: { label: msg('Low'), cls: 'bg-slate-800 text-text-tertiary' },
  not_targeted: { label: msg('Under 18, not targeted'), cls: 'bg-slate-800 text-text-tertiary' },
};

const accessors: Record<SegKey, (r: AudienceSegmentRow) => string | number> = {
  label: (r) => r.label,
  reach: (r) => r.reach,
  engagedUsers: (r) => r.engagedUsers,
  engagementRate: (r) => r.engagementRate,
  leads: (r) => r.leads,
  conversionRate: (r) => r.conversionRate,
};

/** Sortable table of age groups: reach, engagement, leads and lead rate. */
export function SegmentTable({ data }: { data: AudiencePageData }) {
  const t = useT();
  const table = useTable<AudienceSegmentRow, SegKey>(data.intel.segments, { accessors, initialSort: { key: 'conversionRate', direction: 'desc' }, pageSize: 50 });

  return (
    <AudienceCard
      title={t('Age groups that bring leads')}
      subtitle={t('Click a column to sort.')}
      info={t('Lead rate shows how often people in this group become leads.')}
    >
      <TableShell>
        <thead>
          <tr>
            <Th sortKey="label" sort={table.sort} onSort={table.toggleSort}>
              {t('Age group')}
            </Th>
            <Th sortKey="reach" sort={table.sort} onSort={table.toggleSort} align="right">
              {t('People reached')}
            </Th>
            <Th sortKey="engagementRate" sort={table.sort} onSort={table.toggleSort} align="right">
              {t('Engagement')}
            </Th>
            <Th sortKey="leads" sort={table.sort} onSort={table.toggleSort} align="right">
              {t('Leads')}
            </Th>
            <Th sortKey="conversionRate" sort={table.sort} onSort={table.toggleSort} align="right">
              {t('Lead rate')}
            </Th>
            <Th align="center">{t('Rating')}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle text-body-sm">
          {table.rows.map((r) => {
            const top = r.impact === 'top';
            const im = impact[r.impact];
            return (
              <tr key={r.id} className="hover:bg-surface-canvas transition-colors">
                <td className={cn('py-3 px-4 text-text-primary whitespace-nowrap', top ? 'font-semibold' : 'font-medium')}>{r.label.replace(' Years Old', '')}</td>
                <td className="py-3 px-4 text-right tnum text-text-secondary">{formatNumber(r.reach)}</td>
                <td className="py-3 px-4 text-right tnum text-text-primary">{formatPercent(r.engagementRate)}</td>
                <td className="py-3 px-4 text-right tnum font-semibold text-text-primary">{r.leads}</td>
                <td className={cn('py-3 px-4 text-right tnum font-semibold', r.conversionRate >= 8 ? 'text-status-active' : 'text-text-secondary')}>
                  {formatPercent(r.conversionRate, 1)}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.6875rem] font-semibold whitespace-nowrap', im.cls)}>{t(im.label)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>
    </AudienceCard>
  );
}
