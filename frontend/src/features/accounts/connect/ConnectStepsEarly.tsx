import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Misc';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { ConnectPrerequisite, ScopeDefinition } from '@/types/accounts';
import type { AccountType } from '@/types/domain';
import { META_DOCS_URL } from '../AccountsOverview';
import type { ConnectFormState } from './connectState';

type Patch = (p: Partial<ConnectFormState>) => void;

export function SecurityBanner() {
  const t = useT();
  return (
    <p className="flex items-center gap-2 text-body-sm text-text-secondary">
      <Icon name="verified_user" className="text-primary-container text-[1.125rem] flex-shrink-0" />
      {t('SocialBoard never asks for your Instagram password.')}
    </p>
  );
}

function CheckRow({ checked, onChange, label, readOnly }: { checked: boolean; onChange?: (v: boolean) => void; label: string; readOnly?: boolean }) {
  return (
    <label className={cn('flex items-start gap-2 bg-surface-card p-2.5 rounded-lg border transition-colors', checked ? 'border-emerald-800' : 'border-border-strong', !readOnly && 'cursor-pointer hover:border-slate-700')}>
      {readOnly ? (
        <Icon name="check_circle" filled className="text-status-active text-lg flex-shrink-0" />
      ) : (
        <input type="checkbox" checked={checked} onChange={(e) => onChange?.(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-700 text-text-primary focus:ring-0 cursor-pointer flex-shrink-0" />
      )}
      <span className="text-body-sm text-text-primary font-medium">{label}</span>
    </label>
  );
}

export function PrerequisitesSection({
  prerequisites,
  checked,
  onToggle,
  readOnly,
  error,
}: {
  prerequisites: ConnectPrerequisite[];
  checked: string[];
  onToggle?: (id: string, v: boolean) => void;
  readOnly?: boolean;
  error?: string;
}) {
  const t = useT();
  const done = prerequisites.filter((p) => checked.includes(p.id)).length;
  return (
    <div role="group" aria-labelledby="prereq-title">
      <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
        <h3 id="prereq-title" className="text-label-md font-semibold text-text-primary">
          {t('Before you start')}
        </h3>
        <span
          className={cn(
            'text-[0.6875rem] font-semibold px-2 py-0.5 rounded-full',
            done === prerequisites.length ? 'bg-status-active-subtle text-status-active' : 'bg-surface-card-subtle text-text-secondary',
          )}
        >
          {t('{done} of {total} done', { done, total: prerequisites.length })}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {prerequisites.map((p) => (
          <CheckRow key={p.id} label={p.label} checked={checked.includes(p.id)} readOnly={readOnly} onChange={(v) => onToggle?.(p.id, v)} />
        ))}
      </div>
      {error && (
        <p className="text-[0.6875rem] text-error font-medium mt-2" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const typeOptions: Array<{ value: AccountType; title: string; body: string; icon: string }> = [
  { value: 'business', title: msg('Business account'), body: msg('For brands and companies.'), icon: 'business_center' },
  { value: 'creator', title: msg('Creator account'), body: msg('For public figures and storytellers.'), icon: 'person' },
];

export function StepRequirements({ state, patch, prerequisites, errors }: { state: ConnectFormState; patch: Patch; prerequisites: ConnectPrerequisite[]; errors: Record<string, string> }) {
  const t = useT();
  return (
    <div className="space-y-6">
      <SecurityBanner />
      <fieldset>
        <legend className="text-label-md font-semibold text-text-primary mb-2">{t('Account type')}</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup">
          {typeOptions.map((o) => {
            const active = state.accountType === o.value;
            return (
              <label key={o.value} className={cn('flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors', active ? 'border-primary-container bg-amber-900/40' : 'border-border-strong hover:border-slate-700')}>
                <input type="radio" name="account-type" className="mt-1 h-4 w-4 text-text-primary focus:ring-0" checked={active} onChange={() => patch({ accountType: o.value })} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-label-md font-semibold text-text-primary">
                    <Icon name={o.icon} className="text-[1rem] text-text-secondary" />
                    {t(o.title)}
                  </span>
                  <span className="block text-body-sm text-text-secondary mt-0.5">{t(o.body)}</span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="text-[0.6875rem] text-text-tertiary mt-2">{t('Personal profiles cannot be connected.')}</p>
        {errors.accountType && (
          <p className="text-[0.6875rem] text-error font-medium mt-1" role="alert">
            {errors.accountType}
          </p>
        )}
      </fieldset>
      <PrerequisitesSection
        prerequisites={prerequisites}
        checked={state.prerequisites}
        error={errors.prerequisites}
        onToggle={(id, v) => patch({ prerequisites: v ? [...state.prerequisites, id] : state.prerequisites.filter((p) => p !== id) })}
      />
    </div>
  );
}

type Outcome = 'success' | 'permissions' | 'personal';

function OutcomePreviews() {
  const t = useT();
  const [outcome, setOutcome] = useState<Outcome>('success');
  const pills: Array<{ value: Outcome; label: string; active: string }> = [
    { value: 'success', label: t('Ready'), active: 'font-bold border-border-focused text-text-primary' },
    { value: 'permissions', label: t('Missing permission'), active: 'font-bold bg-status-paused-subtle border-status-paused text-status-paused' },
    { value: 'personal', label: t('Personal profile'), active: 'font-bold bg-error-container/40 border-error text-error' },
  ];
  return (
    <details className="group">
      <summary className="cursor-pointer select-none text-body-sm text-text-secondary hover:text-text-primary flex items-center gap-1.5 list-none">
        <Icon name="science" className="text-[1rem]" />
        {t('See what can happen after login')}
        <Icon name="expand_more" className="text-[1rem] transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3">
        <div className="flex gap-2 mb-3 flex-wrap" role="tablist" aria-label={t('Possible results')}>
          {pills.map((p) => (
            <button
              key={p.value}
              type="button"
              role="tab"
              aria-selected={outcome === p.value}
              onClick={() => setOutcome(p.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-label-sm bg-surface-card border transition-all',
                outcome === p.value ? p.active : 'font-medium border-border-strong text-text-secondary hover:text-text-primary',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="p-3.5 rounded-xl border border-border-strong bg-surface-card" role="tabpanel">
          {outcome === 'success' && (
            <div className="flex items-center gap-3">
              <Icon name="verified" className="text-xl text-status-active" />
              <div>
                <p className="font-semibold text-text-primary">{t('Account ready to sync')}</p>
                <p className="text-body-sm text-text-secondary">{t('The login lasts 60 days and then needs renewing.')}</p>
              </div>
            </div>
          )}
          {outcome === 'permissions' && (
            <div className="flex items-start gap-3">
              <Icon name="warning" className="text-xl text-status-paused flex-shrink-0" />
              <div>
                <p className="font-semibold text-text-primary">{t('A permission is missing')}</p>
                <p className="text-body-sm text-text-secondary">{t('This happens when you are not an admin of the linked Facebook Page.')}</p>
              </div>
            </div>
          )}
          {outcome === 'personal' && (
            <div className="flex items-start gap-3">
              <Icon name="error" className="text-xl text-error flex-shrink-0" />
              <div>
                <p className="font-semibold text-text-primary">{t('Personal profiles are not supported')}</p>
                <p className="text-body-sm text-text-secondary">{t('Switch to a Business or Creator account in the Instagram app settings.')}</p>
                <a className="text-label-sm text-tertiary font-semibold underline inline-block pt-1" href={META_DOCS_URL} target="_blank" rel="noopener noreferrer">
                  {t('Instagram API docs')}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

export function ScopesDisclosure({ scopes }: { scopes: ScopeDefinition[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const mandatory = scopes.filter((s) => s.mandatory);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="scopes-disclosure"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-body-sm text-text-secondary hover:text-text-primary"
      >
        <Icon name="policy" className="text-[1rem]" />
        {t('Permissions we ask for ({count})', { count: mandatory.length })}
        <Icon name={open ? 'expand_less' : 'expand_more'} className="text-[1rem]" />
      </button>
      {open && (
        <ul id="scopes-disclosure" className="mt-3 divide-y divide-border-subtle">
          {mandatory.map((s) => (
            <li key={s.scope} className="py-2.5">
              <code className="text-[0.75rem] text-primary font-semibold">{s.scope}</code>
              <p className="text-body-sm text-text-secondary">{s.connectDescription}</p>
            </li>
          ))}
          <li className="py-2.5 text-[0.75rem] text-text-tertiary">{t('Age and gender need at least 100 followers. Story data lasts 24 hours.')}</li>
        </ul>
      )}
    </div>
  );
}

export function StepAuthorization({
  state,
  patch,
  prerequisites,
  scopes,
  error,
}: {
  state: ConnectFormState;
  patch: Patch;
  prerequisites: ConnectPrerequisite[];
  scopes: ScopeDefinition[];
  error?: string;
}) {
  const t = useT();
  return (
    <div className="space-y-6">
      <PrerequisitesSection prerequisites={prerequisites} checked={state.prerequisites} readOnly />

      <div className="p-5 rounded-xl border border-primary-container/40 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-label-md font-semibold text-text-primary flex items-center gap-2">
              <Icon name="key" className="text-primary text-xl" />
              {t('Log in with Facebook')}
            </h3>
            <p className="text-body-sm text-text-secondary mt-1 max-w-xl">{t('You approve access on Facebook, then pick your pages.')}</p>
          </div>
          <button
            type="button"
            onClick={() => patch({ authAttempted: true })}
            className="flex-shrink-0 flex items-center justify-center gap-2 bg-primary-container hover:bg-brand-primary-hover text-on-primary-container font-bold text-label-md px-5 py-3 rounded-lg shadow-sm transition-all duration-150 hover:-translate-y-0.5"
          >
            <Icon name="lock" className="text-lg" />
            <span>{t('Continue with Facebook')}</span>
          </button>
        </div>

        {(state.authAttempted || state.demoMode) && (
          <div className="space-y-3" aria-live="polite">
            <Notice tone="warning" icon="cloud_off" title={t('Real login is not available in this demo')}>
              {t('Nothing was sent to Facebook.')}
            </Notice>
            {state.demoMode ? (
              <p className="text-body-sm text-ai-accent flex items-center gap-1.5">
                <Icon name="science" className="text-[1rem]" />
                {t('Demo on: the next steps use sample accounts.')}
              </p>
            ) : (
              <Button variant="dark" icon="science" onClick={() => patch({ demoMode: true })}>
                {t('Use a demo account')}
              </Button>
            )}
          </div>
        )}
        {error && (
          <p className="text-[0.6875rem] text-error font-medium" role="alert">
            {error}
          </p>
        )}
      </div>

      <ScopesDisclosure scopes={scopes} />
      <OutcomePreviews />
      <SecurityBanner />
    </div>
  );
}
