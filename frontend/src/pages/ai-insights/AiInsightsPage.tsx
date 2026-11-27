import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { EmptyState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { insightsService } from '@/services/insights';
import { defaultInsightFilters, filterInsights, InsightCard, InsightFilterBar, type InsightFilterState } from '@/features/ai-insights/InsightFeed';
import { InsightsEmpty, InsightsError, InsightsSkeleton, ProcessingAnalysis } from '@/features/ai-insights/InsightsStates';
import { ExecutiveSynthesis, InsightKpiTiles } from '@/features/ai-insights/OverviewSummary';
import { RecommendedActionsTable } from '@/features/ai-insights/RecommendedActionsTable';
import { AiJobProgress, AiStatusNotice } from '@/features/ai/AiWidgets';
import { CampaignAnalyticsPanel } from '@/features/ai/CampaignAnalyticsPanel';
import { useAiJob } from '@/features/ai/useAiJob';
import { isDemoMode } from '@/lib/config';
import { aiService } from '@/services/ai';

/** AI Insights: four numbers, the AI summary, insight cards and suggested actions (plus AI status and source numbers in api mode). */
export default function AiInsightsPage() {
  const t = useT();
  useDocumentTitle(t('AI Insights'));
  const toast = useToast();
  const overviewQ = useQuery('insights:overview', insightsService.overview);
  const listQ = useQuery('insights:list', insightsService.list);
  const actionsQ = useQuery('insights:actions', insightsService.actions);
  const [filters, setFilters] = useState<InsightFilterState>(defaultInsightFilters);
  const [processing, setProcessing] = useState(false);
  const aiJob = useAiJob({ invalidate: ['insights', 'ai'] });
  const lastAi = useMemo(() => (listQ.data ?? []).map((i) => i.ai?.generatedAt).filter(Boolean).sort().at(-1), [listQ.data]);
  // api mode: queue a real, evidence-grounded generation job; demo mode keeps the labelled practice run.
  const startGeneration = () => (isDemoMode ? setProcessing(true) : void aiJob.start(() => aiService.generateInsights()));

  const regenerate = useMutation(insightsService.regenerate, {
    invalidate: ['insights'],
    onSuccess: () => {
      setProcessing(false);
      toast({
        tone: 'demo',
        title: t('Practice run finished'),
        description: t('No AI was called. These are the same sample insights. Real insights need the server.'),
      });
    },
    onError: (e) => {
      setProcessing(false);
      toast({ tone: 'error', title: t('Could not generate insights'), description: e.message });
    },
  });

  const visible = useMemo(() => filterInsights(listQ.data ?? [], filters), [listQ.data, filters]);

  const lastRun = isDemoMode ? overviewQ.data?.generatedAt : lastAi ? new Date(lastAi).toLocaleString() : undefined;

  const header = (
    <PageHeader
      title={t('AI Insights')}
      description={t('Tips from AI to improve your campaigns.')}
      className="md:items-center"
      actions={
        <>
          <span className="flex items-center gap-1.5 text-body-sm text-text-tertiary">
            <Icon name="schedule" className="text-[1rem]" />
            {lastRun ? t('Last run: {date}', { date: lastRun }) : t('Last run: never')}
          </span>
          <Button
            variant="primary"
            size="md"
            icon={aiJob.active ? 'progress_activity' : 'auto_awesome'}
            onClick={startGeneration}
            disabled={processing || !!aiJob.active}
            loading={aiJob.starting}
          >
            {aiJob.active ? t('Working…') : t('Generate insights')}
          </Button>
        </>
      }
    />
  );

  const apiExtras = !isDemoMode && (
    <div className="space-y-4">
      <AiStatusNotice />
      {aiJob.active && (
        <div className="bg-surface-card border border-ai-border rounded-xl p-4">
          <AiJobProgress job={aiJob.active} />
        </div>
      )}
      <CampaignAnalyticsPanel />
    </div>
  );

  const body = () => {
    if (processing) return <ProcessingAnalysis onComplete={() => regenerate.mutate()} onCancel={() => setProcessing(false)} />;
    if (overviewQ.status === 'loading' || listQ.status === 'loading') return <InsightsSkeleton />;
    if (overviewQ.status === 'error' || listQ.status === 'error') return <InsightsError error={overviewQ.error ?? listQ.error} onRetry={() => (overviewQ.refetch(), listQ.refetch(), actionsQ.refetch())} />;
    if (!overviewQ.data || !listQ.data) return <InsightsEmpty onRun={startGeneration} />;

    const overview = overviewQ.data;
    const actions = actionsQ.data ?? [];
    const top = listQ.data.find((i) => i.priority === 'high' && i.status !== 'dismissed') ?? listQ.data[0];
    return (
      <>
        {!isDemoMode && (
          <p className="flex items-center gap-1.5 text-body-sm text-text-secondary">
            <Icon name="science" className="text-[1rem] text-text-tertiary" />
            {t('Insights without an “AI-generated” label are sample content, not live AI.')}
            <InfoTip
              text={t('The numbers, the AI summary and unlabelled insights below are sample content stored in the database. No AI made them. Insights made from your data show an “AI-generated” label and list their evidence.')}
            />
          </p>
        )}
        <InsightKpiTiles overview={overview} actions={actions} />
        <ExecutiveSynthesis overview={overview} onRegenerate={startGeneration} topInsightId={top.id} />
        <InsightFilterBar insights={listQ.data} filters={filters} onChange={setFilters} />
        {visible.length === 0 ? (
          <EmptyState
            icon="search_off"
            title={t('No insights match')}
            description={t('Try a different topic, priority or word.')}
            action={
              <Button size="sm" onClick={() => setFilters(defaultInsightFilters)}>
                {t('Clear filters')}
              </Button>
            }
          />
        ) : (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4" aria-label={t('Insights')}>
            {visible.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </section>
        )}
        <RecommendedActionsTable actions={actions} />
      </>
    );
  };

  return (
    <div className="space-y-6">
      {header}
      {apiExtras}
      {body()}
    </div>
  );
}
