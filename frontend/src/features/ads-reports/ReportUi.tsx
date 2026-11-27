import type { ReactNode } from 'react';
import { Badge, DemoBadge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Misc';
import { TableShell, Td, Th, Tr } from '@/components/tables/DataTable';
import { msg, useT } from '@/i18n/I18nContext';
import { isDemoMode } from '@/lib/config';
import { cn } from '@/lib/format';
import type { Confidence, ExperimentVerdict, ReportCell, ReportColumn, StatusCounts } from '@/types/adsReports';
import { CONFIDENCE_LABEL, formatCell, STATUS_LABEL, STATUS_ORDER, STATUS_TONE, VERDICT_ICON, VERDICT_TONE } from './reportFormat';

const VERDICT_LABEL: Record<ExperimentVerdict, string> = {
  worked: msg('Clear result'),
  didnt: msg("Didn't work"),
  mixed: msg('Mixed result'),
  unclear: msg("Can't tell yet"),
  notyet: msg('Not tried yet'),
  problem: msg('Problem found'),
};

/** Section card with a title row and padded body. */
export function ReportSection({
  title,
  subtitle,
  icon,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('p-5 space-y-4', className)}>
      <CardHeader title={title} subtitle={subtitle} actions={actions} icon={icon ? <Icon name={icon} className="text-[1.25rem] text-primary" /> : undefined} />
      {children}
    </Card>
  );
}

/**
 * Honest data-source hints: demo data, "not connected" (data from the last sync/import), signups not connected.
 * Renders nothing when everything is connected.
 */
export function SourceNotice({ configured, hasData, signupsConfigured, needsSignups }: { configured: boolean; hasData: boolean; signupsConfigured?: boolean; needsSignups?: boolean }) {
  const t = useT();
  if (isDemoMode)
    return (
      <Notice tone="demo" title={t('Sample data')}>
        {t('Made-up ads and people to show how this page works. Nothing here comes from Meta or the signup site.')}
      </Notice>
    );
  return (
    <>
      {!configured && hasData && (
        <Notice tone="warning" title={t('Meta Ads is not connected')}>
          {t('These numbers are from the last import or sync and will not refresh. Add META_ADS_ACCESS_TOKEN to backend/.env to connect.')}
        </Notice>
      )}
      {needsSignups && !signupsConfigured && (
        <Notice tone="info" title={t('Website signups are not connected')}>
          {t('Website ads show 0 results until the signup admin is set up (EKO_SIGNUP_ADMIN_BASE_URL, user and password in backend/.env).')}
        </Notice>
      )}
    </>
  );
}

/** Small "Sample data" badge for page headers in demo mode. */
export function DemoTitleBadge() {
  return isDemoMode ? <DemoBadge /> : null;
}

export function VerdictBadge({ verdict, label }: { verdict: ExperimentVerdict; label?: string }) {
  const t = useT();
  return (
    <Badge tone={VERDICT_TONE[verdict] ?? 'neutral'} icon={VERDICT_ICON[verdict] ?? 'help'}>
      {VERDICT_LABEL[verdict] ? t(VERDICT_LABEL[verdict]) : label}
    </Badge>
  );
}

export function ConfidenceBadge({ confidence, why }: { confidence: Confidence; why?: string }) {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-text-secondary" title={why}>
      <Badge tone={confidence === 'High' ? 'active' : confidence === 'Medium' ? 'amber' : 'neutral'}>{t(CONFIDENCE_LABEL[confidence] ?? confidence)}</Badge>
      {why && <span className="text-text-tertiary">({why})</span>}
    </span>
  );
}

/** The five lead statuses as a row of small count tiles. "Strongly qualified" = SBI + ESAF. */
export function StatusCountsStrip({ counts, className, compact }: { counts: StatusCounts; className?: string; compact?: boolean }) {
  const t = useT();
  const total = STATUS_ORDER.reduce((a, k) => a + (counts[k] ?? 0), 0);
  return (
    <div className={cn('grid gap-2', compact ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5', className)}>
      {STATUS_ORDER.map((k) => (
        <div key={k} className="rounded-lg border border-border-strong bg-surface-card-subtle px-3 py-2">
          <Badge tone={STATUS_TONE[k]} dot>
            {t(STATUS_LABEL[k])}
          </Badge>
          <p className="font-heading text-[1.25rem] font-bold text-text-primary tnum mt-1">
            {counts[k] ?? 0}
            {total > 0 && <span className="text-[0.75rem] font-medium text-text-tertiary ml-1.5">{Math.round(((counts[k] ?? 0) * 100) / total)}%</span>}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Compact "SBI 3 · ESAF 4 · Pitch 26 · Check 3 · No 4" text for table cells. */
export function StatusCountsInline({ counts }: { counts: StatusCounts }) {
  const t = useT();
  const short: Record<keyof StatusCounts, string> = {
    sbiStrong: t('SBI'),
    esafStrong: t('ESAF'),
    esafPitch: t('Pitch'),
    needsInfo: t('Check'),
    notQualified: t('No'),
  };
  return (
    <span className="whitespace-nowrap text-[0.75rem] text-text-secondary tnum" title={STATUS_ORDER.map((k) => `${t(STATUS_LABEL[k])}: ${counts[k]}`).join('\n')}>
      {STATUS_ORDER.map((k, i) => (
        <span key={k}>
          {i > 0 && ' · '}
          {short[k]} <b className="text-text-primary">{counts[k]}</b>
        </span>
      ))}
    </span>
  );
}

/** Table defined by API columns (label + kind); every cell is formatted by its column kind. */
export function KindTable({ columns, rows, bestRow, caption }: { columns: ReportColumn[]; rows: ReportCell[][]; bestRow?: number | null; caption?: string }) {
  const t = useT();
  return (
    <TableShell className="rounded-lg border border-border-strong">
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        <tr>
          {columns.map((c, i) => (
            <Th key={`${c.label}-${i}`} align={c.kind === 'text' ? 'left' : 'right'}>
              {t(c.label)}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <Tr key={ri} className={cn(bestRow === ri && 'bg-status-active-subtle')}>
            {columns.map((c, ci) => (
              <Td key={ci} align={c.kind === 'text' ? 'left' : 'right'} className={cn(ci === 0 && 'font-medium')}>
                {ci === 0 && bestRow === ri && <Icon name="star" filled className="text-[0.875rem] text-status-active mr-1 align-[-2px]" label={t('Best')} />}
                {formatCell(row[ci] ?? null, c.kind)}
              </Td>
            ))}
          </Tr>
        ))}
      </tbody>
    </TableShell>
  );
}
