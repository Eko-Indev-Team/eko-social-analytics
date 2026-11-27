import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { TableShell, Td, Th } from '@/components/tables/DataTable';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { CapabilityRow, CapabilityStatus } from '@/types/accounts';

const statusMeta: Record<CapabilityStatus, { label: string; cls: string; dot?: string }> = {
  available: { label: msg('Available'), cls: 'bg-status-active-subtle text-status-active border-emerald-800', dot: 'bg-status-active' },
  partial: { label: msg('Partial'), cls: 'bg-status-paused-subtle text-status-paused border-amber-800', dot: 'bg-status-paused' },
  permission_required: { label: msg('Needs permission'), cls: 'bg-status-draft-subtle text-status-draft border-border-strong' },
  unavailable: { label: msg('Unavailable'), cls: 'bg-error-container/60 text-on-error-container border-error/20', dot: 'bg-error' },
};

/** Which kinds of data this account can give. */
export function CapabilitiesMatrix({ rows, version, onRefresh, refreshing }: { rows: CapabilityRow[]; version: string; onRefresh: () => void; refreshing: boolean }) {
  const t = useT();
  return (
    <section className="bg-surface-card border border-border-strong rounded-xl shadow-card overflow-hidden" aria-labelledby="capabilities-title">
      <div className="p-5 flex items-start justify-between gap-3">
        <div>
          <h2 id="capabilities-title" className="font-heading text-[1.0625rem] font-semibold text-text-primary flex items-center gap-1.5">
            {t('Available data')}
            <InfoTip text={t('Sample status for Instagram API {version}.', { version })} />
          </h2>
          <p className="text-body-sm text-text-secondary mt-0.5">{t('What this account can share with SocialBoard.')}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="p-1 text-text-secondary hover:text-text-primary rounded hover:bg-surface-canvas disabled:opacity-50"
          aria-label={t('Reload')}
          title={t('Reload')}
        >
          <Icon name="refresh" className={cn('text-[1.125rem]', refreshing && 'animate-spin')} />
        </button>
      </div>
      <TableShell>
        <thead>
          <tr>
            <Th className="px-5">{t('Data')}</Th>
            <Th className="px-5">{t('Status')}</Th>
            <Th className="px-5">{t('Last updated')}</Th>
            <Th className="px-5">{t('Notes')}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {rows.map((r) => {
            const s = statusMeta[r.status];
            return (
              <tr key={r.key} className="hover:bg-surface-canvas transition-colors">
                <Td className="px-5 py-3 font-semibold whitespace-nowrap">
                  <span className="flex items-center gap-2" title={r.endpoints}>
                    <Icon name={r.icon} className={cn('text-[1.125rem]', r.iconClassName ?? 'text-text-secondary')} />
                    {r.category}
                  </span>
                </Td>
                <Td className="px-5 py-3">
                  <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-label-sm font-semibold border whitespace-nowrap', s.cls)}>
                    {s.dot && <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />}
                    {t(s.label)}
                  </span>
                </Td>
                <Td className={cn('px-5 py-3 tnum whitespace-nowrap', r.lastUpdated ? 'text-text-secondary' : 'text-text-tertiary')}>{r.lastUpdated ?? '—'}</Td>
                <Td className="px-5 py-3 text-text-secondary min-w-[240px] whitespace-normal">
                  {r.note}
                  {r.noteScope && (
                    <>
                      {' '}
                      <code className="font-mono text-[0.6875rem] bg-surface-canvas px-1.5 py-0.5 rounded text-text-primary">{r.noteScope}</code>
                    </>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>
    </section>
  );
}
