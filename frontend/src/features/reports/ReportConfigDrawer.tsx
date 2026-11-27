import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Drawer } from '@/components/ui/Overlay';
import { Skeleton } from '@/components/ui/States';
import { useMutation } from '@/hooks/useMutation';
import { msg, useT } from '@/i18n/I18nContext';
import { modeText } from '@/lib/config';
import { useQuery } from '@/hooks/useQuery';
import { cn, formatCompact, formatNumber } from '@/lib/format';
import { accountService } from '@/services/accounts';
import { reportService } from '@/services/reports';
import type { Report, ReportConfig, ReportContext, ReportSchedule } from '@/types/reports';
import { CampaignPicker, CheckRow, FieldError, FieldLabel, MetricChips } from './ReportConfigFields';
import { computeReport, formatPeriod } from './reportMetrics';
import { accountScopedTypes, datePresets, DEMO_WINDOW, defaultSections, formatOptions, reportTypeOptions, scheduleOptions, sectionOptions } from './reportOptions';

type Errors = Partial<Record<'title' | 'campaigns' | 'period' | 'metrics' | 'formats' | 'recipients', string>>;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseRecipients = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);

function validate(c: ReportConfig, recipientsText: string, ctx: ReportContext | undefined): Errors {
  const e: Errors = {};
  const title = c.title.trim();
  if (title.length < 3) e.title = msg('Enter a name (at least 3 characters).');
  else if (title.length > 120) e.title = msg('Keep the name under 120 characters.');
  if (c.scope === 'campaigns' && ctx && !ctx.campaigns.some((x) => x.metrics && c.campaignIds.includes(x.id))) e.campaigns = msg('Pick at least one campaign that has data.');
  const { start, end } = c.period;
  if (!start || !end) e.period = msg('Choose a start and end date.');
  else if (start < DEMO_WINDOW.start || end > DEMO_WINDOW.end) e.period = msg('Sample data covers Oct 1 – Oct 31, 2024 only.');
  else if (start > end) e.period = msg('The start date must be on or before the end date.');
  if (c.metrics.length === 0) e.metrics = msg('Pick at least one number to include.');
  if (c.formats.length === 0) e.formats = msg('Pick at least one file type.');
  if (c.schedule !== 'none') {
    const list = parseRecipients(recipientsText);
    if (list.length === 0) e.recipients = msg('Add at least one email for the schedule.');
    else if (list.some((x) => !EMAIL.test(x))) e.recipients = msg('One or more emails look wrong.');
  }
  return e;
}

const presetFor = (p: ReportConfig['period']) => datePresets.find((d) => d.period && d.period.start === p.start && d.period.end === p.end)?.value ?? 'custom';

/**
 * "Create report" slide-over (also used for "Edit Configuration").
 * Generating recomputes figures from canonical demo data; schedules/recipients are saved only.
 */
