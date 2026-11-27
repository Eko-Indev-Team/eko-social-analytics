import { useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartTooltipStyle } from '@/components/charts/chartTheme';
import { Skeleton } from '@/components/ui/States';
import { InfoTip } from '@/components/ui/InfoTip';
import { SegmentedControl } from '@/components/ui/Controls';
import { useToast } from '@/components/ui/Toast';
import { msg, useT } from '@/i18n/I18nContext';
import { cn, formatNumber } from '@/lib/format';
import type { CommentSummary, SentimentTrendPoint } from '@/types/comments';
import { pct } from './commentMeta';

type Mode = 'volume' | 'share' | 'score';
type Range = '7d' | '30d';

const modeLabels: Record<Mode, string> = { volume: msg('Count'), share: msg('Share'), score: msg('Mood score') };

/** Sentiment split + 7/30-day trend. */
export function SentimentPanel({ summary, trend, onDeepDive }: { summary: CommentSummary; trend: SentimentTrendPoint[] | undefined; onDeepDive: () => void }) {
  const t = useT();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('volume');
  const [range, setRange] = useState<Range>('30d');
  const { sentiment, totalComments: total } = summary;

  const data = useMemo(() => {
    const rows = (trend ?? []).slice(range === '7d' ? -7 : 0);
    if (mode !== 'share') return rows;
    return rows.map((r) => {
      const t = r.positive + r.neutral + r.negative || 1;
      const round = (v: number) => Math.round((v / t) * 1000) / 10;
      return { ...r, positive: round(r.positive), neutral: round(r.neutral), negative: round(r.negative) };
    });
  }, [trend, mode, range]);

  const fmt = (v: number) => (mode === 'volume' ? formatNumber(v) : mode === 'share' ? `${v}%` : `${v}/100`);
  const peak = useMemo(() => (trend ?? []).reduce<SentimentTrendPoint | undefined>((best, p) => (!best || p.positive > best.positive ? p : best), undefined), [trend]);


  const legend = [
    { key: 'positive', label: t('Positive'), value: sentiment.positive, text: 'text-status-active', dot: 'bg-status-active' },
    { key: 'neutral', label: t('Neutral'), value: sentiment.neutral, text: 'text-text-secondary', dot: 'bg-status-draft' },
    { key: 'negative', label: t('Negative'), value: sentiment.negative, text: 'text-error', dot: 'bg-error' },
  ];
  const seriesName = (name: string) =>
    name === 'score' ? t('Mood score') : name === 'positive' ? t('Positive') : name === 'neutral' ? t('Neutral') : name === 'negative' ? t('Negative') : name;
  const rangeOptions: Array<{ value: Range | '90d'; label: string }> = [
    { value: '7d', label: t('7 days') },
    { value: '30d', label: t('30 days') },
    { value: '90d', label: t('90 days') },
  ];

  return (
    <div className="lg:col-span-5 bg-surface-card border border-border-strong rounded-xl shadow-card p-5 flex flex-col justify-between min-w-0">
      <div>
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('How people feel')}</h2>
              <InfoTip text={t('Sorted by AI from the comment text. Check before you act on it.')} />
            </div>
            <p className="text-body-sm text-text-secondary">{t('Positive, neutral and negative comments')}</p>
          </div>
          <SegmentedControl
            ariaLabel={t('Chart measure')}
            size="xs"
            value={mode}
            onChange={setMode}
            options={(Object.keys(modeLabels) as Mode[]).map((m) => ({ value: m, label: t(modeLabels[m]) }))}
          />
        </div>
        <div
          className="h-2.5 w-full rounded-full flex overflow-hidden mb-4"
          role="img"
          aria-label={t('Positive {positive}, neutral {neutral}, negative {negative}', {
            positive: pct(sentiment.positive, total),
            neutral: pct(sentiment.neutral, total),
            negative: pct(sentiment.negative, total),
          })}
        >
          <div className="bg-status-active" style={{ width: pct(sentiment.positive, total) }} />
          <div className="bg-status-draft" style={{ width: pct(sentiment.neutral, total) }} />
          <div className="bg-error" style={{ width: pct(sentiment.negative, total) }} />
        </div>
        <div className="grid grid-cols-3 gap-3 pb-4">
          {legend.map((l) => (
            <div key={l.key}>
              <div className={cn('flex items-center gap-1.5 text-label-sm font-medium', l.text)}>
                <span className={cn('w-2 h-2 rounded-full', l.dot)} />
                <span>{l.label}</span>
              </div>
              <div className="font-heading text-[1.25rem] text-text-primary tnum font-bold mt-0.5">{formatNumber(l.value)}</div>
              <span className="text-label-sm text-text-tertiary tnum">{pct(l.value, total)}</span>
            </div>
          ))}
        </div>
        <div className="pt-1">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <span className="text-label-sm text-text-secondary font-medium">{range === '7d' ? t('Oct 25–31, 2024') : t('Oct 1–31, 2024')}</span>
            <SegmentedControl
              ariaLabel={t('Time range')}
              size="xs"
              value={range}
              onChange={(r) =>
                r === '90d'
                  ? toast({ tone: 'demo', title: t('Only 30 days of sample data'), description: t('Only October 2024 is in this preview.') })
                  : setRange(r)
              }
              options={rangeOptions}
            />
          </div>
          {trend ? (
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--chart-track)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'var(--app-muted)', fontSize: 10 }} interval={range === '7d' ? 0 : 9} dy={4} />
                  <YAxis hide domain={mode === 'score' ? ['dataMin - 5', 'dataMax + 5'] : [0, 'auto']} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelStyle={{ color: 'var(--app-text)', fontWeight: 600 }}
                    formatter={(value: number, name: string) => [fmt(value), seriesName(name)]}
                  />
                  {mode === 'score' ? (
                    <Area type="monotone" dataKey="score" stroke="var(--chart-good)" strokeWidth={2.5} fill="var(--chart-good)" fillOpacity={0.12} dot={false} />
                  ) : (
                    <>
                      <Area type="monotone" dataKey="positive" stroke="var(--chart-good)" strokeWidth={2.5} fill="var(--chart-good)" fillOpacity={0.12} dot={false} />
                      <Line type="monotone" dataKey="neutral" stroke="var(--chart-muted)" strokeWidth={1.8} strokeDasharray="4 2" dot={false} />
                      <Line type="monotone" dataKey="negative" stroke="var(--chart-critical)" strokeWidth={1.5} dot={false} />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Skeleton className="h-36" />
          )}
        </div>
      </div>
      <div className="pt-3 mt-3 flex items-center justify-between gap-2 text-label-sm text-text-secondary">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-status-active shrink-0" />
          {summary.peakNote}
          {peak && <span className="sr-only">{t('Most positive comments on {date}.', { date: peak.date })}</span>}
        </span>
        <button type="button" onClick={onDeepDive} className="text-primary font-semibold hover:underline whitespace-nowrap">
          {t('Show positive')} →
        </button>
      </div>
    </div>
  );
}
