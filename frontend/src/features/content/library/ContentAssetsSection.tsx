import { forwardRef, useState, type ReactNode } from 'react';
import { Pagination } from '@/components/tables/DataTable';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { QueryState } from '@/components/ui/States';
import type { QueryResult } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { ContentItem } from '@/types/domain';
import { AssetsGrid, AssetsTable, defaultColumns, tableColumns, type TableColumn } from './AssetViews';
import type { LibrarySort, LibrarySortKey } from './filters';

const PAGE_SIZES = [6, 12, 24];

const viewModes = [
  { value: 'list', icon: 'view_list', label: msg('Table') },
  { value: 'grid', icon: 'grid_view', label: msg('Grid') },
] as const;

function AssetsSkeleton() {
  const t = useT();
  return (
    <div className="p-6 space-y-4 animate-pulse" role="status" aria-label={t('Loading posts')}>
      <div className="h-8 bg-slate-800 rounded w-1/4" />
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-12 bg-slate-800 rounded" />
        ))}
      </div>
    </div>
  );
}

function AssetsEmpty({ onReset }: { onReset: () => void }) {
  const t = useT();
  return (
    <div className="py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-surface-canvas flex items-center justify-center mx-auto text-text-tertiary mb-3">
        <Icon name="movie_off" className="text-[1.5rem]" />
      </div>
      <h3 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('No posts found')}</h3>
      <p className="text-body-sm text-text-secondary mt-1 max-w-sm mx-auto">{t('Try another search or filter.')}</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-4 px-4 py-1.5 rounded-full border border-border-strong text-text-primary text-label-md font-semibold hover:bg-surface-canvas"
      >
        {t('Clear filters')}
      </button>
    </div>
  );
}

function AssetsError({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <div className="py-16 px-4 text-center" role="alert">
      <div className="w-12 h-12 rounded-full bg-error-container text-error flex items-center justify-center mx-auto mb-3">
        <Icon name="cloud_off" className="text-[1.5rem]" />
      </div>
      <h3 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('Could not load your posts')}</h3>
      <p className="text-body-sm text-text-secondary mt-1 max-w-sm mx-auto">{t('Please try again in a moment.')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 px-4 py-2 rounded-full bg-primary-container text-on-primary-container text-label-md font-bold hover:bg-brand-primary-hover"
      >
        {t('Try again')}
      </button>
    </div>
  );
}

/** All posts: filters, table/grid switch, column chooser, sortable columns, paging and empty/error states. */
export const ContentAssetsSection = forwardRef<
  HTMLElement,
  {
    query: QueryResult<ContentItem[]>;
    items: ContentItem[];
    sort: LibrarySort;
    onSort: (key: LibrarySortKey) => void;
    onResetFilters: () => void;
    campaignName: (id: string | null) => string;
    /** Search and filter bar shown under the section title. */
    toolbar?: ReactNode;
  }
>(function ContentAssetsSection({ query, items, sort, onSort, onResetFilters, campaignName, toolbar }, ref) {
  const t = useT();
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [columns, setColumns] = useState<TableColumn[]>(defaultColumns);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = items.slice((safePage - 1) * pageSize, safePage * pageSize);
  const toggleColumn = (key: TableColumn) => setColumns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <section ref={ref} className="bg-surface-card border border-border-strong rounded-xl shadow-card overflow-hidden scroll-mt-20" aria-labelledby="content-all-title">
      <div className="p-5 pb-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2 id="content-all-title" className="font-heading text-[1.0625rem] font-semibold text-text-primary">
              {t('All posts')}
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-surface-card-subtle text-text-secondary text-label-sm tnum">
              {query.status === 'success' ? items.length : 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-surface-canvas p-1 rounded-full" role="tablist" aria-label={t('View')}>
              {viewModes.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  role="tab"
                  aria-selected={view === v.value}
                  aria-label={t(v.label)}
                  title={t(v.label)}
                  onClick={() => setView(v.value)}
                  className={cn('px-2 py-1 rounded-full flex', view === v.value ? 'bg-surface-card text-text-primary shadow-xs' : 'text-text-secondary hover:text-text-primary')}
                >
                  <Icon name={v.icon} className="text-[1rem]" />
                </button>
              ))}
            </div>
            <Dropdown
              label={t('Columns')}
              trigger={({ toggle, open }) => (
                <button
                  type="button"
                  onClick={toggle}
                  aria-expanded={open}
                  disabled={view === 'grid'}
                  title={view === 'grid' ? t('Columns are for the table view') : undefined}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border-strong text-text-secondary hover:text-text-primary text-label-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icon name="view_column" className="text-[1rem]" />
                  <span>{t('Columns')}</span>
                </button>
              )}
            >
              {() => (
                <>
                  {tableColumns.map((c) => (
                    <MenuItem key={c.key} active={columns.includes(c.key)} onClick={() => toggleColumn(c.key)}>
                      {t(c.label)}
                    </MenuItem>
                  ))}
                  <div className="border-t border-border-subtle mt-1 pt-1">
                    <MenuItem icon="view_column" onClick={() => setColumns(tableColumns.map((c) => c.key))}>
                      {t('Show all columns')}
                    </MenuItem>
                    <MenuItem icon="restart_alt" onClick={() => setColumns(defaultColumns)}>
                      {t('Reset columns')}
                    </MenuItem>
                  </div>
                </>
              )}
            </Dropdown>
          </div>
        </div>
        {toolbar}
      </div>

      <div className="border-t border-border-subtle">
        <QueryState query={query} loading={<AssetsSkeleton />} empty={<AssetsEmpty onReset={onResetFilters} />} error={(_, retry) => <AssetsError onRetry={retry} />}>
          {() =>
            items.length === 0 ? (
              <AssetsEmpty onReset={onResetFilters} />
            ) : (
              <>
                {view === 'list' ? (
                  <AssetsTable items={pageItems} columns={columns} sort={sort} onSort={onSort} campaignName={campaignName} />
                ) : (
                  <AssetsGrid items={pageItems} campaignName={campaignName} />
                )}
                <Pagination
                  page={safePage}
                  pageCount={pageCount}
                  onPage={setPage}
                  rangeStart={(safePage - 1) * pageSize + 1}
                  rangeEnd={Math.min(safePage * pageSize, items.length)}
                  total={items.length}
                  pageSize={pageSize}
                  onPageSize={(n) => {
                    setPageSize(n);
                    setPage(1);
                  }}
                  pageSizes={PAGE_SIZES}
                />
              </>
            )
          }
        </QueryState>
      </div>
    </section>
  );
});
