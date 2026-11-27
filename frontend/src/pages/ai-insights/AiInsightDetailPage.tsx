import { AiInsightBody } from '@/features/ai/AiInsightBody';
import { modeText } from '@/lib/config';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { LinkButton } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/i18n/I18nContext';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { NotFoundError } from '@/lib/api/source';
import { campaignService } from '@/services/campaigns';
import { commentsService } from '@/services/comments';
import { contentService } from '@/services/content';
import { insightsService } from '@/services/insights';
import { leadService } from '@/services/leads';
import type { InsightStatus } from '@/types/insights';
import { InsightDetailHeader } from '@/features/ai-insights/InsightDetailHeader';
import { ActionPlanSection, MissingEvidence, ReasoningSection, TelemetrySection } from '@/features/ai-insights/InsightEvidence';
import { RichText } from '@/features/ai-insights/insightMeta';
import { ArtifactsCard, AuditCard, CommentEvidenceCard } from '@/features/ai-insights/InsightSidebar';
import { printInsightBrief } from '@/features/ai-insights/printBrief';

function DetailSkeleton() {
  const t = useT();
  return (
    <div className="space-y-5" role="status" aria-label={t('Loading…')}>
      <Skeleton className="h-5 w-80" />
      <Skeleton className="h-48" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-56" />
        </div>
        <div className="lg:col-span-4 space-y-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-48" />
        </div>
      </div>
    </div>
  );
}

export default function AiInsightDetailPage() {
  const { insightId = '' } = useParams();
  const t = useT();
  const toast = useToast();

  const insightQ = useQuery(`insights:detail:${insightId}`, () => insightsService.get(insightId));
  const overviewQ = useQuery('insights:overview', insightsService.overview);
  const contentQ = useQuery('content:list', contentService.list);
  const campaignsQ = useQuery('campaigns:list', campaignService.list);
  const commentsQ = useQuery('comments:list', commentsService.list);
  const funnelCampaignId = insightQ.data?.detail?.artifacts?.funnelCampaignId;
  const funnelQ = useQuery(`leads:funnel:${funnelCampaignId ?? 'none'}`, () => leadService.campaignFunnel(funnelCampaignId ?? ''), { enabled: !!funnelCampaignId });

  useDocumentTitle(insightQ.data?.title ?? t('AI insight'));

  const setStatus = useMutation((status: InsightStatus) => insightsService.setStatus(insightId, status), { invalidate: ['insights'] });
  const toggleStep = useMutation((stepId: string) => insightsService.toggleStep(insightId, stepId), { invalidate: ['insights'] });

  const contentById = useMemo(() => new Map((contentQ.data ?? []).map((c) => [c.id, c])), [contentQ.data]);

  if (insightQ.status === 'loading') return <DetailSkeleton />;
  if (insightQ.status === 'error') {
    if (insightQ.error instanceof NotFoundError) {
      return (
        <EmptyState
          icon="search_off"
          title={t('Insight not found')}
          description={t('No insight with id "{id}". It may have been removed, or the link is wrong.', { id: insightId })}
          action={
            <LinkButton to="/ai-insights" variant="primary" icon="arrow_back">
              {t('Back to AI Insights')}
            </LinkButton>
          }
        />
      );
    }
    return <ErrorState title={t('Could not load this insight')} error={insightQ.error} onRetry={insightQ.refetch} />;
  }
  if (!insightQ.data) {
    return (
      <EmptyState
        icon="auto_awesome"
        title={t('No data for this insight')}
        description={t('There is no evidence for this period.')}
        action={<LinkButton to="/ai-insights">{t('Back to AI Insights')}</LinkButton>}
      />
    );
  }

  const insight = insightQ.data;
  const detail = insight.detail;
  const disclaimer = overviewQ.data?.disclaimer ?? t('AI never changes your Instagram campaigns or ad spend. A person must approve every action.');
  const artifacts = detail?.artifacts;
  const campaign = campaignsQ.data?.find((c) => c.id === artifacts?.campaignId);
  const primary = artifacts?.primaryContentId ? contentById.get(artifacts.primaryContentId) : undefined;
  const comparison = artifacts?.comparisonContentId ? contentById.get(artifacts.comparisonContentId) : undefined;
  const evidence = (detail?.evidenceCommentIds ?? []).map((id) => commentsQ.data?.items.find((c) => c.id === id)).filter((c) => c !== undefined);

  const changeStatus = async (status: InsightStatus) => {
    const res = await setStatus.mutate(status);
    if (!res) return;
    const copy: Record<InsightStatus, { title: string; description?: string }> = {
      reviewed: { title: t('Marked as reviewed'), description: modeText(t('Saved in this browser (sample data).'), t('Saved.')) },
      dismissed: { title: t('Insight dismissed'), description: t('Hidden from the list. You can restore it from this page.') },
      new: { title: t('Insight restored'), description: t('Back in the list, waiting for review.') },
      saved: { title: t('Insight saved'), description: t('Kept in the list for later.') },
      completed: { title: t('Marked as completed'), description: t('Noted that a person did the suggested action.') },
    };
    toast({ tone: 'success', ...copy[status] });
  };

  const exportBrief = () => {
    const opened = printInsightBrief(insight, disclaimer, t);
    toast(
      opened
        ? { tone: 'demo', title: t('Print view opened'), description: t('Choose "Save as PDF" in the print window.') }
        : { tone: 'warning', title: t('Pop-up blocked'), description: t('Allow pop-ups for this site to open the print view.') },
    );
  };

  return (
    <div className="space-y-6">
      <InsightDetailHeader
        insight={insight}
        disclaimer={disclaimer}
        busy={setStatus.isPending}
        onExport={exportBrief}
        onDismiss={() => changeStatus('dismissed')}
        onRestore={() => changeStatus('new')}
        onToggleReviewed={() => changeStatus(insight.status === 'reviewed' ? 'new' : 'reviewed')}
      />

      {insight.ai ? (
        <AiInsightBody insight={insight} onStatus={(st) => void changeStatus(st)} busy={setStatus.isPending} />
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6 min-w-0">
          {detail?.telemetry ? (
            <TelemetrySection telemetry={detail.telemetry} />
          ) : (
            <MissingEvidence title={t('What we saw')}>
              <p className="mt-0.5">
                <RichText text={insight.observed} />
              </p>
            </MissingEvidence>
          )}
          {detail?.reasoning ? (
            <ReasoningSection reasoning={detail.reasoning} />
          ) : (
            <MissingEvidence title={t('Why AI thinks so')}>
              <p className="mt-0.5">{insight.interpretation}</p>
            </MissingEvidence>
          )}
          {detail?.steps?.length ? (
            <ActionPlanSection insight={insight} busy={toggleStep.isPending} onToggleStep={(id) => toggleStep.mutate(id)} />
          ) : (
            <MissingEvidence title={t('Next steps')}>
              <p className="mt-0.5">
                {insight.impact.text}{' '}
                <LinkButton to={insight.primaryLink.to} size="xs" className="ml-1 align-middle" iconRight="arrow_forward">
                  {insight.primaryLink.label}
                </LinkButton>
              </p>
            </MissingEvidence>
          )}
        </div>
        <div className="lg:col-span-4 space-y-6 min-w-0">
          <ArtifactsCard insight={insight} campaign={campaign} primary={primary} comparison={comparison} funnel={funnelCampaignId ? funnelQ.data?.funnel : undefined} />
          <CommentEvidenceCard comments={evidence} contentTitle={(id) => contentById.get(id)?.title ?? id} />
          <AuditCard insight={insight} />
        </div>
      </div>
      )}
    </div>
  );
}
