import { leadStatusLabel } from '@/components/ui/Badge';
import { SearchInput, Select } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { QUALIFICATION_ORDER, qualificationLabel } from '@/features/ads/QualificationBadge';
import { useT } from '@/i18n/I18nContext';
import type { QualificationStatus } from '@/lib/qualification';
import type { Campaign, LeadStatus } from '@/types/domain';
import { leadStatuses } from './leadUtils';

export interface LeadFilters {
  search: string;
  status: LeadStatus | 'all';
  campaignId: string;
  /** SBI / ESAF fit; 'unchecked' = no qualification answers yet. */
  fit: QualificationStatus | 'unchecked' | 'all';
}

export const emptyLeadFilters: LeadFilters = { search: '', status: 'all', campaignId: 'all', fit: 'all' };

/** Search + status + campaign filters, plus an optional "content source" chip from `?content=`. */
export function LeadsFilters({
  filters,
  onChange,
  campaigns,
  contentChip,
  onClearContent,
  onReset,
  hasActive,
}: {
  filters: LeadFilters;
  onChange: (next: LeadFilters) => void;
  campaigns: Campaign[];
  contentChip: string | null;
  onClearContent: () => void;
  onReset: () => void;
  hasActive: boolean;
}) {
  const t = useT();
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-2 px-5 pb-4">
      <SearchInput
        containerClassName="w-full lg:w-72"
        placeholder={t('Search leads')}
        aria-label={t('Search by name, handle or place')}
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label={t('Filter by status')} value={filters.status} onChange={(e) => onChange({ ...filters, status: e.target.value as LeadFilters['status'] })}>
          <option value="all">{t('All statuses')}</option>
          {leadStatuses.map((s) => (
            <option key={s} value={s}>
              {t(leadStatusLabel(s))}
            </option>
          ))}
        </Select>
        <Select aria-label={t('Filter by fit')} value={filters.fit} onChange={(e) => onChange({ ...filters, fit: e.target.value as LeadFilters['fit'] })}>
          <option value="all">{t('Any fit')}</option>
          {QUALIFICATION_ORDER.map((s) => (
            <option key={s} value={s}>
              {t(qualificationLabel(s))}
            </option>
          ))}
          <option value="unchecked">{t('Not checked')}</option>
        </Select>
        <Select aria-label={t('Filter by campaign')} value={filters.campaignId} onChange={(e) => onChange({ ...filters, campaignId: e.target.value })} className="max-w-[240px]">
          <option value="all">{t('All campaigns')}</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        {contentChip && (
          <span className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-primary-container/15 border border-primary-container/40 text-[0.75rem] font-semibold text-primary max-w-full">
            <span className="truncate">{t('Post: {title}', { title: contentChip })}</span>
            <button type="button" onClick={onClearContent} className="p-0.5 rounded-full hover:bg-primary-container/30" aria-label={t('Remove post filter')}>
              <Icon name="close" className="text-[0.875rem]" />
            </button>
          </span>
        )}
        {hasActive && (
          <button type="button" onClick={onReset} className="text-label-md font-semibold text-text-secondary hover:text-text-primary px-2">
            {t('Clear filters')}
          </button>
        )}
      </div>
    </div>
  );
}
