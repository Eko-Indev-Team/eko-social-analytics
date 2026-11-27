import { Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Td, Th, Tr, TableShell } from '@/components/tables/DataTable';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback } from '@/components/ui/Misc';
import { msg, useT } from '@/i18n/I18nContext';
import { cn, formatCompact, formatDate, formatNumber, formatPercent } from '@/lib/format';
import type { ContentItem } from '@/types/domain';
import { contentTypeMeta, thumbnailLabel } from '../contentMeta';
import type { LibrarySort, LibrarySortKey } from './filters';

export type MetricColumn = 'views' | 'reach' | 'likes' | 'comments' | 'shares' | 'saves' | 'engagement' | 'leads';
/** Optional table columns: the campaign plus the metric columns. */
export type TableColumn = 'campaign' | MetricColumn;

export const metricColumns: Array<{ key: MetricColumn; label: string }> = [
  { key: 'views', label: msg('Views') },
  { key: 'reach', label: msg('Reach') },
  { key: 'likes', label: msg('Likes') },
  { key: 'comments', label: msg('Comments') },
  { key: 'shares', label: msg('Shares') },
  { key: 'saves', label: msg('Saves') },
  { key: 'engagement', label: msg('Engagement') },
  { key: 'leads', label: msg('Leads') },
];

/** Every column the "Columns" menu can switch, in display order. */
export const tableColumns: Array<{ key: TableColumn; label: string }> = [{ key: 'campaign', label: msg('Campaign') }, ...metricColumns];

/** Shown by default; the rest stay one click away in the "Columns" menu. */
export const defaultColumns: TableColumn[] = ['views', 'engagement', 'leads'];

const HIGH_ENGAGEMENT = 4.5;
const HIGH_LEADS = 50;

export function TypeBadge({ item }: { item: Pick<ContentItem, 'type'> }) {
  const t = useT();
  const meta = contentTypeMeta[item.type];
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold border', meta.badge)}>
      <Icon name={meta.icon} className="text-[0.8125rem]" /> {t(meta.label)}
    </span>
  );
}

export function LeadsPill({ leads }: { leads: number }) {
  return (
    <span
      className={cn(
        'inline-block min-w-[2.25rem] text-center px-2 py-0.5 rounded-full font-bold text-label-sm tnum whitespace-nowrap',
        leads >= HIGH_LEADS ? 'bg-status-active-subtle text-status-active' : 'bg-surface-card-subtle text-text-primary',
      )}
    >
      {formatNumber(leads)}
    </span>
  );
}

function metricCell(item: ContentItem, key: MetricColumn) {
  const m = item.metrics;
  switch (key) {
    case 'views':
      return (
        <Td align="right" className="font-heading text-label-md font-bold">
          {formatCompact(m.views)}
        </Td>
      );
    case 'engagement':
      return (
        <Td align="right">
          <span className={cn('text-label-md font-bold tnum', m.engagementRate >= HIGH_ENGAGEMENT ? 'text-status-active' : 'text-text-primary')}>
            {formatPercent(m.engagementRate)}
          </span>
        </Td>
      );
    case 'leads':
      return (
        <Td align="right">
          <LeadsPill leads={m.leads} />
        </Td>
      );
    default:
      return (
        <Td align="right" className="text-text-secondary">
          {formatCompact(m[key])}
        </Td>
      );
  }
}

