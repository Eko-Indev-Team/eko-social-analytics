import { Fragment } from 'react';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { ActionStatus, InsightCategory, InsightPriority, InsightStatus } from '@/types/insights';

/** Labels below are English source text (msg-marked); translate with t() where rendered. */
export const categoryMeta: Record<InsightCategory, { label: string; tab: string }> = {
  campaign: { label: msg('Campaigns'), tab: msg('Campaigns') },
  content: { label: msg('Posts'), tab: msg('Posts') },
  audience: { label: msg('Audience'), tab: msg('Audience') },
  comments: { label: msg('Comments'), tab: msg('Comments') },
  leads: { label: msg('Leads'), tab: msg('Leads') },
};

export const categoryOrder: InsightCategory[] = ['campaign', 'content', 'audience', 'comments', 'leads'];

export const priorityMeta: Record<InsightPriority, { label: string; short: string; pill: string; dot: string }> = {
  high: { label: msg('High priority'), short: msg('High'), pill: 'bg-error-container text-on-error-container', dot: 'bg-error' },
  medium: { label: msg('Medium priority'), short: msg('Medium'), pill: 'bg-status-paused-subtle text-status-paused border border-status-paused/30', dot: 'bg-status-paused' },
  low: { label: msg('Low priority'), short: msg('Low'), pill: 'bg-surface-card-subtle text-text-secondary border border-border-strong', dot: 'bg-text-tertiary' },
};

export function PriorityPill({ priority, short, className }: { priority: InsightPriority; short?: boolean; className?: string }) {
  const t = useT();
  const m = priorityMeta[priority];
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold whitespace-nowrap', m.pill, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', m.dot)} />
      {t(short ? m.short : m.label)}
    </span>
  );
}

export const insightStatusMeta: Record<InsightStatus, { label: string; pill: string; icon: string }> = {
  new: { label: msg('New'), pill: 'bg-ai-subtle border-ai-border text-ai-accent', icon: 'fiber_new' },
  reviewed: { label: msg('Reviewed'), pill: 'bg-status-active-subtle border-status-active/30 text-status-active', icon: 'check_circle' },
  saved: { label: msg('Saved'), pill: 'bg-sky-900/40 border-sky-800 text-sky-300', icon: 'bookmark' },
  completed: { label: msg('Action completed'), pill: 'bg-status-active-subtle border-status-active/30 text-status-active', icon: 'task_alt' },
  dismissed: { label: msg('Dismissed'), pill: 'bg-surface-card-subtle border-border-strong text-text-secondary', icon: 'visibility_off' },
};

export const actionStatusMeta: Record<ActionStatus, { label: string; pill: string }> = {
  pending_review: { label: msg('To review'), pill: 'bg-status-paused-subtle text-status-paused border border-status-paused/30' },
  reviewed: { label: msg('Reviewed'), pill: 'bg-surface-card-subtle text-text-secondary border border-border-strong' },
  done: { label: msg('Done'), pill: 'bg-status-active-subtle text-status-active border border-status-active/30' },
  dismissed: { label: msg('Dismissed'), pill: 'bg-surface-card-subtle text-text-tertiary border border-border-strong line-through' },
};

/** Renders the `[[b:…]]`, `[[pos:…]]`, `[[neg:…]]` inline markup used in insight copy. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\[\[(?:b|pos|neg):[^\]]+\]\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\[\[(b|pos|neg):([^\]]+)\]\]$/.exec(part);
        if (!m) return <Fragment key={i}>{part}</Fragment>;
        const cls = m[1] === 'pos' ? 'text-status-active font-semibold' : m[1] === 'neg' ? 'text-error font-semibold' : 'text-text-primary font-semibold';
        return (
          <strong key={i} className={cls}>
            {m[2]}
          </strong>
        );
      })}
    </>
  );
}

/** Plain-text version of the markup (for print / clipboard). */
export const stripMarkup = (text: string) => text.replace(/\[\[(?:b|pos|neg):([^\]]+)\]\]/g, '$1');
