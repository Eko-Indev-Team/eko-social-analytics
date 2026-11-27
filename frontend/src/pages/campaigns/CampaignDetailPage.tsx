import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LinkButton } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Controls';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { NotFoundError } from '@/lib/api/source';
import { accountService } from '@/services/accounts';
import { audienceService } from '@/services/audience';
import { campaignService } from '@/services/campaigns';
import { contentService } from '@/services/content';
import { leadService } from '@/services/leads';
import type { Campaign } from '@/types/domain';
import { SBI_CSP_CAMPAIGN_IDS, SBI_CSP_REPORT_ID } from '@/features/campaigns/campaignUtils';
import { EditCampaignModal } from '@/features/campaigns/EditCampaignModal';
import { useCampaignActions } from '@/features/campaigns/useCampaignActions';
import { AiCampaignAnalysis } from '@/features/campaigns/detail/AiCampaignAnalysis';
import { AudienceSnapshot } from '@/features/campaigns/detail/AudienceSnapshot';
import { CampaignContentList } from '@/features/campaigns/detail/CampaignContentList';
import { CampaignDetailHeader } from '@/features/campaigns/detail/CampaignDetailHeader';
import { CampaignKpiGrid } from '@/features/campaigns/detail/CampaignKpiGrid';
import { CampaignLeadsList } from '@/features/campaigns/detail/CampaignLeadsList';
import { CampaignPlanCard } from '@/features/campaigns/detail/CampaignPlanCard';
import { CommentsSnapshot } from '@/features/campaigns/detail/CommentsSnapshot';
import { LeadsSnapshot } from '@/features/campaigns/detail/LeadsSnapshot';
import { PerformanceAnalytics } from '@/features/campaigns/detail/PerformanceAnalytics';

type DetailTab = 'overview' | 'content' | 'audience' | 'comments' | 'leads' | 'ai';
const TABS: DetailTab[] = ['overview', 'content', 'audience', 'comments', 'leads', 'ai'];

export default function CampaignDetailPage() {
  const t = useT();
  const { campaignId = '' } = useParams();
  const campaignQ = useQuery(`campaigns:detail:${campaignId}`, () => campaignService.get(campaignId));
  useDocumentTitle(campaignQ.data?.name ?? t('Campaign'));

  if (campaignQ.status === 'loading') return <PageSkeleton kpis={4} />;
  if (campaignQ.status === 'empty' || (campaignQ.status === 'success' && !campaignQ.data)) {
    return (
      <EmptyState
        icon="campaign"
        title={t('Nothing here yet')}
        description={t('This campaign has nothing to show yet.')}
        action={
          <LinkButton to="/campaigns" icon="arrow_back">
            {t('Back to campaigns')}
          </LinkButton>
        }
      />
    );
  }
  if (campaignQ.status === 'error' || !campaignQ.data) {
    if (campaignQ.error instanceof NotFoundError) {
      return (
        <EmptyState
          icon="search_off"
          title={t('Campaign not found')}
          description={t('It may have been removed, or the link is wrong.')}
          action={
            <LinkButton to="/campaigns" variant="primary" icon="arrow_back">
              {t('Back to campaigns')}
            </LinkButton>
          }
        />
      );
    }
    return <ErrorState error={campaignQ.error} onRetry={campaignQ.refetch} />;
  }
  return <CampaignDetail campaign={campaignQ.data} />;
}

