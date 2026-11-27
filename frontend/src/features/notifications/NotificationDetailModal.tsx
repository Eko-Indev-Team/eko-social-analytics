import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Overlay';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { NotificationAction, NotificationItem } from '@/types/notifications';
import { NotificationBody } from './NotificationCard';
import { categoryLabels, metaToneText, neutralTag, priorityLabels, toneClasses } from './notificationMeta';

/** Notification details: full text, labels, tags and the facts behind it. */
export function NotificationDetailModal({ item, onClose, onAction }: { item: NotificationItem | null; onClose: () => void; onAction: (a: NotificationAction) => void }) {
  const t = useT();
  if (!item) return null;
  const tone = toneClasses[item.tone];
  const badge = toneClasses[item.badge.tone];
  const action = item.primaryAction;
  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span className={cn('w-7 h-7 rounded-full border flex items-center justify-center', tone.box)}>
            <Icon name={item.icon} className="text-[1.0625rem]" />
          </span>
          <span className="text-label-md font-semibold text-text-secondary">{t(categoryLabels[item.category])}</span>
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Close')}
          </Button>
          <Button variant="primary" onClick={() => onAction(action)}>
            {action.label}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-label-sm font-label-sm text-text-tertiary">{item.timestampLabel}</span>
          <span className={cn('h-5 px-2 rounded-full border text-[0.6875rem] font-semibold flex items-center', badge.pill)}>
            {item.priority === 'standard' ? item.badge.label : t(priorityLabels[item.priority])}
          </span>
        </div>
        <h2 className="font-heading text-[1.25rem] font-bold text-text-primary">{item.title}</h2>
        <p className="text-body-md text-text-secondary leading-relaxed">
          <NotificationBody item={item} />
        </p>
        {item.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {item.tags.map((tag) => (
              <span key={tag.label} className={cn('px-2 py-0.5 rounded-full border text-[0.75rem]', tag.tone ? toneClasses[tag.tone].pill : neutralTag)}>
                {tag.label}
              </span>
            ))}
          </div>
        )}
        <div className="bg-surface-canvas rounded-lg p-3 flex flex-col gap-2 text-body-sm">
          {item.meta.map((m, i) => (
            <div key={m.label} className={cn('flex justify-between gap-3 py-1', i < item.meta.length - 1 && 'border-b border-border-subtle')}>
              <span className="text-text-tertiary">{m.label}</span>
              <span className={cn('text-right', m.tone ? metaToneText[m.tone] : 'text-text-primary font-semibold')}>{m.value}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
