import { useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartTooltipStyle } from '@/components/charts/chartTheme';
import { SegmentedControl } from '@/components/ui/Controls';
import { Notice } from '@/components/ui/Misc';
import { msg, useT } from '@/i18n/I18nContext';
import { formatCompact, formatNumber } from '@/lib/format';
import { AudienceCard } from './AudienceCard';
import type { AudiencePageData } from './model';

type Period = '7' | '30' | '90';
const periodOptions: Array<{ value: Period; label: string }> = [
  { value: '7', label: msg('7 days') },
  { value: '30', label: msg('30 days') },
  { value: '90', label: msg('90 days') },
];

/** Follower line with 7/30-day views (subset of the 30-day sample series); 90 days isn't in the sample data. */
export function AudienceGrowthSection({ data, compare }: { data: AudiencePageData; compare: boolean }) {
  const t = useT();
  const [period, setPeriod] = useState<Period>('30');
  const { intel, summary } = data;
  const full = intel.followerGrowth;
  const series = period === '7' ? full.slice(-7) : full;
  const startBefore = period === '7' ? full[full.length - 8].current : summary.followers - summary.netNewFollowers;
  const net = series[series.length - 1].current - startBefore;
  const perDay = net / series.length;
  const peak = series.find((p) => p.date === intel.growthPeak.date);
  const grossPerDay = Math.round(intel.kpis.newFollowersGross / full.length);
  const thisMonth = t('This month');
  const lastMonth = t('Last month');

  return (
    <AudienceCard
      title={t('Follower growth')}
      subtitle={t('About {net} new followers a day ({gross} before unfollows).', { net: perDay.toFixed(0), gross: grossPerDay })}
      actions={
        <>
          <div className="text-right">
            <span className="text-label-sm text-text-tertiary block">{period === '7' ? t('New in 7 days') : t('New followers')}</span>
            <span className="font-heading text-[1.125rem] text-text-primary font-bold tnum">+{formatNumber(period === '7' ? net : intel.kpis.newFollowersGross)}</span>
          </div>
          <SegmentedControl ariaLabel={t('Time range')} options={periodOptions.map((o) => ({ ...o, label: t(o.label) }))} value={period} onChange={setPeriod} size="xs" />
        </>
      }
    >
      {period === '90' && (
        <Notice tone="demo" className="mb-3" title={t('Only 30 days of sample data')}>
          {t('Showing the last 30 days instead.')}
        </Notice>
      )}
      <div className="relative w-full h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-track)" strokeDasharray="4 4" />
            <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: 'var(--chart-track)' }} tick={{ fill: 'var(--app-muted)', fontSize: 10 }} interval={period === '7' ? 0 : 4} dy={6} />
            <YAxis
              domain={[(min: number) => Math.floor((min - 400) / 1000) * 1000, (max: number) => Math.ceil((max + 200) / 1000) * 1000]}
              tickFormatter={(v: number) => formatCompact(v)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--app-muted)', fontSize: 10 }}
              width={44}
            />
            <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number, name: string) => [formatNumber(v), name === 'current' ? thisMonth : lastMonth]} />
            {compare && <Line type="monotone" dataKey="previous" stroke="var(--chart-muted)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />}
            <Area type="monotone" dataKey="current" stroke="var(--eko-gold)" strokeWidth={3} fill="var(--eko-gold)" fillOpacity={0.12} dot={false} activeDot={{ r: 4, stroke: 'var(--app-surface)', strokeWidth: 2 }} />
            {peak && (
              <ReferenceDot
                x={peak.date}
                y={peak.current}
                r={5}
                fill="var(--eko-gold)"
                stroke="var(--app-surface)"
                strokeWidth={2}
                label={{ value: intel.growthPeak.label, position: 'top', fill: 'var(--app-text)', fontSize: 10, fontWeight: 700 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary mt-3">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-primary-container rounded" />
          <span className="text-text-primary font-medium">{thisMonth}</span>
        </span>
        {compare && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0 border-t border-dashed border-slate-600" />
            <span>{lastMonth}</span>
          </span>
        )}
      </div>
    </AudienceCard>
  );
}
