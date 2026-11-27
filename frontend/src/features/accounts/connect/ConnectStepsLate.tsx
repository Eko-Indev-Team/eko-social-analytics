import { Field, Select, Toggle } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Misc';
import { msg, useT, type Translate } from '@/i18n/I18nContext';
import { cn, formatCompact } from '@/lib/format';
import type { ConnectCandidate, ScopeDefinition } from '@/types/accounts';
import { accountTypeLabel } from '../accountMeta';
import { backfillOptions, cadenceOptions, type ConnectFormState } from './connectState';

type Patch = (p: Partial<ConnectFormState>) => void;

const outcomeMeta: Record<ConnectCandidate['outcome'], { label: string; cls: string; icon: string; selectable: boolean }> = {
  ready: { label: msg('Can connect'), cls: 'bg-status-active-subtle text-status-active border-emerald-800', icon: 'check_circle', selectable: true },
  already_linked: { label: msg('Already added'), cls: 'bg-surface-card-subtle text-text-secondary border-border-strong', icon: 'link', selectable: false },
  insufficient_permissions: { label: msg('Missing permission'), cls: 'bg-status-paused-subtle text-status-paused border-amber-800', icon: 'warning', selectable: false },
  personal: { label: msg('Personal profile, not supported'), cls: 'bg-error-container/60 text-on-error-container border-error/20', icon: 'error', selectable: false },
};

export const isSelectableCandidate = (c: ConnectCandidate | undefined) => !!c && outcomeMeta[c.outcome].selectable;

const candidateTypeLabel = (c: ConnectCandidate, t: Translate) => (c.type === 'personal' ? t('Personal profile') : t(accountTypeLabel[c.type]));

