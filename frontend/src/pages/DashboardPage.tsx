import { useAppUi } from '@/app/AppUiContext';
import { Button, LinkButton } from '@/components/ui/Button';
import { EmptyState, ErrorState, QueryState, Skeleton } from '@/components/ui/States';
import { AudienceSnapshot } from '@/features/dashboard/AudienceSnapshot';
import { CampaignPerformanceTable } from '@/features/dashboard/CampaignPerformanceTable';
import { DashboardHeader } from '@/features/dashboard/DashboardHeader';
import { DashboardKpis } from '@/features/dashboard/DashboardKpis';
import { ExecutiveBrief } from '@/features/dashboard/ExecutiveBrief';
import { PerformanceTrends } from '@/features/dashboard/PerformanceTrends';
import { activeCampaigns } from '@/features/dashboard/selectors';
import { TopContent } from '@/features/dashboard/TopContent';
import { LiveInstagramCard } from '@/features/instagram/LiveInstagramCard';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/i18n/I18nContext';
import { isDemoMode } from '@/lib/config';
import { useQuery } from '@/hooks/useQuery';
import { accountService } from '@/services/accounts';
import { campaignService } from '@/services/campaigns';

/** Dashboard: greeting, four headline numbers, the growth chart, campaigns, AI summary, best posts and audience. */
export default function DashboardPage() {
  const t = useT();
  useDocumentTitle(t('Dashboard'));
  const { openCreateCampaign } = useAppUi();
  const overview = useQuery('accounts:overview', accountService.overview);
  const campaigns = useQuery('campaigns:list', campaignService.list);

  return (
    <div className="space-y-6">
      <DashboardHeader activeCount={campaigns.data ? activeCampaigns(campaigns.data).length : undefined} healthScore={overview.data?.aiHealthScore} />
      {!isDemoMode && <LiveInstagramCard />}
      <QueryState
        query={overview}
        loading={<DashboardSkeleton />}
        error={(err, retry) => (
          <ErrorState
            title={t('Could not load your numbers')}
            error={err}
            onRetry={() => {
              retry();
              campaigns.refetch();
            }}
          />
        )}
        empty={
          <EmptyState
            icon="search_off"
            title={t('Nothing here yet')}
            description={t('No Instagram activity in this period. Start a campaign or connect an account.')}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" size="md" icon="add" onClick={openCreateCampaign}>
                  {t('New campaign')}
                </Button>
                <LinkButton to="/accounts">{t('Instagram accounts')}</LinkButton>
              </div>
            }
          />
        }
      >
        {(data) => (
          <>
            <DashboardKpis overview={data} campaigns={campaigns.data} />
            <PerformanceTrends />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <QueryState query={campaigns} loading={<Skeleton className="lg:col-span-2 h-80" />} empty={<CampaignsEmpty onCreate={openCreateCampaign} />}>
                {(list) => <CampaignPerformanceTable campaigns={list} />}
              </QueryState>
              <ExecutiveBrief />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <TopContent />
              <AudienceSnapshot />
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}

function DashboardSkeleton() {
  const t = useT();
  return (
    <div className="space-y-4" role="status" aria-label={t('Loading…')}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-80" />
      <Skeleton className="h-64" />
      <span className="sr-only">{t('Loading…')}</span>
    </div>
  );
}

function CampaignsEmpty({ onCreate }: { onCreate: () => void }) {
  const t = useT();
  return (
    <EmptyState
      className="lg:col-span-2"
      icon="campaign"
      title={t('No campaigns yet')}
      description={t('Create your first campaign to see its numbers here.')}
      action={
        <Button variant="primary" size="md" icon="add" onClick={onCreate}>
          {t('New campaign')}
        </Button>
      }
    />
  );
}