function CampaignDetail({ campaign }: { campaign: Campaign }) {
  const t = useT();
  const id = campaign.id;
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab') as DetailTab | null;
  const tab: DetailTab = tabParam && TABS.includes(tabParam) ? tabParam : 'overview';
  const [editing, setEditing] = useState(false);
  const actions = useCampaignActions();

  const extrasQ = useQuery(`campaigns:extras:${id}`, () => campaignService.detail(id));
  const contentQ = useQuery(`content:campaign:${id}`, () => contentService.listByCampaign(id));
  const leadsQ = useQuery(`leads:campaign:${id}`, () => leadService.listByCampaign(id));
  const funnelQ = useQuery(`leads:funnel:${id}`, () => leadService.campaignFunnel(id));
  const audienceQ = useQuery('audience:summary', audienceService.summary);
  const accountsQ = useQuery('accounts:list', accountService.list);

  const schedule = useMutation(() => campaignService.setStatus(id, 'scheduled'), { invalidate: ['campaigns'] });

  const extras = extrasQ.data ?? undefined;
  const hasMetrics = !!campaign.metrics;
  const accountLevelNote = id !== 'sbi-csp-october';
  const account = accountsQ.data?.find((a) => a.id === campaign.accountId);

  const setTab = (value: DetailTab) => {
    const next = new URLSearchParams(params);
    if (value === 'overview') next.delete('tab');
    else next.set('tab', value);
    setParams(next, { replace: true });
  };

  const onExport = () => {
    if (SBI_CSP_CAMPAIGN_IDS.includes(id)) {
      navigate(`/reports/${SBI_CSP_REPORT_ID}`);
      return;
    }
    toast({
      tone: 'info',
      title: t('No report for this campaign yet'),
      description: t('Opening Reports. The sample data only has a report for the SBI CSP campaigns.'),
    });
    navigate('/reports');
  };

  const onNewContent = () => {
    toast({
      tone: 'demo',
      title: t('Posting is not available yet'),
      description: t('Opening your posts instead.'),
    });
    navigate('/content');
  };

  const onSchedule = async () => {
    if (!campaign.startDate || !campaign.endDate) {
      toast({ tone: 'info', title: t('Add dates first'), description: t('Set a start and end date, then schedule it.') });
      setEditing(true);
      return;
    }
    const ok = await schedule.mutate();
    if (ok) toast({ tone: 'demo', title: t('"{name}" scheduled', { name: campaign.name }), description: t('Changed in SocialBoard only, not on Instagram.') });
  };

  const tabLabel = { overview: t('Overview'), content: t('Posts'), audience: t('Audience'), comments: t('Comments'), leads: t('Leads'), ai: t('AI summary') }[tab];
  const contentCount = contentQ.status === 'success' ? contentQ.data?.length : undefined;

  const contentList = <CampaignContentList campaign={campaign} query={contentQ} />;
  const comments = <CommentsSnapshot campaign={campaign} snapshot={extras?.comments} />;
  const analysis = <AiCampaignAnalysis analysis={extras?.analysis} hasMetrics={hasMetrics} />;
  const audience = <AudienceSnapshot query={audienceQ} hasMetrics={hasMetrics} accountLevelNote={accountLevelNote} />;
  const leadsSnapshot = <LeadsSnapshot campaign={campaign} query={funnelQ} />;

  return (
    <div>
      <CampaignDetailHeader
        campaign={campaign}
        onEdit={() => setEditing(true)}
        onToggleStatus={() => actions.setStatus([campaign], campaign.status === 'active' ? 'paused' : 'active')}
        onSchedule={onSchedule}
        onExport={onExport}
        onNewContent={onNewContent}
        statusPending={actions.statusPending || schedule.isPending}
      />

      <Tabs<DetailTab>
        ariaLabel={t('Campaign sections')}
        className="mt-4 gap-4 md:gap-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: t('Overview') },
          { value: 'content', label: t('Posts'), count: contentCount },
          { value: 'audience', label: t('Audience') },
          { value: 'comments', label: t('Comments') },
          { value: 'leads', label: t('Leads') },
          { value: 'ai', label: t('AI summary'), icon: 'auto_awesome', iconClassName: 'text-ai-accent' },
        ]}
      />

      <div className="mt-5" role="tabpanel" aria-label={tabLabel}>
        {tab === 'overview' &&
          (hasMetrics ? (
            <div className="space-y-6">
              <CampaignKpiGrid metrics={campaign.metrics!} baseline={campaign.baseline} />
              <PerformanceAnalytics campaign={campaign} progression={extras?.progression} />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Overview keeps the essentials; audience and comments have their own tabs. */}
                <div className="lg:col-span-7 flex flex-col gap-6 min-w-0">{contentList}</div>
                <div className="lg:col-span-5 flex flex-col gap-6 min-w-0">
                  {analysis}
                  {leadsSnapshot}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 min-w-0">
                <CampaignPlanCard campaign={campaign} account={account} />
              </div>
              <div className="lg:col-span-5 min-w-0">{contentList}</div>
            </div>
          ))}

        {tab === 'content' && contentList}

        {tab === 'audience' && <div className="max-w-3xl">{audience}</div>}

        {tab === 'comments' && <div className="max-w-4xl">{comments}</div>}

        {tab === 'leads' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 min-w-0">{leadsSnapshot}</div>
            <div className="lg:col-span-7 min-w-0">
              <CampaignLeadsList campaign={campaign} query={leadsQ} />
            </div>
          </div>
        )}

        {tab === 'ai' && <div className="max-w-3xl">{analysis}</div>}
      </div>

      <EditCampaignModal campaign={editing ? campaign : null} onClose={() => setEditing(false)} />
    </div>
  );
}
