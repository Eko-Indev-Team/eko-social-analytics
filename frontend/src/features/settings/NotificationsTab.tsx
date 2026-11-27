import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Drawer } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/Toast';
import { notificationTriggerMeta } from '@/data/settings';
import { msg, useT } from '@/i18n/I18nContext';
import { brandClass } from '@/lib/brandClass';
import { cn } from '@/lib/format';
import type { NotificationChannel, NotificationSettings, NotificationTriggerId } from '@/types/settings';
import type { SectionProps } from './GeneralTab';
import { FieldError, inputCls, MASKED_SECRET, SectionTitle, SettingsCard, Switch } from './settingsUi';

const channelNames: Record<NotificationChannel, string> = { email: msg('Email'), app: msg('In the app'), slack: msg('Slack') };

/** Short, translatable text for each alert (the data file holds the long English originals). */
const triggerText: Record<NotificationTriggerId, { label: string; description: string; thresholdLabel: string; unit: string }> = {
  tokenExpiry: {
    label: msg('Instagram login expiring'),
    description: msg('When an account login expires within {n} days.'),
    thresholdLabel: msg('Warn this many days before'),
    unit: msg('days'),
  },
  highIntentLead: {
    label: msg('Hot lead'),
    description: msg('When a comment scores {n} or more for joining interest.'),
    thresholdLabel: msg('Minimum lead score'),
    unit: msg('0–100'),
  },
  sentimentAnomaly: {
    label: msg('Sudden negative comments'),
    description: msg('When negative comments jump {n}% above normal.'),
    thresholdLabel: msg('Jump above normal'),
    unit: '%',
  },
};

