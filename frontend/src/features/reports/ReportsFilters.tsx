import { Button } from '@/components/ui/Button';
import { Dropdown, MenuItem, SearchInput, Select } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n/I18nContext';
import type { InstagramAccount } from '@/types/domain';
import type { ReportStatus, ReportType } from '@/types/reports';
import { reportStatusMeta, reportTypeOptions } from './reportOptions';

export interface ReportFilters {
  search: string;
  type: 'all' | ReportType;
  status: 'all' | ReportStatus;
  account: string;
}

export const defaultReportFilters: ReportFilters = { search: '', type: 'all', status: 'all', account: 'acc-ekoindia' };

/** Search + Type + Status. The account filter sits behind "Filters" and only shows when there is more than one account. */
export function ReportsFilterBar({ filters, onChange, accounts }: { filters: ReportFilters; onChange: (f: ReportFilters) => void; accounts: InstagramAccount[] }) {
  const t = useT();
  const set = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => onChange({ ...filters, [key]: value });
  const changed = JSON.stringify(filters) !== JSON.stringify(defaultReportFilters);
  return (
    <section className="flex flex-col md:flex-row md:items-center gap-3">
      <SearchInput
        containerClassName="flex-1 md:max-w-sm"
        aria-label={t('Search reports')}
        placeholder={t('Search reports')}
        value={filters.search}
        onChange={(e) => set('search', e.target.value)}
      />
      <div className="flex items-center flex-wrap gap-2">
        <Select aria-label={t('Type')} value={filters.type} onChange={(e) => set('type', e.target.value as ReportFilters['type'])}>
          <option value="all">{t('All types')}</option>
          {reportTypeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.label)}
            </option>
          ))}
        </Select>
        <Select aria-label={t('Status')} value={filters.status} onChange={(e) => set('status', e.target.value as ReportFilters['status'])}>
          <option value="all">{t('All statuses')}</option>
          {(Object.keys(reportStatusMeta) as ReportStatus[]).map((s) => (
            <option key={s} value={s}>
              {t(reportStatusMeta[s].filterLabel)}
            </option>
          ))}
        </Select>
        {accounts.length > 1 && (
          <Dropdown
            label={t('Instagram account')}
            trigger={({ toggle, open }) => (
              <Button onClick={toggle} aria-expanded={open} icon="tune" className="h-9">
                {t('Filters')}
                {filters.account !== 'all' && <span className="w-1.5 h-1.5 rounded-full bg-primary-container" aria-hidden />}
              </Button>
            )}
          >
            {(close) => (
              <>
                <p className="px-3 pt-1 pb-1.5 text-[0.6875rem] font-semibold text-text-tertiary">{t('Instagram account')}</p>
                <MenuItem active={filters.account === 'all'} onClick={() => (close(), set('account', 'all'))}>
                  {t('All accounts')}
                </MenuItem>
                {accounts.map((a) => (
                  <MenuItem key={a.id} active={filters.account === a.id} onClick={() => (close(), set('account', a.id))}>
                    @{a.handle}
                  </MenuItem>
                ))}
              </>
            )}
          </Dropdown>
        )}
        {changed && (
          <button
            type="button"
            onClick={() => onChange(defaultReportFilters)}
            className="h-9 px-2 rounded-lg text-label-md font-semibold text-text-secondary hover:text-text-primary flex items-center gap-1"
            aria-label={t('Reset filters')}
          >
            <Icon name="restart_alt" className="text-[1.125rem]" />
            {t('Reset')}
          </button>
        )}
      </div>
    </section>
  );
}
