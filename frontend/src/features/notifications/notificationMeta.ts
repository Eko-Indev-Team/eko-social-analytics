import { msg } from '@/i18n/I18nContext';
import type { NotificationCategory, NotificationGroup, NotificationPriority, NotificationTone } from '@/types/notifications';

/** UI labels / class maps for Notifications. Labels are English source text (msg-marked): translate with t() where rendered. */

export const categoryLabels: Record<NotificationCategory, string> = {
  campaigns: msg('Campaigns'),
  leads: msg('Leads'),
  content: msg('Posts'),
  account: msg('Accounts and sync'),
  ai: msg('AI insights'),
  reports: msg('Reports'),
};

export const categoryOrder: NotificationCategory[] = ['campaigns', 'leads', 'content', 'account', 'ai', 'reports'];

export const groupLabels: Record<NotificationGroup, string> = {
  today: msg('Today'),
  earlier: msg('Earlier today'),
  yesterday: msg('Yesterday'),
  week: msg('Earlier this week'),
};

export const groupOrder: NotificationGroup[] = ['today', 'earlier', 'yesterday', 'week'];

export const priorityLabels: Record<NotificationPriority, string> = {
  urgent: msg('Urgent'),
  high: msg('High priority'),
  standard: msg('Normal'),
};

export const toneClasses: Record<NotificationTone, { box: string; pill: string; dot: string }> = {
  amber: { box: 'bg-status-paused-subtle border-amber-800 text-amber-300', pill: 'bg-status-paused-subtle border-amber-800 text-status-paused', dot: 'bg-gold' },
  emerald: { box: 'bg-status-active-subtle border-emerald-800 text-status-active', pill: 'bg-status-active-subtle border-emerald-800 text-status-active', dot: 'bg-status-active' },
  ai: { box: 'bg-ai-subtle border-ai-border text-ai-accent', pill: 'bg-ai-subtle border-ai-border text-ai-accent', dot: 'bg-ai-accent' },
  sky: { box: 'bg-status-completed-subtle border-sky-800 text-status-completed', pill: 'bg-status-completed-subtle border-sky-800 text-status-completed', dot: 'bg-status-completed' },
  slate: { box: 'bg-status-draft-subtle border-border-strong text-text-secondary', pill: 'bg-status-draft-subtle border-border-strong text-text-secondary', dot: 'bg-text-tertiary' },
};

export const neutralTag = 'bg-surface-canvas border-border-strong text-text-secondary';

export const metaToneText: Record<NotificationTone, string> = {
  amber: 'text-status-paused font-bold',
  emerald: 'text-status-active font-bold',
  ai: 'text-ai-accent font-bold',
  sky: 'text-status-completed font-bold',
  slate: 'text-text-secondary',
};