export function NotificationsTab({ s, update, errors }: SectionProps) {
  const t = useT();
  const toast = useToast();
  const [drawer, setDrawer] = useState(false);
  const n = s.notifications;
  const hasErrors = notificationTriggerMeta.some((m) => errors[`notifications.${m.id}.threshold`] || errors[`notifications.${m.id}.channels`]);

  const setTrigger = (id: NotificationTriggerId, fn: (x: NotificationSettings['triggers'][NotificationTriggerId]) => void) => update((d) => fn(d.notifications.triggers[id]));

  const demoSecret = () => toast({ tone: 'demo', title: t('Not available'), description: t('There is no Slack connection yet. The hidden value is a placeholder.') });

  return (
    <section className="flex flex-col gap-6">
      <SettingsCard>
        <SectionTitle
          title={t('Alerts')}
          subtitle={t('Choose what you want to hear about.')}
          actions={
            <Button size="sm" icon="tune" onClick={() => setDrawer(true)}>
              {t('Edit rules')}
            </Button>
          }
        />
        {hasErrors && (
          <p className="mb-3 text-[0.75rem] text-error font-medium" role="alert">
            {t('Some rules need a fix. Open Edit rules.')}
          </p>
        )}
        <div className="divide-y divide-border-subtle">
          {notificationTriggerMeta.map((m) => {
            const trig = n.triggers[m.id];
            const text = triggerText[m.id];
            return (
              <div key={m.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Icon name={m.icon} className={brandClass(m.iconClass)} />
                  <div>
                    <span className="text-label-md font-semibold text-text-primary block">{t(text.label)}</span>
                    <span className="text-xs text-text-secondary">{t(text.description, { n: trig.threshold })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[0.75rem] text-text-tertiary">
                    {trig.enabled ? trig.channels.map((c) => t(channelNames[c])).join(', ') || t('No channel') : t('Off')}
                  </span>
                  <Switch label={t(text.label)} checked={trig.enabled} onChange={(v) => setTrigger(m.id, (x) => void (x.enabled = v))} />
                </div>
              </div>
            );
          })}
          <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Icon name="wb_sunny" className="text-amber-400" />
              <div>
                <span className="text-label-md font-semibold text-text-primary block">{t('Daily summary email')}</span>
                <span className="text-xs text-text-secondary">
                  {n.digestEnabled ? t('Every day at {time} IST. Email is not set up yet.', { time: n.digestTime }) : t('Off')}
                </span>
              </div>
            </div>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => toast({ tone: 'demo', title: t('Test not sent'), description: t('Email is not set up yet, so nothing was sent.') })}
            >
              {t('Send a test')}
            </Button>
          </div>
        </div>
      </SettingsCard>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title={t('Alert rules')}
        subtitle={t('Press Save changes to keep your edits.')}
        width="w-full sm:w-[480px]"
        footer={
          <Button variant="primary" onClick={() => setDrawer(false)}>
            {t('Done')}
          </Button>
        }
      >
        <div className="space-y-5">
          {notificationTriggerMeta.map((m) => {
            const trig = n.triggers[m.id];
            const text = triggerText[m.id];
            const thresholdError = errors[`notifications.${m.id}.threshold`];
            return (
              <fieldset key={m.id} className="border border-border-strong rounded-xl p-4 space-y-3">
                <legend className="px-1 text-label-md font-bold text-text-primary flex items-center gap-1.5">
                  <Icon name={m.icon} className={cn('text-[1.125rem]', brandClass(m.iconClass))} /> {t(text.label)}
                </legend>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-body-sm text-text-secondary">{t('On')}</span>
                  <Switch label={t(text.label)} checked={trig.enabled} onChange={(v) => setTrigger(m.id, (x) => void (x.enabled = v))} />
                </div>
                <div>
                  <label htmlFor={`thr-${m.id}`} className="block text-label-sm font-semibold text-text-primary mb-1">
                    {t(text.thresholdLabel)} <span className="text-text-tertiary font-normal">({t(text.unit)})</span>
                  </label>
                  <input
                    id={`thr-${m.id}`}
                    type="number"
                    inputMode="numeric"
                    min={m.min}
                    max={m.max}
                    value={Number.isFinite(trig.threshold) ? trig.threshold : ''}
                    aria-invalid={!!thresholdError}
                    onChange={(e) => setTrigger(m.id, (x) => void (x.threshold = e.target.value === '' ? Number.NaN : Number(e.target.value)))}
                    className={cn(inputCls, 'w-32', thresholdError && 'border-error')}
                  />
                  <FieldError message={thresholdError} />
                </div>
                <div>
                  <span className="block text-label-sm font-semibold text-text-primary mb-1">{t('Send to')}</span>
                  <div className="flex flex-wrap gap-3">
                    {(Object.keys(channelNames) as NotificationChannel[]).map((c) => (
                      <label key={c} className="flex items-center gap-1.5 text-body-sm text-text-primary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={trig.channels.includes(c)}
                          onChange={(e) =>
                            setTrigger(m.id, (x) => {
                              x.channels = e.target.checked ? [...x.channels, c] : x.channels.filter((y) => y !== c);
                            })
                          }
                          className="rounded text-primary focus:ring-primary-container h-4 w-4"
                        />
                        {t(channelNames[c])}
                      </label>
                    ))}
                  </div>
                  <FieldError message={errors[`notifications.${m.id}.channels`]} />
                </div>
              </fieldset>
            );
          })}

          <fieldset className="border border-border-strong rounded-xl p-4 space-y-3">
            <legend className="px-1 text-label-md font-bold text-text-primary">{t('Daily summary email')}</legend>
            <div className="flex items-center justify-between gap-3">
              <span className="text-body-sm text-text-secondary">{t('On')}</span>
              <Switch label={t('Daily summary email')} checked={n.digestEnabled} onChange={(v) => update((d) => void (d.notifications.digestEnabled = v))} />
            </div>
            <div>
              <label htmlFor="digest-time" className="block text-label-sm font-semibold text-text-primary mb-1">
                {t('Send time (IST)')}
              </label>
              <select
                id="digest-time"
                disabled={!n.digestEnabled}
                className={cn(inputCls, 'w-40')}
                value={n.digestTime}
                onChange={(e) => update((d) => void (d.notifications.digestTime = e.target.value as NotificationSettings['digestTime']))}
              >
                <option value="08:00">08:00 AM</option>
                <option value="09:00">09:00 AM</option>
                <option value="10:00">10:00 AM</option>
              </select>
            </div>
          </fieldset>

          <fieldset className="border border-border-strong rounded-xl p-4 space-y-2">
            <legend className="px-1 text-label-md font-bold text-text-primary">{t('Slack link')}</legend>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="font-mono text-[0.75rem] bg-surface-canvas border border-border-strong rounded px-2 py-1 text-text-secondary">https://hooks.slack.com/{MASKED_SECRET}</code>
              <Button size="xs" variant="ghost" icon="visibility" onClick={demoSecret}>
                {t('Show')}
              </Button>
              <Button size="xs" variant="ghost" icon="autorenew" onClick={demoSecret}>
                {t('Make new')}
              </Button>
            </div>
            <p className="text-[0.6875rem] text-text-tertiary">{t('Placeholder only. No secret is stored.')}</p>
          </fieldset>
        </div>
      </Drawer>
    </section>
  );
}
