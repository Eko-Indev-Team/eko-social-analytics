import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { SegmentedControl, Select } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Drawer } from '@/components/ui/Overlay';
import { EmptyState, QueryState, Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { formatNumber } from '@/lib/format';
import { accountDetailService } from '@/services/accountDetails';
import type { SyncLogEntry, SyncRunStatus } from '@/types/accounts';
import type { InstagramAccount } from '@/types/domain';
import { RawPayloadModal, SyncStatusBadge, triggerIcon } from './SyncStatusBadge';

/** Overview "Sync Logs" drawer: recent pipeline runs across every sample account. */
export function SyncLogsDrawer({ open, onClose, accounts }: { open: boolean; onClose: () => void; accounts: InstagramAccount[] }) {
  const t = useT();
  const logs = useQuery('accounts:sync-logs:all', () => accountDetailService.syncLogs(), { enabled: open });
  const [accountId, setAccountId] = useState('all');
  const [status, setStatus] = useState<SyncRunStatus | 'all'>('all');
  const [rawEntry, setRawEntry] = useState<SyncLogEntry | null>(null);
  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="w-full sm:w-[520px]"
      title={t('Sync history')}
      subtitle={t('Recent syncs for all accounts. Sample data.')}
      footer={<Button onClick={onClose}>{t('Close')}</Button>}
    >
      <div className="flex flex-col gap-3 mb-4">
        <Select aria-label={t('Filter by account')} value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full">
          <option value="all">{t('All accounts')}</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              @{a.handle}
            </option>
          ))}
        </Select>
        <SegmentedControl
          ariaLabel={t('Filter by status')}
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: t('All') },
            { value: 'success', label: t('Success') },
            { value: 'partial', label: t('Partial') },
            { value: 'failed', label: t('Failed') },
          ]}
        />
      </div>
      <QueryState
        query={logs}
        loading={
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        }
        empty={<EmptyState icon="history" title={t('No syncs yet')} description={t('Syncs show up here once accounts are connected.')} />}
      >
        {(rows) => {
          const filtered = rows.filter((r) => (accountId === 'all' || r.accountId === accountId) && (status === 'all' || r.status === status));
          if (filtered.length === 0) return <EmptyState icon="filter_alt_off" title={t('No syncs match these filters')} />;
          return (
            <ol className="space-y-2">
              {filtered.map((r) => {
                const acc = byId.get(r.accountId);
                return (
                  <li key={r.id} className="p-3 rounded-lg border border-border-strong bg-surface-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-label-md font-semibold text-text-primary tnum">{r.executedLabel}</p>
                        <p className="text-body-sm text-text-secondary flex items-center gap-1 mt-0.5">
                          <Icon name={triggerIcon[r.trigger]} className="text-[0.875rem] text-text-tertiary" />
                          {r.triggerLabel}
                          {r.durationSec !== null && <span className="text-text-tertiary tnum">· {r.durationSec}s</span>}
                        </p>
                      </div>
                      <SyncStatusBadge entry={r} />
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2 text-body-sm">
                      {acc ? (
                        <Link to={`/accounts/${acc.id}`} className="font-medium text-text-primary hover:underline">
                          @{acc.handle}
                        </Link>
                      ) : (
                        <span className="text-text-tertiary">{t('Removed account')}</span>
                      )}
                      <span className="text-text-secondary tnum">
                        {r.comments ? t('{media} posts, {comments} comments', { media: formatNumber(r.media), comments: formatNumber(r.comments) }) : t('{media} posts', { media: formatNumber(r.media) })}
                      </span>
                      <button type="button" onClick={() => setRawEntry(r)} className="text-text-secondary hover:text-text-primary text-[0.75rem] hover:underline">
                        {t('Raw data')}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          );
        }}
      </QueryState>
      <RawPayloadModal entry={rawEntry} onClose={() => setRawEntry(null)} />
    </Drawer>
  );
}
