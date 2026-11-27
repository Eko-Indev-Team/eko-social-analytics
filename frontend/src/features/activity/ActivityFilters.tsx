import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SearchInput, Select } from '@/components/ui/Controls';
import { useT } from '@/i18n/I18nContext';
import type { ActivityActor, ActivityCategory } from '@/types/activity';
import type { InstagramAccount } from '@/types/domain';
import { categoryLabels, dateScopes, defaultFilters, outcomeLabels, type ActivityFilterState, type DateScope, type OutcomeFilter } from './activityUi';

/** Search, Type and Result up front; Who, Account and Dates sit behind "Filters". */
export function ActivityFilters({
  filters,
  onChange,
  actors,
  accounts,
  matchCount,
}: {
  filters: ActivityFilterState;
  onChange: (patch: Partial<ActivityFilterState>) => void;
  actors: ActivityActor[];
  accounts: InstagramAccount[];
  matchCount: number;
}) {
  const t = useT();
  const members = actors.filter((a) => a.kind === 'member');
  const systems = actors.filter((a) => a.kind !== 'member');
  const extraCount = [filters.actor, filters.account, filters.date !== defaultFilters.date].filter(Boolean).length;
  const [open, setOpen] = useState(extraCount > 0);
  const isDefault = JSON.stringify(filters) === JSON.stringify(defaultFilters);

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <SearchInput
          containerClassName="flex-1 md:max-w-sm"
          aria-label={t('Search activity')}
          placeholder={t('Search activity')}
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
        <div className="flex items-center flex-wrap gap-2">
          <Select aria-label={t('Type')} value={filters.category} onChange={(e) => onChange({ category: e.target.value as ActivityCategory | '' })}>
            <option value="">{t('All types')}</option>
            {(Object.keys(categoryLabels) as ActivityCategory[]).map((c) => (
              <option key={c} value={c}>
                {t(categoryLabels[c])}
              </option>
            ))}
          </Select>
          <Select aria-label={t('Result')} value={filters.outcome} onChange={(e) => onChange({ outcome: e.target.value as OutcomeFilter })}>
            <option value="">{t('All results')}</option>
            <option value="success">{t(outcomeLabels.success)}</option>
            <option value="in_progress">{t(outcomeLabels.in_progress)}</option>
            <option value="warning">{t(outcomeLabels.warning)}</option>
            <option value="failed">{t(outcomeLabels.failed)}</option>
            <option value="resolved">{t(outcomeLabels.resolved)}</option>
            <option value="issues">{t('All problems')}</option>
          </Select>
          <Button icon="tune" className="h-9" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {extraCount > 0 ? t('Filters ({count})', { count: extraCount }) : t('Filters')}
          </Button>
          {!isDefault && (
            <button type="button" onClick={() => onChange(defaultFilters)} className="text-label-md font-semibold text-text-secondary hover:text-text-primary px-1">
              {t('Clear filters')}
            </button>
          )}
        </div>
        <span className="text-body-sm text-text-tertiary md:ml-auto tnum">{t('{count} events', { count: matchCount })}</span>
      </div>

      {open && (
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label={t('Who')} value={filters.actor} onChange={(e) => onChange({ actor: e.target.value })}>
            <option value="">{t('Everyone')}</option>
            <option value="kind:automated">{t('Automatic only')}</option>
            <option value="kind:member">{t('People only')}</option>
            <optgroup label={t('Automatic')}>
              {systems.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.shortLabel}
                </option>
              ))}
            </optgroup>
            <optgroup label={t('People')}>
              {members.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </optgroup>
          </Select>
          <Select aria-label={t('Instagram account')} value={filters.account} onChange={(e) => onChange({ account: e.target.value })}>
            <option value="">{t('All accounts')}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                @{a.handle}
              </option>
            ))}
          </Select>
          <Select aria-label={t('Dates')} value={filters.date} onChange={(e) => onChange({ date: e.target.value as DateScope })}>
            {(Object.keys(dateScopes) as DateScope[]).map((d) => (
              <option key={d} value={d}>
                {t(dateScopes[d].label)}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}
