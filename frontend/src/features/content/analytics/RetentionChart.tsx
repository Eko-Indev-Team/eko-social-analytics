import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartTooltipStyle } from '@/components/charts/chartTheme';
import { useT } from '@/i18n/I18nContext';
import type { WatchAnalytics } from '@/types/content';

/** Share of viewers still watching (gold area) vs the typical curve (dashed), with the drop zone and hook/end markers. */
export function RetentionChart({ watch, durationSec }: { watch: WatchAnalytics; durationSec: number }) {
  const t = useT();
  const points = watch.retention;
  const final = points[points.length - 1];
  const hook = watch.hookSecond !== undefined ? points.find((p) => p.second === watch.hookSecond) : undefined;
  const tickStep = durationSec <= 20 ? 2 : durationSec <= 40 ? 4 : 6;
  const ticks = Array.from({ length: Math.floor(durationSec / tickStep) + 1 }, (_, i) => i * tickStep);
  if (ticks[ticks.length - 1] !== durationSec) ticks.push(durationSec);

  return (
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 22, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-track)" strokeDasharray="3 3" />
          <XAxis
            dataKey="second"
            type="number"
            domain={[0, durationSec]}
            ticks={ticks}
            tickFormatter={(s: number) => `${s}s`}
            tickLine={false}
            axisLine={{ stroke: 'var(--app-border-strong)' }}
            tick={{ fill: 'var(--app-muted)', fontSize: 10 }}
          />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} tick={{ fill: 'var(--app-muted)', fontSize: 10 }} width={44} />
          {watch.dropZone && (
            <ReferenceArea
              x1={watch.dropZone.start}
              x2={watch.dropZone.end}
              fill="var(--chart-critical)"
              fillOpacity={0.08}
              stroke="var(--chart-critical)"
              strokeDasharray="2 2"
              label={{ value: watch.dropZone.label, position: 'insideTop', fill: 'var(--app-danger)', fontSize: 9, fontWeight: 700 }}
            />
          )}
          <Tooltip
            cursor={{ stroke: 'var(--app-border-strong)', strokeDasharray: '3 3' }}
            contentStyle={chartTooltipStyle}
            labelFormatter={(s: number) => t('At {second}s', { second: s })}
            formatter={(value: number, name: string) => [`${value}%`, name === 'retention' ? t('Still watching') : t('Typical')]}
          />
          <Line type="monotone" dataKey="benchmark" stroke="var(--chart-muted)" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={{ r: 3 }} />
          <Area
            type="monotone"
            dataKey="retention"
            stroke="var(--eko-gold)"
            strokeWidth={3}
            fill="var(--eko-gold)"
            fillOpacity={0.12}
            dot={{ r: 3.5, fill: 'var(--app-surface)', stroke: 'var(--eko-gold)', strokeWidth: 2 }}
            activeDot={{ r: 5, stroke: 'var(--app-surface)', strokeWidth: 2 }}
          />
          {hook && (
            <ReferenceDot
              x={hook.second}
              y={hook.retention}
              r={5}
              fill="var(--chart-good)"
              stroke="var(--app-surface)"
              strokeWidth={2}
              label={{ value: t('{pct}% hook', { pct: hook.retention }), position: 'top', fill: 'var(--app-success)', fontSize: 10, fontWeight: 700 }}
            />
          )}
          <ReferenceDot
            x={final.second}
            y={final.retention}
            r={5}
            fill="var(--chart-accent)"
            stroke="var(--app-surface)"
            strokeWidth={2}
            label={{ value: t('{pct}% at the end', { pct: final.retention }), position: 'insideTopRight', fill: 'var(--app-link)', fontSize: 10, fontWeight: 700, dy: -18 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
