import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { EmptyState, QueryState, Skeleton } from '@/components/ui/States';
import { LiveConnectionsSection } from '@/features/instagram/LiveConnectionsSection';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { isDemoMode } from '@/lib/config';
import { accountDetailService } from '@/services/accountDetails';
import { accountService } from '@/services/accounts';
import { AccountCard } from './AccountCard';
import { AccountsKpis } from './AccountsKpis';
import { AccountsToolbar, applyAccountFilters, defaultAccountFilters, type AccountFilters } from './AccountsToolbar';
import { ScopesPolicySection } from './ScopesPolicySection';
import { SyncLogsDrawer } from './SyncLogsDrawer';
import { useAccountActions } from './useAccountActions';

export const META_DOCS_URL = 'https://developers.facebook.com/docs/instagram-platform';

/** One short, honest line saying the cards below are sample data. */
export function MetaIntegrationBanner({ version = 'v19.0' }: { version?: string }) {
  const t = useT();
  if (!isDemoMode) {
    return (
      <span className="flex items-center gap-1.5 text-body-sm text-text-secondary">
        <Icon name="science" className="text-[1rem] text-ai-accent" />
        {t('Sample accounts below are demo data.')}
        <InfoTip text={t('Live accounts are only in "Live Instagram connections" above. Their numbers are never added to the sample totals.')} />
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-body-sm text-text-secondary">
      <Icon name="science" className="text-[1rem] text-ai-accent" />
      {t('Sample accounts. No real Instagram account is connected in this demo.')}
      <a className="text-ai-accent font-semibold hover:underline inline-flex items-center gap-0.5" href={META_DOCS_URL} target="_blank" rel="noopener noreferrer" title={`Instagram API ${version}`}>
        {t('Instagram API docs')} <Icon name="arrow_outward" className="text-[0.875rem]" />
      </a>
    </span>
  );
}

function CardsSkeleton() {
  const t = useT();
  return (
    <div className="space-y-4" role="status" aria-label={t('Loading accounts')}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-32" />
      ))}
    </div>
  );
}

/**
 * Full Accounts Overview body. Also rendered blurred & inert underneath the connect flow
 * (`background`), in which case overlays are not mounted.
 */
export function AccountsOverview({ background = false }: { background?: boolean }) {
  const t = useT();
  const accounts = useQuery('accounts:list', accountService.list);
  const summary = useQuery('accounts:summary', accountDetailService.summary);
  const [filters, setFilters] = useState<AccountFilters>(defaultAccountFilters);
  const [logsOpen, setLogsOpen] = useState(false);
  const actions = useAccountActions();
  const list = accounts.data ?? [];
  const filtered = useMemo(() => applyAccountFilters(list, filters), [list, filters]);
  const grantedScopes = useMemo(() => [...new Set(list.flatMap((a) => a.scopes))], [list]);

  return (
    <div className="space-y-6">
      {!isDemoMode && !background && <LiveConnectionsSection />}

      <PageHeader
        title={isDemoMode ? t('Instagram accounts') : t('Sample accounts')}
        description={<MetaIntegrationBanner version={summary.data?.meta.graphApiVersion} />}
        actions={
          <>
            <Button size="md" icon="history" onClick={() => setLogsOpen(true)}>
              {t('Sync history')}
            </Button>
            {isDemoMode && (
              <LinkButton to="/accounts/connect" variant="primary" size="md" icon="add">
                {t('Connect account')}
              </LinkButton>
            )}
          </>
        }
      />

      <QueryState
        query={accounts}
        loading={
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
            <div className="mt-6">
              <CardsSkeleton />
            </div>
          </>
        }
        empty={
          <EmptyState
            icon="switch_account"
            title={t('No Instagram accounts yet')}
            description={t('Connect a Business or Creator account to see its data.')}
            action={
              <LinkButton to="/accounts/connect" variant="primary" icon="add">
                {t('Connect account')}
              </LinkButton>
            }
          />
        }
      >
        {(rows) => (
          <div className="space-y-6">
            {summary.data && <AccountsKpis accounts={rows} meta={summary.data.meta} />}
            <AccountsToolbar accounts={rows} filters={filters} onChange={setFilters} onSyncAll={() => actions.syncAll(rows)} syncingAll={actions.isSyncingAll} />
            <section className="space-y-4" aria-label={t('Instagram accounts')}>
              {filtered.length === 0 ? (
                <EmptyState
                  icon="filter_alt_off"
                  title={t('No accounts match these filters')}
                  description={t('Try another search or clear the filters.')}
                  action={
                    <Button icon="restart_alt" onClick={() => setFilters(defaultAccountFilters)}>
                      {t('Clear filters')}
                    </Button>
                  }
                />
              ) : (
                filtered.map((a) => <AccountCard key={a.id} account={a} actions={actions} />)
              )}
            </section>
          </div>
        )}
      </QueryState>

      {summary.data && <ScopesPolicySection scopes={grantedScopes} rateLimitNotes={summary.data.rateLimitNotes} retention={summary.data.retentionPolicy} />}

      {!background && (
        <>
          <SyncLogsDrawer open={logsOpen} onClose={() => setLogsOpen(false)} accounts={list} />
          {actions.overlays}
        </>
      )}
    </div>
  );
}