export function ReportConfigDrawer({
  open,
  onClose,
  initial,
  reportId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial: ReportConfig;
  /** When set, the drawer edits this report instead of creating a new one. */
  reportId?: string;
  onSaved: (report: Report, config: ReportConfig) => void;
}) {
  const t = useT();
  const [config, setConfig] = useState<ReportConfig>(initial);
  const [preset, setPreset] = useState(presetFor(initial.period));
  const [recipientsText, setRecipientsText] = useState(initial.recipients.join(', '));
  const [submitted, setSubmitted] = useState(false);
  const ctxQuery = useQuery('reports:context', reportService.context, { enabled: open });
  const account = useQuery(`reports:account:${initial.accountId}`, () => accountService.get(initial.accountId), { enabled: open });
  const ctx = ctxQuery.data;

  useEffect(() => {
    if (!open) return;
    setConfig(initial);
    setPreset(presetFor(initial.period));
    setRecipientsText(initial.recipients.join(', '));
    setSubmitted(false);
  }, [open, initial]);

  const errors = validate(config, recipientsText, ctx);
  const hasErrors = Object.keys(errors).length > 0;
  const shown: Errors = submitted ? errors : {};
  const preview = useMemo(() => (ctx && !errors.period ? computeReport(config, ctx) : null), [ctx, config, errors.period]);
  const save = useMutation((c: ReportConfig) => (reportId ? reportService.update(reportId, c) : reportService.create(c)), { invalidate: ['reports'] });

  const set = <K extends keyof ReportConfig>(key: K, value: ReportConfig[K]) => setConfig((c) => ({ ...c, [key]: value }));

  const submit = async () => {
    setSubmitted(true);
    if (hasErrors) return;
    const final: ReportConfig = { ...config, title: config.title.trim(), recipients: config.schedule === 'none' ? [] : parseRecipients(recipientsText) };
    const result = await save.mutate(final);
    if (result) onSaved(result, final);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="w-full sm:w-[576px]"
      title={reportId ? t('Edit report') : t('Create report')}
      subtitle={t('Pick what to include and how to get it.')}
      footer={
        <>
          <Button onClick={onClose}>{t('Cancel')}</Button>
          <Button variant="primary" size="md" icon="bolt" onClick={submit} loading={save.isPending} disabled={!ctx}>
            {reportId ? t('Save and update') : t('Create report')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <FieldLabel htmlFor="report-title">{t('Report name')}</FieldLabel>
          <input
            id="report-title"
            type="text"
            value={config.title}
            onChange={(e) => set('title', e.target.value)}
            aria-invalid={!!shown.title || undefined}
            className={cn(
              'w-full px-3 py-2 text-body-md font-body-md bg-slate-950 border rounded text-text-primary focus:border-border-focused focus:ring-0 focus:outline-none',
              shown.title ? 'border-error' : 'border-border-strong',
            )}
          />
          {shown.title ? (
            <FieldError message={shown.title} />
          ) : (
            <span className="text-body-sm text-text-tertiary mt-1 block">{t('A report number is added for you.')}</span>
          )}
        </div>

        <div>
          <span className="block text-label-md text-text-primary font-semibold mb-2">{t('Type')}</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label={t('Report type')}>
            {reportTypeOptions.map((o) => {
              const on = config.type === o.value;
              return (
                <label
                  key={o.value}
                  className={cn('flex items-center gap-2 p-2.5 rounded border cursor-pointer', on ? 'border-border-focused bg-surface-container-low' : 'border-border-strong hover:bg-surface-canvas')}
                >
                  <input
                    type="radio"
                    name="report-type"
                    className="text-primary-container focus:ring-0"
                    checked={on}
                    onChange={() =>
                      setConfig((c) => {
                        const accountScope = accountScopedTypes.includes(o.value);
                        const withData = ctx?.campaigns.filter((x) => x.metrics).map((x) => x.id);
                        return {
                          ...c,
                          type: o.value,
                          scope: accountScope ? 'account' : 'campaigns',
                          campaignIds: accountScope && withData ? withData : c.campaignIds,
                          sections: defaultSections[o.value],
                          contentIds: undefined,
                        };
                      })
                    }
                  />
                  <span className={cn('font-label-md text-label-md', on ? 'font-bold text-text-primary' : 'font-medium text-text-secondary')}>{t(o.label)}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="report-preset">{t('Dates')}</FieldLabel>
            <select
              id="report-preset"
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value);
                const p = datePresets.find((d) => d.value === e.target.value)?.period;
                if (p) set('period', { ...p });
              }}
              className="w-full px-3 py-2 text-body-md font-body-md bg-slate-950 border border-slate-700 rounded text-text-primary focus:border-border-focused focus:ring-0"
            >
              {datePresets.map((d) => (
                <option key={d.value} value={d.value}>
                  {t(d.label)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="block text-label-md text-text-primary font-semibold mb-1.5">{t('Instagram account')}</span>
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-canvas border border-border-strong rounded text-body-md text-text-primary">
              <img alt="" className="w-4 h-4 object-contain" src="/eko-logo.png" />
              <span className="font-semibold truncate">{account.data ? `@${account.data.handle}` : '…'}</span>
            </div>
          </div>
        </div>
        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-4 -mt-2">
            {(['start', 'end'] as const).map((k) => (
              <div key={k}>
                <FieldLabel htmlFor={`report-${k}`}>{k === 'start' ? t('Start date') : t('End date')}</FieldLabel>
                <input
                  id={`report-${k}`}
                  type="date"
                  min={DEMO_WINDOW.start}
                  max={DEMO_WINDOW.end}
                  value={config.period[k]}
                  onChange={(e) => set('period', { ...config.period, [k]: e.target.value })}
                  className="w-full px-3 py-2 text-body-md bg-slate-950 border border-slate-700 rounded text-text-primary focus:border-border-focused focus:ring-0"
                />
              </div>
            ))}
          </div>
        )}
        <FieldError message={shown.period ?? (preset === 'custom' ? errors.period : undefined)} />

        {ctx ? (
          <CampaignPicker campaigns={ctx.campaigns} selected={config.campaignIds} onChange={(ids) => set('campaignIds', ids)} error={shown.campaigns} disabled={config.scope === 'account'} />
        ) : (
          <Skeleton className="h-28" />
        )}

        <MetricChips value={config.metrics} onChange={(m) => set('metrics', m)} error={shown.metrics} />

        <div>
          <span className="block text-label-md text-text-primary font-semibold mb-2">{t('What to include')}</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-body-md text-text-secondary">
            {sectionOptions.map((s) => (
              <CheckRow key={s.value} checked={config.sections.includes(s.value)} onChange={(on) => set('sections', on ? [...config.sections, s.value] : config.sections.filter((x) => x !== s.value))}>
                {t(s.label)}
              </CheckRow>
            ))}
          </div>
        </div>

        <div className="p-3 rounded bg-surface-canvas border border-border-strong">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" className="rounded border-slate-700 text-text-primary focus:ring-0" checked={config.compareBaseline} onChange={(e) => set('compareBaseline', e.target.checked)} />
            <div>
              <span className="text-label-md font-semibold text-text-primary">{t('Compare with last month')}</span>
              <p className="text-body-sm text-text-secondary mt-0.5">{t('Compares with Sep 1 – Sep 30, 2024.')}</p>
            </div>
          </label>
        </div>

        <div>
          <span className="block text-label-md text-text-primary font-semibold mb-1.5">{t('Files')}</span>
          <div className="flex items-center flex-wrap gap-3 text-body-md text-text-secondary">
            {formatOptions.map((f) => (
              <CheckRow key={f.value} checked={config.formats.includes(f.value)} onChange={(on) => set('formats', on ? [...config.formats, f.value] : config.formats.filter((x) => x !== f.value))}>
                {t(f.label)}
              </CheckRow>
            ))}
          </div>
          <FieldError message={shown.formats} />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="report-schedule" className="mb-0">
            {t('Schedule and emails')}
          </FieldLabel>
          <select
            id="report-schedule"
            value={config.schedule}
            onChange={(e) => set('schedule', e.target.value as ReportSchedule)}
            className="w-full px-3 py-2 text-body-md bg-slate-950 border border-slate-700 rounded text-text-primary focus:border-border-focused focus:ring-0"
          >
            {scheduleOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {t(s.label)}
              </option>
            ))}
          </select>
          {config.schedule !== 'none' && (
            <>
              <input
                type="text"
                aria-label={t('Emails')}
                value={recipientsText}
                onChange={(e) => setRecipientsText(e.target.value)}
                placeholder="name@eko.example, another@eko.example"
                className={cn('w-full px-3 py-2 text-body-md bg-slate-950 border rounded text-text-primary focus:border-border-focused focus:ring-0', shown.recipients ? 'border-error' : 'border-border-strong')}
              />
              <FieldError message={shown.recipients} />
              <p className="text-body-sm text-text-tertiary">{t(modeText(msg('Sample mode: the schedule is saved, but no email is sent.'), msg('The schedule is saved. Email sending is not set up yet.')))}</p>
            </>
          )}
        </div>

        {preview && (
          <div className="rounded-lg border border-border-strong bg-surface-card-subtle p-3 text-body-sm text-text-secondary" aria-live="polite">
            <div className="flex items-center gap-1.5 text-body-sm font-semibold text-text-tertiary mb-1">
              <Icon name="visibility" className="text-[0.875rem]" /> {t(modeText(msg('Preview (sample data)'), msg('Preview')))}
            </div>
            <p className="text-text-primary">
              {t('{scope} · {views} views · {leads} leads · {rate}% engagement · {period}', {
                scope: config.scope === 'account' ? t('Whole account') : t('Campaigns: {count}', { count: preview.campaigns.length }),
                views: formatCompact(preview.totals.views),
                leads: formatNumber(preview.totals.leads),
                rate: preview.totals.engagementRate.toFixed(2),
                period: formatPeriod(config.period),
              })}
            </p>
          </div>
        )}
      </div>
    </Drawer>
  );
}
