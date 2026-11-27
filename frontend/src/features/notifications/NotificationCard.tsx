import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { NotificationAction, NotificationItem } from '@/types/notifications';
import { categoryLabels, priorityLabels, toneClasses } from './notificationMeta';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Renders `body`, bolding `emphasis` phrases and italicising the quoted comment. */
export function NotificationBody({ item }: { item: NotificationItem }): ReactNode {
  const marks = [...(item.emphasis ?? []), ...(item.quote ? [item.quote] : [])];
  if (marks.length === 0) return item.body;
  const parts = item.body.split(new RegExp(`(${marks.map(escapeRe).join('|')})`, 'g'));
  return parts.map((p, i) =>
    p === item.quote ? (
      <span key={i} className="italic text-text-primary">
        {p}
      </span>
    ) : item.emphasis?.includes(p) ? (
      <span key={i} className="font-semibold text-text-primary">
        {p}
      </span>
    ) : (
      p
    ),
  );
}

export function NotificationCard({
  item,
  onOpen,
  onInspect,
  onToggleRead,
  onAction,
}: {
  item: NotificationItem;
  onOpen: () => void;
  onInspect: () => void;
  onToggleRead: () => void;
  onAction: (action: NotificationAction) => void;
}) {
  const t = useT();
  const tone = toneClasses[item.tone];
  const actions = [item.primaryAction, item.secondaryAction].filter((a): a is NotificationAction => !!a);
  return (
    <article
      className={cn(
        'relative bg-surface-card border rounded-xl p-4 shadow-card transition-all duration-150 hover:border-slate-600 group',
        'border-border-strong',
        item.priority === 'urgent' && !item.read && 'border-l-4 border-l-primary-container',
      )}
      aria-label={item.read ? item.title : t('Unread: {title}', { title: item.title })}
    >
      <div className="flex items-start gap-3.5">
        <div className="relative flex-shrink-0">
          <div className={cn('w-10 h-10 rounded-full border flex items-center justify-center', tone.box)}>
            <Icon name={item.icon} className="text-[1.25rem]" />
          </div>
          {!item.read && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary-container ring-2 ring-surface-card" aria-hidden />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-label-sm font-semibold text-text-secondary">{t(categoryLabels[item.category])}</span>
              <span className="text-text-tertiary text-xs">·</span>
              <span className="text-label-sm text-text-tertiary">{item.timeLabel}</span>
              {item.priority !== 'standard' && (
                <span
                  className={cn(
                    'h-[22px] px-2 rounded-full text-[0.6875rem] font-semibold flex items-center gap-1',
                    item.priority === 'urgent' ? 'bg-status-paused-subtle text-status-paused' : 'bg-error-container/40 text-on-error-container',
                  )}
                >
                  {t(priorityLabels[item.priority])}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-text-tertiary opacity-80 group-hover:opacity-100">
              <button type="button" className="p-1 hover:text-text-primary rounded hover:bg-surface-canvas" onClick={onInspect} title={t('Details')} aria-label={t('Details: {title}', { title: item.title })}>
                <Icon name="open_in_new" className="text-[1.0625rem]" />
              </button>
              <button
                type="button"
                className="p-1 hover:text-text-primary rounded hover:bg-surface-canvas"
                onClick={onToggleRead}
                title={item.read ? t('Mark as unread') : t('Mark as read')}
                aria-label={item.read ? t('Mark as unread: {title}', { title: item.title }) : t('Mark as read: {title}', { title: item.title })}
              >
                <Icon name={item.read ? 'mark_email_read' : 'drafts'} className="text-[1.0625rem]" />
              </button>
            </div>
          </div>
          <h3>
            <button
              type="button"
              onClick={onOpen}
              className={cn('text-left text-[0.9375rem] text-text-primary hover:text-primary transition-colors', item.read ? 'font-medium' : 'font-semibold')}
            >
              {item.title}
            </button>
          </h3>
          <p className="text-body-md text-text-secondary mt-1">
            <NotificationBody item={item} />
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            {actions.map((a, i) => (
              <span key={a.label} className="flex items-center gap-3">
                {i > 0 && <span className="text-text-subtle" aria-hidden>•</span>}
                <button
                  type="button"
                  onClick={() => onAction(a)}
                  className={cn(
                    'text-label-md font-label-md flex items-center gap-1',
                    i === 0 ? 'font-bold text-text-primary hover:text-brand-primary-hover' : 'text-text-secondary hover:text-text-primary',
                  )}
                >
                  <span>{a.label}</span>
                  {i === 0 && <Icon name={a.icon ?? 'arrow_forward'} className="text-[1rem]" />}
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
