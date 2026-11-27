import { useId, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { AccountStatus, AccountType, InstagramAccount } from '@/types/domain';
import { accountTypeLabel, dataLevelLabel, dataLevelOf, statusFilterLabel, type DataLevel } from './accountMeta';

export interface AccountFilters {
  search: string;
  status: AccountStatus | 'all';
  type: AccountType | 'all';
  level: DataLevel | 'all';
}

export const defaultAccountFilters: AccountFilters = { search: '', status: 'all', type: 'all', level: 'all' };

export function applyAccountFilters(accounts: InstagramAccount[], f: AccountFilters) {
  const q = f.search.trim().toLowerCase().replace(/^@/, '');
  return accounts.filter(
    (a) =>
      (f.status === 'all' || a.status === f.status) &&
      (f.type === 'all' || a.type === f.type) &&
      (f.level === 'all' || dataLevelOf(a) === f.level) &&
      (!q || a.displayName.toLowerCase().includes(q) || a.handle.toLowerCase().includes(q) || a.externalId.toLowerCase().includes(q) || a.id.includes(q)),
  );
}

function InlineSelect<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }> }) {
  const id = useId();
  return (
    <div className="flex items-center border border-border-strong rounded-lg bg-surface-card px-2.5 h-9 text-label-md">
      <label htmlFor={id} className="text-text-secondary text-[0.75rem] mr-1.5 whitespace-nowrap">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-transparent border-0 py-0 pl-0 pr-6 text-text-primary font-semibold focus:ring-0 text-label-md cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Search + status filter; type and data filters open with "Filters"; plus "Sync all". */
export function AccountsToolbar({
  accounts,
  filters,
  onChange,
  onSyncAll,
  syncingAll,
}: {
  accounts: InstagramAccount[];
  filters: AccountFilters;
  onChange: (f: AccountFilters) => void;
  onSyncAll: () => void;
  syncingAll: boolean;
}) {
  const t = useT();
  const extraActive = filters.type !== 'all' || filters.level !== 'all';
  const [more, setMore] = useState(extraActive);
  const count = (pred: (a: InstagramAccount) => boolean) => accounts.filter(pred).length;
  const statuses: AccountStatus[] = ['connected', 'syncing', 'action_required', 'expired'];
  const levels: DataLevel[] = ['full', 'partial', 'none'];
  const types: AccountType[] = ['business', 'creator'];

  return (
    <section className="flex flex-col gap-3" aria-label={t('Filter accounts')}>
      <div className="flex flex-col md:flex-row md:items-center gap-2">
        <div className="relative flex-1 md:max-w-sm">
          <Icon name="search" className="absolute left-2.5 top-2 text-text-tertiary text-[1.125rem] pointer-events-none" />
          <input
            type="search"
            aria-label={t('Search accounts')}
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-full h-9 pl-8 pr-3 bg-slate-950 border border-slate-700 rounded-lg text-label-md text-text-primary placeholder:text-text-tertiary focus:border-border-focused focus:ring-1 focus:ring-border-focused"
            placeholder={t('Search by name or @username')}
          />
        </div>
        <InlineSelect
          label={t('Status')}
          value={filters.status}
          onChange={(status) => onChange({ ...filters, status })}
          options={[
            { value: 'all', label: t('All ({count})', { count: accounts.length }) },
            ...statuses.map((s) => ({ value: s, label: `${t(statusFilterLabel[s])} (${count((a) => a.status === s)})` })),
          ]}
        />
        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          aria-expanded={more}
          className={cn(
            'h-9 px-3 rounded-lg border text-label-md font-semibold flex items-center gap-1.5',
            extraActive ? 'border-primary-container text-text-primary' : 'border-border-strong text-text-secondary hover:text-text-primary',
          )}
        >
          <Icon name="tune" className="text-[1rem]" />
          {t('Filters')}
        </button>
        <button
          type="button"
          onClick={onSyncAll}
          disabled={syncingAll}
          className="md:ml-auto h-9 px-3 bg-surface-card hover:bg-slate-800 text-text-primary border border-border-strong rounded-lg text-label-md font-semibold flex items-center gap-1.5 transition disabled:opacity-60"
        >
          <Icon name={syncingAll ? 'progress_activity' : 'sync'} className={syncingAll ? 'text-[1rem] animate-spin' : 'text-[1rem]'} />
          <span>{t('Sync all')}</span>
        </button>
      </div>
      {more && (
        <div className="flex flex-wrap items-center gap-2">
          <InlineSelect
            label={t('Type')}
            value={filters.type}
            onChange={(type) => onChange({ ...filters, type })}
            options={[{ value: 'all', label: t('All types') }, ...types.map((ty) => ({ value: ty, label: `${t(accountTypeLabel[ty])} (${count((a) => a.type === ty)})` }))]}
          />
          <InlineSelect
            label={t('Data')}
            value={filters.level}
            onChange={(level) => onChange({ ...filters, level })}
            options={[{ value: 'all', label: t('All') }, ...levels.map((l) => ({ value: l, label: `${t(dataLevelLabel[l])} (${count((a) => dataLevelOf(a) === l)})` }))]}
          />
        </div>
      )}
    </section>
  );
}
