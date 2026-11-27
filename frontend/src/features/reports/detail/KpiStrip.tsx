import { useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { KpiCard, type KpiTone } from '@/components/ui/KpiCard';
import { msg, useT } from '@/i18n/I18nContext';
import { formatCompact, formatNumber } from '@/lib/format';
import type { ReportDetail, ReportMetricKey } from '@/types/reports';

interface Tile {
  key: string;
  metric: ReportMetricKey;
  /** English source text, translated inside KpiCard. */
  label: string;
  icon: string;
  tone: KpiTone;
  value: ReactNode;
  delta?: number;
  footnote?: string;
  hint?: string;
  highlight?: boolean;
}

/** Key numbers: the first four tiles the report includes, the rest behind "More numbers". */
export function KpiStrip({ detail, cplBenchmark }: { detail: ReportDetail; cplBenchmark: number }) {
  const t = useT();
  const [more, setMore] = useState(false);
  const { report, computed } = detail;
  const tot = computed.totals;
  const d = computed.deltas;
  const accountWide = report.scope === 'account' && !report.contentIds?.length;
  const tiles: Tile[] = [
    { key: 'views', metric: 'views', label: msg('Views'), icon: 'visibility', tone: 'teal', value: formatCompact(tot.views), delta: d.views },
    { key: 'reach', metric: 'reach', label: msg('People reached'), icon: 'groups', tone: 'ai', value: formatCompact(tot.reach), delta: d.reach },
    {
      key: 'er',
      metric: 'engagement',
      label: msg('Engagement'),
      icon: 'favorite',
      tone: 'success',
      value: `${tot.engagementRate.toFixed(2)}%`,
      footnote: d.engagement !== undefined ? t('{value} points vs last month', { value: `${d.engagement >= 0 ? '+' : '−'}${Math.abs(d.engagement).toFixed(1)}` }) : undefined,
    },
    { key: 'leads', metric: 'leads', label: msg('Leads'), icon: 'person_add', tone: 'gold', value: formatNumber(tot.leads), delta: d.leads, highlight: true },
    {
      key: 'watch',
      metric: 'watchTime',
      label: msg('Watch time'),
      icon: 'schedule',
      tone: 'teal',
      value: t('{hours} hrs', { hours: formatNumber(Math.round(tot.watchTimeHours)) }),
      footnote: accountWide ? t('Whole account') : t('Reels: {count}', { count: tot.reelCount }),
    },
    {
      key: 'avgwatch',
      metric: 'watchTime',
      label: msg('Average watch'),
      icon: 'timelapse',
      tone: 'ai',
      value: tot.avgWatchSec !== null ? `${tot.avgWatchSec.toFixed(1)}s` : '—',
      hint: msg('Average seconds watched per video view.'),
    },
    { key: 'comments', metric: 'comments', label: msg('Comments'), icon: 'forum', tone: 'success', value: formatNumber(tot.comments) },
    {
      key: 'cpl',
      metric: 'leads',
      label: msg('Cost per lead'),
      icon: 'savings',
      tone: 'warning',
      value: tot.cpl !== null ? `₹${Math.round(tot.cpl)}` : '—',
      footnote:
        tot.cpl !== null
          ? t('{pct}% vs usual ₹{bench}', { pct: Math.round(((tot.cpl - cplBenchmark) / cplBenchmark) * 100), bench: cplBenchmark })
          : t('Not tracked per post'),
    },
  ];
  const visible = tiles.filter((x) => report.metrics.includes(x.metric));
  if (visible.length === 0) return null;
  const first = visible.slice(0, 4);
  const rest = visible.slice(4);

  const card = (tile: Tile) => (
    <KpiCard
      key={tile.key}
      label={tile.label}
      icon={tile.icon}
      tone={tile.tone}
      value={tile.value}
      delta={tile.delta}
      deltaLabel={msg('vs last month')}
      footnote={tile.footnote}
      hint={tile.hint}
      highlight={tile.highlight}
    />
  );

  return (
    <section className="space-y-3" data-print-section="kpis">
      <div className="flex items-center gap-2">
        <h2 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('Key numbers')}</h2>
        {d.note && <span className="text-body-sm text-text-tertiary">· {t(d.note)}</span>}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{first.map(card)}</div>
      {more && rest.length > 0 && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{rest.map(card)}</div>}
      {rest.length > 0 && (
        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          aria-expanded={more}
          className="text-label-md font-semibold text-text-secondary hover:text-text-primary flex items-center gap-1 print:hidden"
        >
          <Icon name={more ? 'expand_less' : 'expand_more'} className="text-[1.125rem]" />
          {more ? t('Fewer numbers') : t('More numbers')}
        </button>
      )}
    </section>
  );
}