export function AssetsTable({
  items,
  columns,
  sort,
  onSort,
  campaignName,
}: {
  items: ContentItem[];
  columns: TableColumn[];
  sort: LibrarySort;
  onSort: (key: LibrarySortKey) => void;
  campaignName: (id: string | null) => string;
}) {
  const t = useT();
  const navigate = useNavigate();
  const showCampaign = columns.includes('campaign');
  const shownMetrics = metricColumns.filter((c) => columns.includes(c.key));
  return (
    <TableShell>
      <thead>
        <tr>
          <Th sortKey="title" sort={sort} onSort={onSort} className="min-w-[260px]">
            {t('Content')}
          </Th>
          <Th sortKey="type" sort={sort} onSort={onSort} className="min-w-[110px]">
            {t('Type')}
          </Th>
          {showCampaign && (
            <Th sortKey="campaign" sort={sort} onSort={onSort} className="min-w-[180px]">
              {t('Campaign')}
            </Th>
          )}
          {shownMetrics.map((c) => (
            <Th key={c.key} sortKey={c.key} sort={sort} onSort={onSort} align="right">
              {t(c.label)}
            </Th>
          ))}
          <Th align="center">
            <span className="sr-only">{t('Open')}</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <Tr key={item.id} onClick={() => navigate(`/content/${item.id}`)} label={t('Open details for {title}', { title: item.title })}>
            <Td className="px-4">
              <div className="flex items-center gap-3">
                <div className="relative w-11 h-12 rounded-lg bg-slate-900 overflow-hidden shrink-0 flex items-center justify-center">
                  <ImageWithFallback src={item.thumbnailUrl} alt={item.thumbnailAlt} className="w-full h-full" />
                </div>
                <div className="flex flex-col min-w-0 max-w-[320px]">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="text-label-md font-semibold text-text-primary truncate">{item.title}</span>
                    {item.isTopPerformer && (
                      <span title={t('Top post')} className="text-amber-400 flex shrink-0">
                        <Icon name="star" filled className="text-[0.875rem]" />
                        <span className="sr-only">{t('Top post')}</span>
                      </span>
                    )}
                  </span>
                  <span className="text-text-tertiary text-[0.75rem]">
                    {formatDate(item.publishedAt)} · {thumbnailLabel(item, t)}
                  </span>
                </div>
              </div>
            </Td>
            <Td>
              <TypeBadge item={item} />
            </Td>
            {showCampaign && (
              <Td>
                {item.campaignId ? (
                  <Link
                    to={`/campaigns/${item.campaignId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-label-md font-medium text-text-secondary hover:text-text-primary hover:underline"
                  >
                    {campaignName(item.campaignId)}
                  </Link>
                ) : (
                  <span className="text-label-md text-text-tertiary">{t('No campaign')}</span>
                )}
              </Td>
            )}
            {shownMetrics.map((c) => (
              <Fragment key={c.key}>{metricCell(item, c.key)}</Fragment>
            ))}
            <Td align="center">
              <Link
                to={`/content/${item.id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-0.5 px-3 py-1 rounded-full border border-border-strong hover:bg-primary-container hover:text-on-primary-container hover:border-primary-container text-text-primary text-label-sm font-semibold transition-colors whitespace-nowrap"
              >
                {t('Open')}
                <Icon name="arrow_forward" className="text-[0.875rem]" />
              </Link>
            </Td>
          </Tr>
        ))}
      </tbody>
    </TableShell>
  );
}

/** Card grid alternative to the table (view-mode toggle). */
export function AssetsGrid({ items, campaignName }: { items: ContentItem[]; campaignName: (id: string | null) => string }) {
  const t = useT();
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 p-4">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            to={`/content/${item.id}`}
            className="group flex flex-col h-full bg-surface-canvas border border-border-strong rounded-xl overflow-hidden hover:border-primary-container hover:-translate-y-0.5 transition-all"
          >
            <div className="relative aspect-[4/5] bg-slate-900">
              <ImageWithFallback src={item.thumbnailUrl} alt={item.thumbnailAlt} className="w-full h-full" />
              <span className="absolute bottom-2 right-2 bg-navy/80 text-white text-[0.625rem] px-1.5 py-0.5 rounded-full">{thumbnailLabel(item, t)}</span>
              <span className="absolute top-2 left-2">
                <TypeBadge item={item} />
              </span>
            </div>
            <div className="p-3 flex flex-col gap-1.5 flex-1">
              <span className="text-label-md font-semibold text-text-primary line-clamp-2 group-hover:text-primary">{item.title}</span>
              <span className="text-[0.6875rem] text-text-tertiary truncate">
                {item.campaignId ? campaignName(item.campaignId) : t('No campaign')} · {formatDate(item.publishedAt, { year: false })}
              </span>
              <div className="mt-auto pt-2 grid grid-cols-3 gap-1 text-center">
                <div>
                  <div className="text-[0.625rem] text-text-tertiary font-semibold">{t('Views')}</div>
                  <div className="text-label-md font-bold tnum">{formatCompact(item.metrics.views)}</div>
                </div>
                <div>
                  <div className="text-[0.625rem] text-text-tertiary font-semibold">{t('Engagement')}</div>
                  <div className="text-label-md font-bold tnum">{formatPercent(item.metrics.engagementRate, 1)}</div>
                </div>
                <div>
                  <div className="text-[0.625rem] text-text-tertiary font-semibold">{t('Leads')}</div>
                  <div className="text-label-md font-bold tnum text-status-active">{formatNumber(item.metrics.leads)}</div>
                </div>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
