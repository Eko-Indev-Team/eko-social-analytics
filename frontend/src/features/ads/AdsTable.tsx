import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { ImageWithFallback } from '@/components/ui/Misc';
import { Pagination, TableShell, Td, Th, Tr } from '@/components/tables/DataTable';
import type { useTable } from '@/hooks/useTable';
import { resolveAdImageUrl } from '@/services/ads';
import type { AdRow } from '@/types/ads';
import { adChannelLabel, adStatusLabel, adStatusTone, formatCount, formatInr, formatInrPrecise } from './adsFormat';

export type AdSortKey = 'name' | 'spend' | 'leads' | 'strong' | 'cpl' | 'created';

export const adSortAccessors: Record<AdSortKey, (r: AdRow) => string | number | null> = {
  name: (r) => (r.adName ?? '').toLowerCase(),
  spend: (r) => r.metrics.spend,
  leads: (r) => r.leadCounts.total || r.metrics.leads,
  strong: (r) => r.leadCounts.qualified,
  cpl: (r) => costPerLead(r),
  created: (r) => r.createdTime ?? '',
};

export function costPerLead(r: AdRow): number | null {
  const leads = r.leadCounts.total || r.metrics.leads;
  return leads ? r.metrics.spend / leads : null;
}

/** Small creative picture (falls back to an icon when the ad has no stored picture). */
export function AdThumb({ ad, className }: { ad: Pick<AdRow, 'creative' | 'adName'>; className?: string }) {
  const t = useT();
  return (
    <ImageWithFallback
      src={resolveAdImageUrl(ad.creative.imageUrl) ?? undefined}
      alt={t('Ad picture: {name}', { name: ad.adName ?? '' })}
      className={cn('w-11 h-11 rounded-md border border-border-strong shrink-0', className)}
      fallbackIcon="ads_click"
    />
  );
}

export function AdsTable({
  table,
  onOpen,
  selectedId,
}: {
  table: ReturnType<typeof useTable<AdRow, AdSortKey>>;
  onOpen: (id: string) => void;
  selectedId?: string | null;
}) {
  const t = useT();
  const sortProps = { sort: table.sort, onSort: table.toggleSort };
  return (
    <>
      <TableShell>
        <thead>
          <tr>
            <Th<AdSortKey> sortKey="name" {...sortProps}>
              {t('Ad')}
            </Th>
            <Th>{t('Type')}</Th>
            <Th>{t('Status')}</Th>
            <Th<AdSortKey> sortKey="spend" align="right" {...sortProps}>
              {t('Spent')}
            </Th>
            <Th<AdSortKey> sortKey="leads" align="right" {...sortProps}>
              {t('Leads')}
            </Th>
            <Th<AdSortKey> sortKey="strong" align="right" {...sortProps}>
              {t('Strongly qualified')}
            </Th>
            <Th<AdSortKey> sortKey="cpl" align="right" {...sortProps}>
              {t('Cost per lead')}
            </Th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((ad) => (
            <Tr key={ad.id} onClick={() => onOpen(ad.id)} selected={ad.id === selectedId} label={t('Open ad {name}', { name: ad.adName ?? ad.id })}>
              <Td>
                <div className="flex items-center gap-3 min-w-[16rem] max-w-[26rem]">
                  <AdThumb ad={ad} />
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{ad.adName ?? ad.id}</p>
                    <p className="text-[0.75rem] text-text-tertiary truncate">{ad.campaignName ?? '—'}</p>
                  </div>
                </div>
              </Td>
              <Td>
                <span className="text-text-secondary">{t(adChannelLabel(ad.channel))}</span>
              </Td>
              <Td>
                <Badge tone={adStatusTone(ad.status)} dot>
                  {t(adStatusLabel(ad.status))}
                </Badge>
              </Td>
              <Td align="right">{formatInr(ad.metrics.spend)}</Td>
              <Td align="right">{ad.channel === 'website' ? '—' : formatCount(ad.leadCounts.total || ad.metrics.leads)}</Td>
              <Td align="right">{ad.channel === 'website' ? '—' : formatCount(ad.leadCounts.qualified)}</Td>
              <Td align="right">{formatInrPrecise(costPerLead(ad))}</Td>
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
