import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { EmptyState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { Pagination, TableShell, Td, Th } from '@/components/tables/DataTable';
import { useTable } from '@/hooks/useTable';
import { useT } from '@/i18n/I18nContext';
import { formatNumber } from '@/lib/format';
import type { SyncLogEntry, SyncRunStatus } from '@/types/accounts';
import { RawPayloadModal, SyncStatusBadge, triggerIcon } from '../SyncStatusBadge';

function downloadCsv(handle: string, rows: SyncLogEntry[]) {
  const header = ['executed_at', 'trigger', 'duration_sec', 'media', 'comments', 'status', 'note'];
  const esc = (v: string | number | undefined | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    `# DEMO DATA - sample sync audit log for @${handle}; not retrieved from Instagram`,
    header.join(','),
    ...rows.map((r) => [r.executedAt, r.triggerLabel, r.durationSec, r.media, r.comments ?? 0, r.status, r.statusLabel].map(esc).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `socialboard-sync-audit-${handle}-demo.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Sync history table with status filter, paging, CSV download and raw data viewer. */
export function SyncHistoryLog({ entries, handle, totalRuns }: { entries: SyncLogEntry[]; handle: string; totalRuns: number }) {
  const t = useT();
  const toast = useToast();
  const [status, setStatus] = useState<SyncRunStatus | 'all'>('all');
  const [rawEntry, setRawEntry] = useState<SyncLogEntry | null>(null);
  const filtered = useMemo(() => (status === 'all' ? entries : entries.filter((e) => e.status === status)), [entries, status]);
  const table = useTable<SyncLogEntry, 'executedAt' | 'durationSec' | 'media'>(filtered, {
    accessors: { executedAt: (r) => r.executedAt, durationSec: (r) => r.durationSec, media: (r) => r.media },
    initialSort: { key: 'executedAt', direction: 'desc' },
    pageSize: 4,
  });
  const failedCount = entries.filter((e) => e.status !== 'success').length;
  const count = (s: SyncRunStatus) => entries.filter((e) => e.status === s).length;

  return (
    <section className="bg-surface-card border border-border-strong rounded-xl shadow-card overflow-hidden" aria-labelledby="sync-history-title">
      <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 id="sync-history-title" className="font-heading text-[1.0625rem] font-semibold text-text-primary flex items-center gap-1.5">
            {t('Sync history')}
            <InfoTip text={t('Sample log. The full log would have {count} syncs for @{handle}.', { count: formatNumber(totalRuns), handle })} />
          </h2>
          <p className="text-body-sm text-text-secondary mt-0.5">{t('Each time SocialBoard fetched data. Sample data.')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            icon="restart_alt"
            onClick={() =>
              toast({
                tone: 'demo',
                title: failedCount ? t('Not retried: {count}', { count: failedCount }) : t('Nothing to retry'),
                description: t('Retrying is not available in this demo.'),
              })
            }
          >
            {t('Retry failed')}
          </Button>
          <Button
            icon="download"
            onClick={() => {
              downloadCsv(handle, entries);
              toast({ tone: 'success', title: t('Sync history downloaded'), description: t('CSV file made from the sample log.') });
            }}
          >
            {t('Download CSV')}
          </Button>
        </div>
      </div>
      <div className="px-5 pb-3">
        <SegmentedControl
          size="xs"
          ariaLabel={t('Filter syncs by status')}
          value={status}
          onChange={(v) => {
            setStatus(v);
            table.setPage(1);
          }}
          options={[
            { value: 'all', label: t('All'), count: entries.length },
            { value: 'success', label: t('Success'), count: count('success') },
            { value: 'partial', label: t('Partial'), count: count('partial') },
            { value: 'failed', label: t('Failed'), count: count('failed') },
          ]}
        />
      </div>
      {table.total === 0 ? (
        <div className="p-5">
          <EmptyState icon="history" title={t('No syncs match this filter')} />
        </div>
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th className="px-5" sortKey="executedAt" sort={table.sort} onSort={table.toggleSort}>
                {t('When')}
              </Th>
              <Th className="px-5" sortKey="durationSec" sort={table.sort} onSort={table.toggleSort}>
                {t('Took')}
              </Th>
              <Th className="px-5" sortKey="media" sort={table.sort} onSort={table.toggleSort}>
                {t('Fetched')}
              </Th>
              <Th className="px-5">{t('Status')}</Th>
              <Th className="px-5" align="right">
                <span className="sr-only">{t('Raw data')}</span>
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {table.rows.map((r) => (
              <tr key={r.id} className="hover:bg-surface-canvas transition-colors">
                <Td className="px-5 py-3">
                  <span className="block font-medium tnum">{r.executedLabel}</span>
                  <span className="flex items-center gap-1 text-[0.75rem] text-text-tertiary">
                    <Icon name={triggerIcon[r.trigger]} className="text-[0.875rem]" />
                    {r.triggerLabel}
                  </span>
                </Td>
                <Td className="px-5 py-3 text-text-secondary tnum">{r.durationSec !== null ? `${r.durationSec}s` : '—'}</Td>
                <Td className="px-5 py-3 text-text-secondary">
                  {r.comments
                    ? t('{media} posts, {comments} comments', { media: formatNumber(r.media), comments: formatNumber(r.comments) })
                    : t('{media} posts', { media: formatNumber(r.media) })}
                </Td>
                <Td className="px-5 py-3">
                  <SyncStatusBadge entry={r} />
                </Td>
                <Td className="px-5 py-3" align="right">
                  <button type="button" onClick={() => setRawEntry(r)} className="text-text-secondary hover:text-text-primary text-[0.75rem] hover:underline">
                    {t('Raw data')}
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
      <Pagination
        page={table.page}
        pageCount={table.pageCount}
        onPage={table.setPage}
        rangeStart={table.rangeStart}
        rangeEnd={table.rangeEnd}
        total={table.total}
        noun={t('syncs')}
      />
      <RawPayloadModal entry={rawEntry} onClose={() => setRawEntry(null)} />
    </section>
  );
}
