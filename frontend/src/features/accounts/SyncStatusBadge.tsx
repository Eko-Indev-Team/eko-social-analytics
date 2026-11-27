import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Overlay';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { SyncLogEntry, SyncRunStatus, SyncTrigger } from '@/types/accounts';

const statusCls: Record<SyncRunStatus, { pill: string; dot: string }> = {
  success: { pill: 'bg-status-active-subtle text-status-active border-emerald-800', dot: 'bg-status-active' },
  partial: { pill: 'bg-status-paused-subtle text-status-paused border-amber-800', dot: 'bg-status-paused' },
  failed: { pill: 'bg-error-container/60 text-on-error-container border-error/20', dot: 'bg-error' },
};

export const triggerIcon: Record<SyncTrigger, string> = { scheduled: 'alarm', manual: 'touch_app', webhook: 'webhook', token_refresh: 'key' };

export function SyncStatusBadge({ entry }: { entry: Pick<SyncLogEntry, 'status' | 'statusLabel'> }) {
  const s = statusCls[entry.status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold border whitespace-nowrap', s.pill)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
      {entry.statusLabel}
    </span>
  );
}

/** "view_json" — shows the bundled sample payload for a sync run. */
export function RawPayloadModal({ entry, onClose }: { entry: SyncLogEntry | null; onClose: () => void }) {
  const t = useT();
  const json = entry ? JSON.stringify(entry.raw, null, 2) : '';
  return (
    <Modal
      open={!!entry}
      onClose={onClose}
      size="md"
      icon="data_object"
      title={t('Raw sync data')}
      subtitle={entry ? `${entry.executedLabel} · ${entry.triggerLabel}` : undefined}
      footer={<Button onClick={onClose}>{t('Close')}</Button>}
    >
      <p className="text-body-sm text-text-secondary mb-2 flex items-center gap-1.5">
        <Icon name="info" className="text-[1rem]" />
        {t('Sample data, not a real reply from Instagram.')}
      </p>
      <pre className="text-[0.75rem] leading-5 font-mono bg-surface-canvas border border-border-strong rounded-lg p-3 overflow-x-auto custom-scrollbar text-text-primary">{json}</pre>
    </Modal>
  );
}
