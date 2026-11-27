import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { Campaign, ContentType } from '@/types/domain';
import { contentTypeMeta, contentTypeOrder } from '../contentMeta';
import { sortOptions, type LibraryFilters, type LibrarySort } from './filters';

const selectCls =
  'h-9 pl-3 pr-8 rounded-full border border-border-strong bg-surface-canvas text-text-primary text-label-md focus:border-border-focused focus:ring-0 outline-none cursor-pointer appearance-none max-w-[14rem] truncate';

const ALL_LABEL = msg('All');

/** Search, type tabs (with counts), campaign filter and a small "Sort" menu. */
export function LibraryFilterBar({
  filters,
  onFilters,
  sort,
  onSort,
  campaigns,
  counts,
}: {
  filters: LibraryFilters;
  onFilters: (f: LibraryFilters) => void;
  sort: LibrarySort;
  onSort: (s: LibrarySort) => void;
  campaigns: Campaign[] | undefined;
  /** Count per tab after search + campaign filters; undefined while loading. */
  counts: Record<ContentType | 'all', number> | undefined;
}) {
  const t = useT();
  const activeSort = sort.direction === 'desc' ? sortOptions.find((o) => o.value === sort.key) : undefined;
  const tabs: Array<{ value: ContentType | 'all'; label: string }> = [{ value: 'all', label: ALL_LABEL }, ...contentTypeOrder.map((c) => ({ value: c, label: contentTypeMeta[c].plural }))];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-0 sm:min-w-[220px] max-w-md w-full sm:w-auto">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          <input
            type="search"
            aria-label={t('Search posts')}
            value={filters.search}
            onChange={(e) => onFilters({ ...filters, search: e.target.value })}
            className="w-full h-9 pl-9 pr-3 rounded-full border border-border-strong bg-surface-canvas text-text-primary placeholder:text-text-tertiary text-body-sm focus:border-border-focused focus:ring-1 focus:ring-border-focused outline-none transition-all"
            placeholder={t('Search posts')}
          />
        </div>
        <div className="relative">
          <select aria-label={t('Campaign')} className={selectCls} value={filters.campaignId} onChange={(e) => onFilters({ ...filters, campaignId: e.target.value })}>
            <option value="all">{t('All campaigns')}</option>
            {campaigns?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="none">{t('No campaign')}</option>
          </select>
          <Icon name="expand_more" className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary text-[1rem]" />
        </div>
        <Dropdown
          label={t('Sort')}
          trigger={({ toggle, open }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="h-9 flex items-center gap-1.5 px-3 rounded-full border border-border-strong text-text-secondary hover:text-text-primary text-label-md"
            >
              <Icon name="sort" className="text-[1rem]" />
              <span>{activeSort ? t(activeSort.label) : t('Sort')}</span>
            </button>
          )}
        >
          {(close) => (
            <>
              {sortOptions.map((o) => (
                <MenuItem
                  key={o.value}
                  active={activeSort?.value === o.value}
                  onClick={() => {
                    onSort({ key: o.value, direction: 'desc' });
                    close();
                  }}
                >
                  {t(o.label)}
                </MenuItem>
              ))}
            </>
          )}
        </Dropdown>
      </div>
      <div role="tablist" aria-label={t('Type')} className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full">
        {tabs.map((tab) => {
          const active = filters.type === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onFilters({ ...filters, type: tab.value })}
              className={cn(
                'px-3 py-1 text-label-sm rounded-full whitespace-nowrap border transition-colors',
                active ? 'bg-primary-container border-primary-container text-on-primary-container font-semibold' : 'border-border-strong text-text-secondary hover:text-text-primary font-medium',
              )}
            >
              {t(tab.label)} <span className="tnum opacity-80">{counts ? counts[tab.value] : '–'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
