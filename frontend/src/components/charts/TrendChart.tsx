import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartTooltipStyle } from '@/components/charts/chartTheme';
import { useT } from '@/i18n/I18nContext';
import { formatCompact } from '@/lib/format';
import type { TrendPoint } from '@/types/domain';

/**
 * Current vs previous period chart used on Dashboard / Campaign Detail / Content Library:
 * gold line with a flat 12% fill for the current period, dashed muted line for the baseline.
 * Pass `currentLabel` / `previousLabel` already translated; the defaults are translated here.
 */
export function TrendChart({
  data,
  height = 280,
  valueFormatter = (v: number) => formatCompact(v),
  currentLabel,
  previousLabel,
  showPrevious = true,
  color = 'var(--eko-gold)',
  showYAxis = false,
}: {
  data: TrendPoint[];
  height?: number;
  valueFormatter?: (v: number) => string;
  currentLabel?: string;
  previousLabel?: string;
  showPrevious?: boolean;
  color?: string;
  showYAxis?: boolean;
}) {
  const t = useT();
  const current = currentLabel ?? t('Current period');
  const previous = previousLabel ?? t('Previous period');
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: showYAxis ? 0 : 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-track)" strokeDasharray="4 4" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'var(--app-muted)', fontSize: 11 }} interval={4} dy={8} padding={{ left: 14, right: 14 }} />
          <YAxis hide={!showYAxis} tickLine={false} axisLine={false} tick={{ fill: 'var(--app-muted)', fontSize: 11 }} tickFormatter={valueFormatter} width={48} />
          <Tooltip
            cursor={{ stroke: 'var(--app-border-strong)', strokeDasharray: '3 3' }}
            contentStyle={chartTooltipStyle}
            labelStyle={{ color: 'var(--app-text)', fontWeight: 600 }}
            formatter={(value: number, name: string) => [valueFormatter(value), name === 'current' ? current : previous]}
          />
          {showPrevious && <Line type="monotone" dataKey="previous" stroke="var(--chart-muted)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} activeDot={{ r: 3 }} />}
          <Area type="monotone" dataKey="current" stroke={color} strokeWidth={2.5} fill={color} fillOpacity={0.12} dot={false} activeDot={{ r: 4, stroke: 'var(--app-surface)', strokeWidth: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartLegend({ items }: { items: Array<{ label: string; color: string; dashed?: boolean }> }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 text-[0.75rem] text-text-primary font-medium">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-2">
          <span className="w-4 h-0 border-t-2" style={{ borderColor: i.color, borderStyle: i.dashed ? 'dashed' : 'solid' }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
