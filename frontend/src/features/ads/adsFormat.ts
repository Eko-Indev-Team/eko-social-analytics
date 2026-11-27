import { msg } from '@/i18n/I18nContext';
import type { Tone } from '@/components/ui/Badge';
import type { AdChannel } from '@/types/ads';

/** ₹ amount without decimals: 18450 → "₹18,450". */
export function formatInr(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

/** ₹ amount with 2 decimals (cost per lead, CPC): 192.19 → "₹192.19". */
export function formatInrPrecise(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-IN');
}

const CHANNELS: Record<AdChannel, string> = {
  lead_form: msg('Lead form'),
  website: msg('Website'),
  other: msg('Other'),
};

/** English label (msg-marked); translate with t() where rendered. */
export const adChannelLabel = (channel: AdChannel) => CHANNELS[channel] ?? CHANNELS.other;

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: msg('Running'),
  PAUSED: msg('Paused'),
  COMPLETED: msg('Finished'),
  ARCHIVED: msg('Archived'),
  DELETED: msg('Deleted'),
  CAMPAIGN_PAUSED: msg('Paused'),
  ADSET_PAUSED: msg('Paused'),
  DISAPPROVED: msg('Rejected'),
  PENDING_REVIEW: msg('In review'),
  IN_PROCESS: msg('In review'),
  WITH_ISSUES: msg('Has issues'),
};

/** Meta ad status → friendly English label (msg-marked). Unknown statuses pass through. */
export const adStatusLabel = (status: string | null | undefined) => (status ? STATUS_LABELS[status.toUpperCase()] ?? status : msg('Unknown'));

export function adStatusTone(status: string | null | undefined): Tone {
  const s = (status ?? '').toUpperCase();
  if (s === 'ACTIVE') return 'active';
  if (s.includes('PAUSED')) return 'paused';
  if (s === 'COMPLETED' || s === 'ARCHIVED') return 'completed';
  if (s === 'DISAPPROVED' || s === 'WITH_ISSUES' || s === 'DELETED') return 'error';
  return 'neutral';
}

/** "2026-11-18T06:30:00Z" → local "18 Nov 2026, 12:00". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
