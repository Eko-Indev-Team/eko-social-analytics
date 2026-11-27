import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Drawer } from '@/components/ui/Overlay';
import { Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { modeText } from '@/lib/config';
import { cn } from '@/lib/format';
import { notificationService } from '@/services/notifications';
import type { NotificationCategory, NotificationPreferences } from '@/types/notifications';

const categoryRows: Array<{ key: NotificationCategory; label: string }> = [
  { key: 'account', label: msg('Accounts and sync') },
  { key: 'leads', label: msg('New leads and buying comments') },
  { key: 'content', label: msg('Unusual post results') },
  { key: 'ai', label: msg('New AI insights') },
  { key: 'reports', label: msg('Scheduled reports') },
  { key: 'campaigns', label: msg('Campaign changes') },
];

const SectionLabel = ({ children }: { children: ReactNode }) => <span className="text-label-md font-semibold text-text-primary">{children}</span>;

function ThresholdRow({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-canvas">
      <div className="flex flex-col min-w-0">
        <span className="text-label-md font-medium text-text-primary">{title}</span>
        <span className="text-body-sm text-text-secondary">{hint}</span>
      </div>
      {children}
    </div>
  );
}

const pillSelect = 'text-label-sm font-semibold px-2 py-1 rounded-full border cursor-pointer focus:outline-none focus:ring-0';

/** Notification settings drawer, saved through notificationService. */
export function PreferencesDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const query = useQuery('notifications:preferences', notificationService.getPreferences, { enabled: open });
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  useEffect(() => {
    if (open && query.data) setDraft(query.data);
  }, [open, query.data]);
  const save = useMutation(notificationService.savePreferences, {
    invalidate: ['notifications'],
    onSuccess: () => {
      toast({
        title: t('Settings saved'),
        description: t(modeText(msg('Saved for this session only. Email, SMS and WhatsApp alerts are not set up yet.'), msg('Email, SMS and WhatsApp alerts are not set up yet.'))),
      });
      onClose();
    },
  });

  const set = (fn: (p: NotificationPreferences) => NotificationPreferences) => setDraft((d) => (d ? fn(d) : d));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-full bg-surface-canvas flex items-center justify-center text-text-primary">
            <Icon name="tune" className="text-[1.25rem]" />
          </span>
          {t('Notification settings')}
        </span>
      }
      subtitle={t('Choose what you hear about and how.')}
      footer={
        <>
          <Button onClick={onClose}>{t('Cancel')}</Button>
          <Button variant="primary" size="md" disabled={!draft} loading={save.isPending} onClick={() => draft && save.mutate(draft)}>
            {t('Save')}
          </Button>
        </>
      }
    >
      {!draft ? (
        <div className="space-y-3" role="status" aria-label={t('Loading settings')}>
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <SectionLabel>{t('Where to get alerts')}</SectionLabel>
            <label className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-canvas cursor-pointer">
              <span className="flex flex-col">
                <span className="text-label-md font-semibold text-text-primary">{t('In the app')}</span>
                <span className="text-body-sm text-text-secondary">{t('Badges and pop-up messages in SocialBoard')}</span>
              </span>
              <input
                type="checkbox"
                className="w-4 h-4 rounded text-text-primary focus:ring-0 border-slate-700 cursor-pointer"
                checked={draft.channels.inApp}
                onChange={(e) => set((p) => ({ ...p, channels: { ...p.channels, inApp: e.target.checked } }))}
              />
            </label>
            <div className="p-3 rounded-lg bg-surface-canvas flex flex-col gap-2">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="flex flex-col">
                  <span className="text-label-md font-semibold text-text-primary">{t('Daily email summary')}</span>
                  <span className="text-body-sm text-text-secondary">{t('Every day at 9:00 AM IST')}</span>
                </span>
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-text-primary focus:ring-0 border-slate-700 cursor-pointer"
                  checked={draft.channels.emailDigest}
                  onChange={(e) => set((p) => ({ ...p, channels: { ...p.channels, emailDigest: e.target.checked } }))}
                />
              </label>
              <p className="flex items-start gap-1.5 text-[0.75rem] text-text-tertiary">
                <Icon name="info" className="text-[0.875rem] mt-px" />
                {t('Email, SMS and WhatsApp sending is not set up yet. Your choice is saved.')}
              </p>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionLabel>{t('When to alert')}</SectionLabel>
            <ThresholdRow title={t('Login expiry')} hint={t('Warn before an Instagram login expires')}>
              <select
                aria-label={t('Login expiry')}
                className={cn(pillSelect, 'text-text-primary bg-surface-canvas border-border-strong')}
                value={draft.thresholds.tokenExpiryDays}
                onChange={(e) => set((p) => ({ ...p, thresholds: { ...p.thresholds, tokenExpiryDays: Number(e.target.value) } }))}
              >
                {[3, 5, 7, 14].map((d) => (
                  <option key={d} value={d}>
                    {t('Less than {count} days', { count: d })}
                  </option>
                ))}
              </select>
            </ThresholdRow>
            <ThresholdRow title={t('Lead comments')} hint={t('Which AI lead scores should alert you')}>
              <select
                aria-label={t('Lead comments')}
                className={cn(pillSelect, 'text-status-active bg-status-active-subtle border-emerald-800')}
                value={draft.thresholds.leadScore}
                onChange={(e) => set((p) => ({ ...p, thresholds: { ...p.thresholds, leadScore: e.target.value as NotificationPreferences['thresholds']['leadScore'] } }))}
              >
                <option value="high">{t('High score only')}</option>
                <option value="medium">{t('Medium or high')}</option>
                <option value="any">{t('Any score')}</option>
              </select>
            </ThresholdRow>
            <ThresholdRow title={t('Negative comments')} hint={t('Alert when negative comments jump')}>
              <select
                aria-label={t('Negative comments')}
                className={cn(pillSelect, 'text-status-paused bg-status-paused-subtle border-amber-800')}
                value={draft.thresholds.sentimentSpikePct}
                onChange={(e) => set((p) => ({ ...p, thresholds: { ...p.thresholds, sentimentSpikePct: Number(e.target.value) } }))}
              >
                {[10, 15, 25].map((v) => (
                  <option key={v} value={v}>
                    {t('Up more than {pct}%', { pct: v })}
                  </option>
                ))}
              </select>
            </ThresholdRow>
          </section>

          <section className="flex flex-col gap-2.5">
            <SectionLabel>{t('What to alert on')}</SectionLabel>
            {categoryRows.map((c) => (
              <label key={c.key} className="flex items-center justify-between text-body-md py-1 cursor-pointer">
                <span className="text-text-primary">{t(c.label)}</span>
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-text-primary focus:ring-0 border-slate-700"
                  checked={draft.categories[c.key]}
                  onChange={(e) => set((p) => ({ ...p, categories: { ...p.categories, [c.key]: e.target.checked } }))}
                />
              </label>
            ))}
            <p className="text-body-sm text-text-tertiary">{t('Applies to new alerts. Older ones stay in your list.')}</p>
          </section>
        </div>
      )}
    </Drawer>
  );
}
