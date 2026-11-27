import { msg } from '@/i18n/I18nContext';
import type { AccountStatus, AccountType, DataAvailability, InstagramAccount } from '@/types/domain';

/** English labels below are translated with t() where they are shown. */
export const accountTypeLabel: Record<AccountType, string> = {
  business: msg('Business account'),
  creator: msg('Creator account'),
};

export type DataLevel = 'full' | 'partial' | 'none';

/** Collapses the four data-availability categories into one filterable level. */
export function dataLevelOf(account: InstagramAccount): DataLevel {
  const levels = Object.values(account.dataAvailability).map((d) => d.level);
  if (levels.every((l) => l === 'available')) return 'full';
  if (levels.every((l) => l === 'unavailable')) return 'none';
  return 'partial';
}

export const dataLevelLabel: Record<DataLevel, string> = {
  full: msg('All data'),
  partial: msg('Some data'),
  none: msg('No data'),
};

export const statusFilterLabel: Record<AccountStatus, string> = {
  connected: msg('Connected'),
  syncing: msg('Syncing'),
  action_required: msg('Needs attention'),
  expired: msg('Expired'),
};

export const availabilityCategories = [
  { key: 'media', label: msg('Posts') },
  { key: 'audience', label: msg('Audience') },
  { key: 'comments', label: msg('Comments') },
  { key: 'stories', label: msg('Stories') },
] as const;

export const availabilityIcon: Record<DataAvailability, { icon: string; cls: string; valueCls: string }> = {
  available: { icon: 'check_circle', cls: 'text-status-active', valueCls: 'text-text-primary' },
  partial: { icon: 'info', cls: 'text-status-paused', valueCls: 'text-amber-300' },
  inactive: { icon: 'remove_circle_outline', cls: 'text-text-tertiary', valueCls: 'text-text-secondary' },
  unavailable: { icon: 'cancel', cls: 'text-error', valueCls: 'text-text-secondary' },
};

export const canSync = (a: InstagramAccount) => a.status === 'connected' || a.status === 'action_required';
