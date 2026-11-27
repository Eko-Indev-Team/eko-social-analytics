import type { ReactNode } from 'react';
import { ChartLegend } from '@/components/charts/TrendChart';
import { AiBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { useT } from '@/i18n/I18nContext';
import { cn, formatNumber } from '@/lib/format';
import type { InsightTone, TimelineSegmentTone } from '@/types/content';
import { isVideo } from '../contentMeta';
import { watchHours, type AnalyticsPageData } from './model';
import { RetentionChart } from './RetentionChart';

const segmentCls: Record<TimelineSegmentTone, string> = {
  neutral: 'bg-surface-canvas text-text-secondary',
  drop: 'bg-rose-900/40 text-rose-300',
  cta: 'bg-sky-900/40 text-sky-300',
};

const insightCls: Record<InsightTone, { head: string; icon: string }> = {
  positive: { head: 'text-emerald-300', icon: 'check_circle' },
  warning: { head: 'text-amber-300', icon: 'warning' },
  info: { head: 'text-sky-300', icon: 'verified' },
};

function Shell({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <section className="bg-surface-card rounded-xl border border-border-strong p-5 mb-6 shadow-card" aria-labelledby="content-watch-title">
      <h2 id="content-watch-title" className="font-heading text-[1.0625rem] font-semibold text-text-primary">
        {t('Watch time')}
      </h2>
      <p className="text-body-sm text-text-secondary mb-4">{t('How long people kept watching')}</p>
      {children}
    </section>
  );
}

function Stat({ label, value, note, accent }: { label: string; value: ReactNode; note?: ReactNode; accent?: boolean }) {
  return (
    <div className="p-3 rounded-xl bg-surface-canvas">
      <div className="text-label-sm text-text-secondary">{label}</div>
      <div className={cn('font-heading text-[1.375rem] font-bold tnum mt-0.5', accent ? 'text-primary' : 'text-text-primary')}>{value}</div>
      {note && <div className="text-[0.75rem] text-text-tertiary mt-0.5">{note}</div>}
    </div>
  );
}

/** Watch time numbers, the "still watching" curve, timeline segments and AI tips (videos only). */
export function WatchRetentionSection({ data }: { data: AnalyticsPageData }) {
  const t = useT();
  const { item, analytics } = data;
  const watch = analytics?.watch;

  if (!isVideo(item)) {
    return (
      <Shell>
        <p className="flex items-start gap-2 text-body-sm text-text-secondary">
          <Icon name="info" className="text-[1.125rem] text-text-tertiary mt-px" />
          {t('Watch time is only measured for Reels and video Stories.')}
        </p>
      </Shell>
    );
  }

  if (!watch || !item.durationSec) {
    return (
      <Shell>
        <p className="flex items-start gap-2 text-body-sm text-text-secondary">
          <Icon name="science" className="text-[1.125rem] text-text-tertiary mt-px" />
          {item.metrics.retention !== undefined
            ? t('No second-by-second data for this video in the sample data. {pct}% watched to the end.', { pct: item.metrics.retention })
            : t('No second-by-second data for this video in the sample data.')}
        </p>
      </Shell>
    );
  }

  const duration = item.durationSec;
  const completion = watch.retention[watch.retention.length - 1].retention;
  const hours = watchHours(item.metrics.views, watch.avgWatchSec);

  return (
    <Shell>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label={t('Total watch time')} value={t('{count} hrs', { count: formatNumber(Math.round(hours)) })} />
        <Stat label={t('Average watch')} value={t('{count} sec', { count: watch.avgWatchSec.toFixed(1) })} note={watch.avgWatchNote} />
        <Stat label={t('Watched to the end')} value={`${completion}%`} note={watch.completionNote} accent />
        <Stat label={t('Video length')} value={t('{count} sec', { count: duration.toFixed(1) })} note={watch.lengthNote} />
      </div>

      <div className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span className="text-label-md font-semibold text-text-primary">{t('People still watching')}</span>
          <ChartLegend
            items={[
              { label: t('This video'), color: 'var(--eko-gold)' },
              { label: t('Typical'), color: 'var(--chart-muted)', dashed: true },
            ]}
          />
        </div>
        <RetentionChart watch={watch} durationSec={duration} />
        <div className="flex flex-wrap gap-2 mt-3 text-[0.75rem]">
          {watch.segments.map((s) => (
            <span key={s.start} className={cn('px-2.5 py-1 rounded-full', segmentCls[s.tone])}>
              <span className="font-semibold tnum">
                {s.start}–{s.end}s
              </span>{' '}
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-ai-subtle border border-ai-border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="font-semibold text-text-primary">{t('AI tips to keep people watching')}</span>
          <AiBadge />
          <span className="ml-auto flex items-center gap-1.5 text-label-sm text-text-secondary">
            {t('Confidence: {pct}%', { pct: watch.confidencePct })}
            <InfoTip text={t('Written by AI from sample data. Check before you act on it.')} />
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {watch.insights.map((ins) => {
            const tone = insightCls[ins.tone];
            return (
              <div key={ins.title} className="bg-surface-card p-3 rounded-xl">
                <div className={cn('flex items-center gap-1.5 text-label-sm font-bold mb-1', tone.head)}>
                  <Icon name={tone.icon} className="text-[0.875rem]" />
                  <span>{ins.title}</span>
                </div>
                <p className="text-body-sm text-text-secondary">{ins.body}</p>
                <p className="mt-2 text-[0.75rem] text-text-tertiary">{ins.tag}</p>
              </div>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}
