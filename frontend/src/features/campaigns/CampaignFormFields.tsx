import { useId } from 'react';
import { Field, Select, TextInput } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { InstagramAccount } from '@/types/domain';
import { AGE_GROUP_OPTIONS, OBJECTIVE_LABEL, OBJECTIVES, parseHashtags, REGION_OPTIONS, type CampaignFormErrors, type CampaignFormValues } from './campaignUtils';

interface FieldsProps {
  values: CampaignFormValues;
  errors: CampaignFormErrors;
  onChange: (patch: Partial<CampaignFormValues>) => void;
}

/** Wizard step 1 / edit form: name, goal, lead goal, dates, budget. */
export function BasicsFields({ values, errors, onChange, autoFocus }: FieldsProps & { autoFocus?: boolean }) {
  const t = useT();
  const id = useId();
  const err = (k: keyof CampaignFormValues) => (errors[k] ? t(errors[k]!) : undefined);
  return (
    <div className="space-y-4">
      <Field label={t('Name')} required htmlFor={`${id}-name`} error={err('name')}>
        <TextInput
          id={`${id}-name`}
          value={values.name}
          invalid={!!errors.name}
          data-autofocus={autoFocus || undefined}
          placeholder={t('e.g. Bihar CSP sign-ups, November')}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t('Goal')} htmlFor={`${id}-objective`}>
          <Select id={`${id}-objective`} value={values.objective} onChange={(e) => onChange({ objective: e.target.value as CampaignFormValues['objective'] })} className="w-full">
            {OBJECTIVES.map((o) => (
              <option key={o} value={o}>
                {t(OBJECTIVE_LABEL[o])}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('Lead target')} htmlFor={`${id}-goal`} error={err('leadGoal')} hint={t('Optional')}>
          <TextInput id={`${id}-goal`} inputMode="numeric" value={values.leadGoal} invalid={!!errors.leadGoal} placeholder="300" onChange={(e) => onChange({ leadGoal: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t('Start date')} htmlFor={`${id}-start`} error={err('startDate')}>
          <TextInput id={`${id}-start`} type="date" value={values.startDate} invalid={!!errors.startDate} onChange={(e) => onChange({ startDate: e.target.value })} />
        </Field>
        <Field label={t('End date')} htmlFor={`${id}-end`} error={err('endDate')}>
          <TextInput id={`${id}-end`} type="date" value={values.endDate} min={values.startDate || undefined} invalid={!!errors.endDate} onChange={(e) => onChange({ endDate: e.target.value })} />
        </Field>
      </div>
      <Field label={t('Budget (₹)')} htmlFor={`${id}-budget`} error={err('budget')} hint={t('Optional. For planning only, no ads are bought.')}>
        <TextInput id={`${id}-budget`} inputMode="numeric" value={values.budget} invalid={!!errors.budget} placeholder="250000" onChange={(e) => onChange({ budget: e.target.value })} />
      </Field>
    </div>
  );
}

/** Wizard step 2 / edit form: Instagram account (connected only) + tracking hashtags. */
export function AccountFields({ values, errors, onChange, accounts }: FieldsProps & { accounts: InstagramAccount[] }) {
  const t = useT();
  const id = useId();
  const tags = parseHashtags(values.hashtags);
  return (
    <div className="space-y-4">
      <Field label={t('Instagram account')} required htmlFor={`${id}-acc`} error={errors.accountId ? t(errors.accountId) : undefined} hint={t('Only connected accounts can be used.')}>
        <Select id={`${id}-acc`} value={values.accountId} onChange={(e) => onChange({ accountId: e.target.value })} className={cn('w-full', errors.accountId && 'border-error')}>
          <option value="">{t('Pick an account…')}</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id} disabled={a.status !== 'connected'}>
              {a.status !== 'connected' ? t('{name} (not connected)', { name: `${a.displayName} (@${a.handle})` }) : `${a.displayName} (@${a.handle})`}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('Hashtags')} htmlFor={`${id}-tags`} hint={t('Posts with these hashtags count for this campaign.')}>
        <TextInput id={`${id}-tags`} value={values.hashtags} placeholder="#SBICSP #EkoIndia" onChange={(e) => onChange({ hashtags: e.target.value })} />
      </Field>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label={t('Hashtags')}>
          {tags.map((tag) => (
            <span key={tag} className="px-2.5 py-0.5 rounded-full bg-surface-card-subtle text-[0.75rem] font-semibold text-text-secondary">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Wizard step 3 / edit form: target states + age group. */
export function AudienceFields({ values, onChange }: Omit<FieldsProps, 'errors'>) {
  const t = useT();
  const id = useId();
  const toggle = (region: string) =>
    onChange({ targetRegions: values.targetRegions.includes(region) ? values.targetRegions.filter((r) => r !== region) : [...values.targetRegions, region] });
  return (
    <div className="space-y-4">
      <div>
        <span className="text-label-sm text-text-primary font-semibold block mb-1.5" id={`${id}-regions`}>
          {t('States')}
        </span>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${id}-regions`}>
          {REGION_OPTIONS.map((r) => {
            const on = values.targetRegions.includes(r);
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(r)}
                className={cn(
                  'px-3 py-1 rounded-full text-[0.75rem] flex items-center gap-1 transition-colors',
                  on ? 'bg-amber-900/40 text-amber-300 font-semibold' : 'bg-surface-canvas border border-border-strong text-text-secondary hover:text-text-primary',
                )}
              >
                {r}
                <Icon name={on ? 'close' : 'add'} className="text-[0.875rem]" />
              </button>
            );
          })}
        </div>
        <p className="text-[0.75rem] text-text-tertiary mt-1.5">
          {values.targetRegions.length === 0 ? t('None picked: all states.') : t('Picked: {count}', { count: values.targetRegions.length })}
        </p>
      </div>
      <Field label={t('Age group')} htmlFor={`${id}-age`}>
        <Select id={`${id}-age`} value={values.primaryAgeGroup} onChange={(e) => onChange({ primaryAgeGroup: e.target.value })} className="w-full">
          <option value="">{t('Not set')}</option>
          {AGE_GROUP_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {t(o)}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
