import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { msg, useT } from '@/i18n/I18nContext';
import { modeText } from '@/lib/config';
import { cn } from '@/lib/format';
import type { InstagramAccount } from '@/types/domain';
import type { RetentionDays, SyncIntervalHours, SyncStream } from '@/types/settings';
import type { SectionProps } from './GeneralTab';
import { FieldError, inputCls, labelCls, SectionTitle, SettingsCard, Switch } from './settingsUi';

const streams: Array<{ id: SyncStream; icon: string; label: string; detail: string }> = [
  { id: 'media', icon: 'movie', label: msg('Posts and reels'), detail: msg('Likes, views, shares and saves') },
  { id: 'audience', icon: 'group', label: msg('Audience'), detail: msg('Where followers live, age and gender') },
  { id: 'comments', icon: 'chat', label: msg('Comments'), detail: msg('Comment text and mood') },
  { id: 'stories', icon: 'history_toggle_off', label: msg('Stories'), detail: msg('Replies, taps and exits') },
];

/** Anchor run of the demo schedule: Oct 31, 10:18 IST (the last completed sync). */
const ANCHOR_HOUR = 10;

const fmt12 = (h: number, m: number) => `${String(h % 12 === 0 ? 12 : h % 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;

export function scheduleTimes(interval: SyncIntervalHours, minute: number) {
  const runs = 24 / interval;
  return Array.from({ length: runs }, (_, i) => (ANCHOR_HOUR + i * interval) % 24)
    .sort((a, b) => a - b)
    .map((h) => `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
}

export function DataSyncTab({ s, update, errors, primary }: SectionProps & { primary?: InstagramAccount }) {
  const t = useT();
  const sync = s.sync;
  const nextHour = ANCHOR_HOUR + sync.intervalHours;
  const nextLabel = nextHour >= 24 ? t('Nov 01, {time}', { time: fmt12(nextHour - 24, sync.offsetMinute) }) : t('Today, {time}', { time: fmt12(nextHour, sync.offsetMinute) });

  const tiles: Array<{ label: string; value: string; note?: string; tone?: string }> = [
    { label: t('Last sync'), value: primary?.lastSyncedAt ?? '—', note: primary ? `@${primary.handle} · ${t('Sample data')}` : undefined, tone: 'text-emerald-300' },
    { label: t('Next sync'), value: sync.enabled ? nextLabel : t('Paused'), note: t('Sample schedule') },
  ];

  return (
    <section className="flex flex-col gap-6">
      <SettingsCard>
        <SectionTitle
          title={
            <>
              {t('Auto sync')}
              <InfoTip
                text={modeText(
                  t('Demo only: these settings are kept in memory. No sync runs.'),
                  t('These choices are saved. Live Instagram accounts use their own sync schedule.'),
                )}
              />
            </>
          }
          subtitle={t('How often SocialBoard gets new numbers from Instagram.')}
          actions={<Switch size="md" label={t('Auto sync')} checked={sync.enabled} onChange={(v) => update((d) => void (d.sync.enabled = v))} />}
        />

        <div className={cn('transition-opacity', !sync.enabled && 'opacity-60')}>
          {!sync.enabled && (
            <p className="mb-4 text-body-sm text-amber-300 flex items-center gap-2">
              <Icon name="pause_circle" className="text-[1.125rem]" /> {t('Auto sync is off. Pages keep showing the last numbers.')}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label htmlFor="sync-interval" className={labelCls}>
                {t('How often')}
              </label>
              <select
                id="sync-interval"
                disabled={!sync.enabled}
                value={sync.intervalHours}
                onChange={(e) => update((d) => void (d.sync.intervalHours = Number(e.target.value) as SyncIntervalHours))}
                className={inputCls}
              >
                <option value={6}>{t('Every {hours} hours', { hours: 6 })}</option>
                <option value={12}>{t('Every {hours} hours', { hours: 12 })}</option>
                <option value={24}>{t('Every {hours} hours', { hours: 24 })}</option>
              </select>
              <span className="text-[0.6875rem] text-text-tertiary block mt-1">{scheduleTimes(sync.intervalHours, sync.offsetMinute).join(', ')} IST</span>
            </div>
            {tiles.map((tile) => (
              <div key={tile.label}>
                <span className="block text-label-sm text-text-secondary mb-1">{tile.label}</span>
                <span className={cn('block text-body-md font-semibold', tile.tone ?? 'text-text-primary')}>{tile.value}</span>
                {tile.note && <span className="text-[0.6875rem] text-text-tertiary block mt-0.5">{tile.note}</span>}
              </div>
            ))}
          </div>

          <h3 className="text-label-md font-semibold text-text-primary mb-3">{t('What to sync')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
            {streams.map((st) => (
              <label key={st.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border-strong cursor-pointer hover:border-text-secondary transition-colors">
                <div className="flex items-center gap-2.5">
                  <Icon name={st.icon} className="text-primary text-[1.25rem]" />
                  <div>
                    <span className="text-label-sm font-semibold text-text-primary block">{t(st.label)}</span>
                    <span className="text-xs text-text-secondary">{t(st.detail)}</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled={!sync.enabled}
                  checked={sync.streams[st.id]}
                  onChange={(e) => update((d) => void (d.sync.streams[st.id] = e.target.checked))}
                  className="rounded text-primary focus:ring-primary-container h-4 w-4 cursor-pointer"
                />
              </label>
            ))}
          </div>
          <FieldError message={errors['sync.streams']} />

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sync-retention" className={labelCls}>
                {t('Keep data for')}
              </label>
              <select id="sync-retention" className={inputCls} value={sync.retentionDays} onChange={(e) => update((d) => void (d.sync.retentionDays = Number(e.target.value) as RetentionDays))}>
                <option value={180}>{t('{days} days', { days: 180 })}</option>
                <option value={365}>{t('{days} days', { days: 365 })}</option>
                <option value={730}>{t('{days} days', { days: 730 })}</option>
              </select>
            </div>
            <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border-strong cursor-pointer">
              <div>
                <span className="text-label-sm font-semibold text-text-primary block">{t('Try again when Instagram is busy')}</span>
                <span className="text-xs text-text-secondary">{t('Up to 3 retries, spaced out.')}</span>
              </div>
              <input
                type="checkbox"
                disabled={!sync.enabled}
                checked={sync.autoRetry}
                onChange={(e) => update((d) => void (d.sync.autoRetry = e.target.checked))}
                className="rounded text-primary focus:ring-primary-container h-4 w-4 cursor-pointer"
              />
            </label>
          </div>
        </div>
      </SettingsCard>
    </section>
  );
}