export function StepScopes({
  state,
  patch,
  candidates,
  scopes,
  errors,
}: {
  state: ConnectFormState;
  patch: Patch;
  candidates: ConnectCandidate[];
  scopes: ScopeDefinition[];
  errors: Record<string, string>;
}) {
  const t = useT();
  const selected = candidates.find((c) => c.id === state.candidateId);
  return (
    <div className="space-y-6">
      <div role="group" aria-labelledby="candidate-title" className="space-y-2">
        <h3 id="candidate-title" className="text-label-md font-semibold text-text-primary flex items-center gap-2 flex-wrap">
          {t('Pick an account')}
          <span className="text-[0.6875rem] font-medium text-text-tertiary">{t('Sample accounts')}</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" role="radiogroup" aria-labelledby="candidate-title">
          {candidates.map((c) => {
            const meta = outcomeMeta[c.outcome];
            const active = state.candidateId === c.id;
            return (
              <label
                key={c.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                  active ? (meta.selectable ? 'border-primary-container bg-amber-900/40' : 'border-error/40 bg-error-container/10') : 'border-border-strong hover:border-slate-700',
                )}
              >
                <input type="radio" name="candidate" className="mt-1 h-4 w-4 text-text-primary focus:ring-0" checked={active} onChange={() => patch({ candidateId: c.id })} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-label-md font-semibold text-text-primary">{c.displayName}</span>
                    <span className="text-body-sm text-text-secondary">@{c.handle}</span>
                  </span>
                  <span className="block text-body-sm text-text-secondary mt-0.5">
                    {candidateTypeLabel(c, t)} · {t('{count} followers', { count: formatCompact(c.followers) })}
                  </span>
                  <span className={cn('inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold border', meta.cls)}>
                    <Icon name={meta.icon} className="text-[0.8125rem]" />
                    {t(meta.label)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {selected && !isSelectableCandidate(selected) && (
          <Notice tone="warning" title={t(outcomeMeta[selected.outcome].label)}>
            {selected.outcomeNote}
          </Notice>
        )}
        {errors.candidate && (
          <p className="text-[0.6875rem] text-error font-medium" role="alert">
            {errors.candidate}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-label-md font-semibold text-text-primary">{t('Permissions we ask for')}</h3>
        <ul className="divide-y divide-border-subtle">
          {scopes.map((s) => (
            <li key={s.scope} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <code className="text-[0.75rem] text-primary font-semibold">{s.scope}</code>
                <p className="text-body-sm text-text-secondary mt-0.5">{s.connectDescription}</p>
              </div>
              {s.mandatory ? (
                <span className="text-[0.6875rem] font-semibold text-status-active bg-status-active-subtle px-2 py-0.5 rounded-full whitespace-nowrap">{t('Required')}</span>
              ) : (
                <Toggle
                  checked={state.includeOptionalScopes}
                  onChange={(v) => patch({ includeOptionalScopes: v })}
                  label={<span className="sr-only">{t('Ask for optional permission {scope}', { scope: s.scope })}</span>}
                  className="shrink-0"
                />
              )}
            </li>
          ))}
        </ul>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={state.scopesAcknowledged}
            onChange={(e) => patch({ scopesAcknowledged: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-slate-700 text-text-primary focus:ring-0 cursor-pointer"
            aria-invalid={!!errors.ack || undefined}
          />
          <span className="text-body-sm text-text-primary">
            {t('I understand SocialBoard can only read insights and comments. It never sees direct messages or changes settings.')}
            <span className="text-error ml-0.5">*</span>
          </span>
        </label>
        {errors.ack && (
          <p className="text-[0.6875rem] text-error font-medium" role="alert">
            {errors.ack}
          </p>
        )}
      </div>
    </div>
  );
}

export function StepConfirm({ state, patch, candidate, scopes }: { state: ConnectFormState; patch: Patch; candidate: ConnectCandidate | undefined; scopes: ScopeDefinition[] }) {
  const t = useT();
  const requested = scopes.filter((s) => s.mandatory || state.includeOptionalScopes);
  return (
    <div className="space-y-6">
      <p className="flex items-center gap-2 text-body-sm text-status-paused">
        <Icon name="cloud_off" className="text-[1.125rem]" />
        {t('Demo only: finishing does not connect anything.')}
      </p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-body-sm">
        <div>
          <dt className="text-text-secondary">{t('Account')}</dt>
          <dd className="text-text-primary font-semibold">
            {candidate ? (
              <>
                {candidate.displayName} <span className="font-normal text-text-secondary">@{candidate.handle}</span>
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-text-secondary">{t('Account type')}</dt>
          <dd className="text-text-primary font-semibold">{candidate ? candidateTypeLabel(candidate, t) : '—'}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">{t('Facebook Page')}</dt>
          <dd className="text-text-primary font-semibold">{candidate?.facebookPage ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">{t('Status')}</dt>
          <dd className="text-text-primary font-semibold">{t('Demo, not connected')}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-text-secondary mb-1">{t('Permissions')}</dt>
          <dd className="flex flex-wrap gap-1.5">
            {requested.map((s) => (
              <code key={s.scope} className="text-[0.75rem] text-primary bg-surface-canvas px-2 py-0.5 rounded-full">
                {s.scope}
              </code>
            ))}
          </dd>
        </div>
      </dl>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t('How often to sync')} htmlFor="connect-cadence">
          <Select id="connect-cadence" value={state.cadence} onChange={(e) => patch({ cadence: e.target.value })}>
            {cadenceOptions.map((o) => (
              <option key={o} value={o}>
                {t(o)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('Past data to load')} htmlFor="connect-backfill" hint={t('Up to 10,000 older posts.')}>
          <Select id="connect-backfill" value={state.backfill} onChange={(e) => patch({ backfill: e.target.value })}>
            {backfillOptions.map((o) => (
              <option key={o} value={o}>
                {t(o)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </div>
  );
}

export function ConnectDone({ state, candidate }: { state: ConnectFormState; candidate: ConnectCandidate | undefined }) {
  const t = useT();
  const rows: Array<[string, string]> = [
    [t('Sample account'), candidate ? `@${candidate.handle}` : '—'],
    [t('Status'), t('Demo, not connected')],
    [t('How often to sync'), t(state.cadence)],
    [t('Past data to load'), t(state.backfill)],
  ];
  return (
    <div className="text-center py-6 space-y-4">
      <div className="w-14 h-14 rounded-full bg-ai-subtle flex items-center justify-center mx-auto text-ai-accent">
        <Icon name="science" className="text-[1.875rem]" />
      </div>
      <div>
        <h3 className="font-heading text-[1.25rem] font-semibold text-text-primary">{t('Demo finished')}</h3>
        <p className="text-body-md text-text-secondary mt-1 max-w-lg mx-auto">{t('No Instagram account was connected and your list did not change.')}</p>
      </div>
      <dl className="max-w-md mx-auto text-left text-body-sm text-text-secondary space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt>{k}</dt>
            <dd className="font-semibold text-text-primary text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
