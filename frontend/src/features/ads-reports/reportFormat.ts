import { msg } from '@/i18n/I18nContext';
import { config } from '@/lib/config';
import { formatDate, formatNumber } from '@/lib/format';
import type { ColumnKind, Confidence, ExperimentVerdict, QualStatusKey, ReportCell } from '@/types/adsReports';

const inr0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹ amount: whole rupees from ₹1,000 up, two decimals below (cost per lead etc.). "-" when missing. */
export function money(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `₹${Math.abs(value) >= 1000 ? inr0.format(value) : inr2.format(value)}`;
}

export function count(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return formatNumber(value);
}

export function pct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${Number(value.toFixed(digits))}%`;
}

/** Formats an experiment / trait-table cell by its column kind. */
export function formatCell(cell: ReportCell, kind: ColumnKind): string {
  if (cell === null || cell === '') return '-';
  if (typeof cell === 'string') return cell;
  if (kind === 'money') return money(cell);
  if (kind === 'percent') return pct(cell);
  return count(cell);
}

/** "2026-10-19" → "Oct 19, 2026". */
export const asOfDate = (iso: string | null | undefined) => formatDate(iso ?? null);

/** "STRONG_QUALIFY" → "Strong Qualify". */
export function verdictTitle(verdict: string): string {
  return verdict
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

/** Turns an API path ("/api/v1/ads/123/image") into a URL on the API host; null stays null. */
export function apiAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  if (config.dataSource !== 'api') return null;
  const base = config.apiBaseUrl.replace(/\/$/, '');
  return path.startsWith('/api/v1') ? `${base}${path.slice('/api/v1'.length)}` : `${base}${path}`;
}

export const STATUS_ORDER: QualStatusKey[] = ['sbiStrong', 'esafStrong', 'esafPitch', 'needsInfo', 'notQualified'];

/** English labels for the five lead statuses (translated where rendered). */
export const STATUS_LABEL: Record<QualStatusKey, string> = {
  sbiStrong: msg('Strongly qualified · SBI'),
  esafStrong: msg('Strongly qualified · ESAF'),
  esafPitch: msg('Pitch ESAF'),
  needsInfo: msg('Check details'),
  notQualified: msg('Not qualified'),
};

export const STATUS_TONE: Record<QualStatusKey, 'active' | 'completed' | 'amber' | 'ai' | 'draft'> = {
  sbiStrong: 'active',
  esafStrong: 'completed',
  esafPitch: 'amber',
  needsInfo: 'ai',
  notQualified: 'draft',
};

export const VERDICT_TONE: Record<ExperimentVerdict, 'active' | 'error' | 'amber' | 'neutral' | 'draft'> = {
  worked: 'active',
  didnt: 'error',
  mixed: 'amber',
  unclear: 'neutral',
  notyet: 'draft',
  problem: 'error',
};

export const VERDICT_ICON: Record<ExperimentVerdict, string> = {
  worked: 'check_circle',
  didnt: 'cancel',
  mixed: 'contrast',
  unclear: 'help',
  notyet: 'schedule',
  problem: 'report',
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  High: msg('High confidence'),
  Medium: msg('Medium confidence'),
  Low: msg('Low confidence'),
};

export const PRIORITY_LABEL: Record<Confidence, string> = {
  High: msg('High priority'),
  Medium: msg('Medium priority'),
  Low: msg('Low priority'),
};
