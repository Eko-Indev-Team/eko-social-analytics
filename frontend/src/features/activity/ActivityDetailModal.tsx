import type { ReactNode } from 'react';
import { Button, LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/Toast';
import { msg, useT } from '@/i18n/I18nContext';
import { modeText } from '@/lib/config';
import { cn } from '@/lib/format';
import type { ActivityActor, ActivityEntry } from '@/types/activity';
import { categoryLabels, formatIst, KindPill, outcomeTextClass } from './activityUi';

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[0.75rem] text-text-tertiary">{label}</div>
      <div className="font-semibold text-text-primary break-words">{children}</div>
    </div>
  );
}

export function ActivityDetailModal({ entry, actor, onClose }: { entry: ActivityEntry | null; actor?: ActivityActor; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  if (!entry) return null;
  const ts = formatIst(entry.timestamp);
  const json = JSON.stringify(entry.payload, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      toast({ title: t('Copied'), description: t('The raw data was copied.') });
    } catch {
      toast({ tone: 'warning', title: t('Could not copy'), description: t('Your browser blocked copying. Select the text and copy it yourself.') });
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon="manage_search"
      title={entry.title}
      subtitle={<span className="font-label-code text-label-code text-text-tertiary">{entry.id}</span>}
      footer={
        <div className="flex items-center justify-between w-full gap-2 flex-wrap">
          <Button onClick={onClose}>{t('Close')}</Button>
          {entry.target.to ? (
            <LinkButton to={entry.target.to} variant="primary" iconRight="arrow_forward">
              {entry.target.module ? t('Open {name}', { name: entry.target.module }) : t('Open')}
            </LinkButton>
          ) : (
            <Button variant="primary" disabled iconRight="arrow_forward">
              {t('Open')}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <KindPill entry={entry} />
          <span className="text-body-sm text-text-tertiary">{t(categoryLabels[entry.category])}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface-canvas rounded-lg text-body-sm">
          <Meta label={t('When (IST)')}>
            {ts.date} • {ts.short}
          </Meta>
          <Meta label={t('Result')}>
            <span className={cn('flex items-center gap-1', outcomeTextClass[entry.outcome])}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" /> {entry.responseStatus}
            </span>
          </Meta>
          <Meta label={t('Who')}>
            {actor ? (actor.kind === 'member' ? `${actor.name} (${actor.email})` : actor.name) : entry.actorId}
            {actor?.role && <span className="block text-[0.6875rem] font-normal text-text-tertiary">{actor.role}</span>}
          </Meta>
          <Meta label={t('Source')}>
            <span className="font-mono text-[0.6875rem] text-text-secondary font-normal">{entry.origin}</span>
          </Meta>
        </div>

        <div>
          <span className="text-label-md font-semibold text-text-primary block mb-1">{t('Details')}</span>
          <p className="text-body-sm text-text-secondary">{entry.narrative}</p>
        </div>

        {entry.diff && entry.diff.length > 0 && (
          <div>
            <span className="text-label-md font-semibold text-text-primary block mb-1">{t('Changes')}</span>
            <div className="border border-border-strong rounded-lg overflow-x-auto">
              <table className="w-full text-body-sm min-w-[420px]">
                <thead>
                  <tr className="bg-surface-canvas text-text-secondary text-[0.75rem]">
                    <th className="text-left py-2 px-3">{t('Field')}</th>
                    <th className="text-left py-2 px-3">{t('Before')}</th>
                    <th className="text-left py-2 px-3">{t('After')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {entry.diff.map((d) => (
                    <tr key={d.field}>
                      <td className="py-2 px-3 font-semibold text-text-primary">{d.field}</td>
                      <td className="py-2 px-3 text-error/80 line-through decoration-error/40">{d.before}</td>
                      <td className="py-2 px-3 text-status-active font-medium">{d.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-label-md font-semibold text-text-primary">{t('Raw data (JSON)')}</span>
            <button
              type="button"
              onClick={copy}
              className="text-primary hover:text-brand-primary-hover text-label-sm font-semibold flex items-center gap-1"
            >
              <Icon name="content_copy" className="text-[0.8125rem]" /> {t('Copy')}
            </button>
          </div>
          <div className="bg-slate-950 text-slate-200 p-3 rounded-lg font-mono text-[0.6875rem] overflow-x-auto custom-scrollbar border border-slate-700">
            <pre>{json}</pre>
          </div>
        </div>

        <Notice tone="demo">{t(modeText(msg('Sample record. It is not signed or stored on a server.'), msg('Saved record. Entries are not signed yet.')))}</Notice>
      </div>
    </Modal>
  );
}
