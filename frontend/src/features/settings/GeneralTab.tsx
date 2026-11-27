import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback } from '@/components/ui/Misc';
import { useT } from '@/i18n/I18nContext';
import { formatNumber } from '@/lib/format';
import { settingsService } from '@/services/settings';
import type { InstagramAccount } from '@/types/domain';
import type { DateFormatOption, NumberFormatOption, SettingsEnvironment, TimezoneOption, WorkspaceSettings } from '@/types/settings';
import type { SettingsErrors } from './useSettingsDraft';
import { FieldError, inputCls, labelCls, SectionTitle, SettingsCard, Switch } from './settingsUi';

export interface SectionProps {
  s: WorkspaceSettings;
  update: (fn: (d: WorkspaceSettings) => void) => void;
  errors: SettingsErrors;
}

export function GeneralTab({
  s,
  update,
  errors,
  accounts,
  environment,
  presentationDirty,
  onSave,
  saving,
  canSave,
}: SectionProps & {
  accounts: InstagramAccount[];
  environment?: SettingsEnvironment;
  presentationDirty: boolean;
  onSave: () => void;
  saving: boolean;
  canSave: boolean;
}) {
  const t = useT();
  const g = s.general;
  const defaults = settingsService.defaults().general;
  const connected = accounts.filter((a) => a.status !== 'expired').length;
  const sample = 1234567;

  const facts: Array<[string, string]> = [
    [t('Plan'), environment?.plan ?? '—'],
    [t('Auto sync'), s.sync.enabled ? t('Every {hours} hours', { hours: s.sync.intervalHours }) : t('Paused')],
    [t('Instagram accounts'), t('{connected} of {total} connected', { connected: formatNumber(connected), total: formatNumber(accounts.length) })],
    [t('Server'), environment?.apiHost ?? '—'],
  ];

  return (
    <section className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
          {/* Workspace */}
          <SettingsCard>
            <SectionTitle title={t('Workspace')} subtitle={t('The name shown on reports and shared links.')} />
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-surface-canvas rounded-xl border border-border-strong flex items-center justify-center p-2 shrink-0">
                <ImageWithFallback src={g.logoUrl} alt={t('Workspace logo')} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <label htmlFor="ws-display-name" className={labelCls}>
                  {t('Workspace name')}
                </label>
                <input
                  id="ws-display-name"
                  type="text"
                  value={g.displayName}
                  aria-invalid={!!errors['general.displayName']}
                  onChange={(e) => update((d) => void (d.general.displayName = e.target.value))}
                  className={`${inputCls} ${errors['general.displayName'] ? 'border-error focus:ring-error' : ''}`}
                />
                <FieldError message={errors['general.displayName']} />
                <p className="text-[0.6875rem] text-text-tertiary mt-1">{t('Workspace ID: {id}', { id: g.workspaceCode })}</p>
              </div>
            </div>
          </SettingsCard>

          {/* Region & formats */}
          <SettingsCard>
            <SectionTitle title={t('Region and formats')} subtitle={t('How dates, numbers and times are shown.')} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ws-tz" className={labelCls}>
                  {t('Time zone')}
                </label>
                <select id="ws-tz" className={inputCls} value={g.timezone} onChange={(e) => update((d) => void (d.general.timezone = e.target.value as TimezoneOption))}>
                  <option value="Asia/Kolkata">{t('India (UTC+05:30)')}</option>
                  <option value="UTC">{t('UTC (UTC+00:00)')}</option>
                  <option value="Asia/Kathmandu">{t('Kathmandu (UTC+05:45)')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="ws-date" className={labelCls}>
                  {t('Date format')}
                </label>
                <select id="ws-date" className={inputCls} value={g.dateFormat} onChange={(e) => update((d) => void (d.general.dateFormat = e.target.value as DateFormatOption))}>
                  <option value="MMM DD, YYYY">Oct 31, 2024</option>
                  <option value="DD/MM/YYYY">31/10/2024</option>
                  <option value="YYYY-MM-DD">2024-10-31</option>
                </select>
              </div>
              <div>
                <label htmlFor="ws-number" className={labelCls}>
                  {t('Number format')}
                </label>
                <select id="ws-number" className={inputCls} value={g.numberFormat} onChange={(e) => update((d) => void (d.general.numberFormat = e.target.value as NumberFormatOption))}>
                  <option value="en-IN">{t('Indian ({example})', { example: sample.toLocaleString('en-IN') })}</option>
                  <option value="en-US">{t('International ({example})', { example: sample.toLocaleString('en-US') })}</option>
                </select>
              </div>
              <div>
                <label htmlFor="ws-currency" className={labelCls}>
                  {t('Currency')}
                </label>
                <input
                  id="ws-currency"
                  readOnly
                  value="INR (₹)"
                  title={t('The currency cannot be changed.')}
                  className="w-full h-9 px-3 text-sm rounded bg-surface-canvas border border-border-strong text-text-secondary font-medium cursor-not-allowed"
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="ws-account" className={labelCls}>
                  {t('Default Instagram account')}
                </label>
                <select id="ws-account" className={inputCls} value={g.defaultAccountId} onChange={(e) => update((d) => void (d.general.defaultAccountId = e.target.value))}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      @{a.handle}
                      {a.isPrimary ? ` · ${t('Main account')}` : ''}
                      {a.status === 'expired' ? ` · ${t('Needs reconnect')}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </SettingsCard>

          {/* Display */}
          <SettingsCard>
            <SectionTitle title={t('Display')} subtitle={t('How numbers look on your pages.')} />
            <div className="divide-y divide-border-subtle">
              <div className="flex items-center justify-between gap-4 py-3">
                <div>
                  <div className="text-label-md font-semibold text-text-primary">{t('Compact tables')}</div>
                  <div className="text-body-sm text-text-secondary">{t('Less space between rows, more data on screen.')}</div>
                </div>
                <Switch label={t('Compact tables')} checked={g.denseGrid} onChange={(v) => update((d) => void (d.general.denseGrid = v))} />
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <div>
                  <div className="text-label-md font-semibold text-text-primary">{t('Show change badges')}</div>
                  <div className="text-body-sm text-text-secondary">{t('Show the change from last month on number tiles.')}</div>
                </div>
                <Switch label={t('Show change badges')} checked={g.deltaBadges} onChange={(v) => update((d) => void (d.general.deltaBadges = v))} />
              </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[0.75rem] text-text-tertiary">
                <Icon name={presentationDirty ? 'edit_note' : 'check_circle'} className={presentationDirty ? 'text-[1rem] text-amber-400' : 'text-[1rem] text-emerald-400'} />
                {presentationDirty ? t('Unsaved changes') : t('All changes saved')}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="h-8 px-3 rounded-lg bg-surface-card border border-border-strong text-text-secondary text-label-md font-medium hover:bg-surface-canvas disabled:opacity-50"
                  disabled={g.denseGrid === defaults.denseGrid && g.deltaBadges === defaults.deltaBadges}
                  onClick={() =>
                    update((d) => {
                      d.general.denseGrid = defaults.denseGrid;
                      d.general.deltaBadges = defaults.deltaBadges;
                    })
                  }
                >
                  {t('Reset')}
                </button>
                <button
                  type="button"
                  className="h-8 px-4 rounded-lg bg-primary-container text-on-primary-container text-label-md font-semibold hover:bg-brand-primary-hover shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!canSave || saving}
                  onClick={onSave}
                >
                  {saving ? t('Saving…') : t('Save changes')}
                </button>
              </div>
            </div>
          </SettingsCard>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          <SettingsCard>
            <SectionTitle title={t('About this workspace')} />
            <dl className="space-y-2.5 text-body-sm">
              {facts.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-text-secondary shrink-0">{k}</dt>
                  <dd className="font-medium text-text-primary text-right break-all">{v}</dd>
                </div>
              ))}
            </dl>
          </SettingsCard>
          <p className="flex items-start gap-2 text-body-sm text-text-secondary px-1">
            <Icon name="verified_user" className="text-[1.125rem] text-tertiary shrink-0" />
            {t('SocialBoard holds Instagram marketing data only. No customer bank or payment details.')}
          </p>
        </div>
      </div>
    </section>
  );
}
