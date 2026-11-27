import { useAppUi } from '@/app/AppUiContext';
import { KpiCard } from '@/components/ui/KpiCard';
import { msg, useT } from '@/i18n/I18nContext';
import { formatNumber } from '@/lib/format';
import type { AccountsSummaryMeta } from '@/types/accounts';
import type { InstagramAccount } from '@/types/domain';

/** Four summary numbers; counts are derived from the (sample) account list. */
export function AccountsKpis({ accounts, meta }: { accounts: InstagramAccount[]; meta: AccountsSummaryMeta }) {
  const t = useT();
  const { lastSyncedLabel } = useAppUi();
  const active = accounts.filter((a) => a.status !== 'expired');
  const business = active.filter((a) => a.type === 'business').length;
  const creator = active.filter((a) => a.type === 'creator').length;
  const attention = accounts.filter((a) => a.status === 'action_required' || a.status === 'expired').length;
  const lastSync = lastSyncedLabel.replace(/^Synced\s+/i, '');

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label={t('Account summary')}>
      <KpiCard label={msg('Active accounts')} icon="account_circle" tone="teal" value={formatNumber(active.length)} footnote={t('Business {business} · Creator {creator}', { business, creator })} />
      <KpiCard label={msg('Need attention')} icon="warning" tone="warning" value={formatNumber(attention)} hint={msg('Accounts that need a new login or have expired.')} />
      <KpiCard label={msg('Last sync')} icon="update" tone="success" value={<span className="text-[1.25rem] first-letter:uppercase">{lastSync}</span>} footnote={meta.cadenceLabel} />
      <KpiCard
        label={msg('Instagram connection')}
        icon="speed"
        tone="ai"
        value={`${meta.apiHealthPercent}%`}
        footnote={t('Calls used: {used} of {limit} (sample)', { used: formatNumber(meta.apiCallsUsed), limit: formatNumber(meta.apiCallsLimit) })}
      />
    </section>
  );
}
