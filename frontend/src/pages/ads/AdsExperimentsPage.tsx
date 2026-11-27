import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, QueryState } from '@/components/ui/States';
import { AdsTabs } from '@/features/ads/AdsTabs';
import { CompetitorsSection, CreativeSection, ExperimentCard, IdeasSection, MistakesSection, VerdictSummary } from '@/features/ads-reports/ExperimentSections';
import { DemoTitleBadge, ReportSection, SourceNotice, StatusCountsStrip } from '@/features/ads-reports/ReportUi';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { adsReportsService } from '@/services/adsReports';

/** Ads → Experiments: what was tried, what it taught us, mistakes to avoid and ideas to try next. */
export default function AdsExperimentsPage() {
  const t = useT();
  useDocumentTitle(t('Ad experiments'));
  const query = useQuery('ads:experiments', adsReportsService.experiments);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("What we've tried, and what it taught us")}
        titleAddon={<DemoTitleBadge />}
        description={t('Each experiment: the question, what we did, the numbers and the lesson.')}
      />
      <AdsTabs />
      <QueryState query={query}>
        {(data) => (
          <div className="space-y-6">
            <SourceNotice configured={data.configured} hasData={data.hasData} signupsConfigured={data.signupsConfigured} needsSignups={data.hasData} />
            {!data.hasData ? (
              <EmptyState
                icon="science"
                title={t('No experiments yet')}
                description={
                  data.configured
                    ? t('Meta Ads is connected. Experiments appear here after the first sync.')
                    : t('Connect Meta Ads: add META_ADS_ACCESS_TOKEN to backend/.env, then sync.')
                }
              />
            ) : (
              <>
                <ReportSection icon="fact_check" title={t('All Lead Form leads by status')}>
                  <StatusCountsStrip counts={data.leadStatusCounts} />
                </ReportSection>
                <MistakesSection data={data} />
                <section className="space-y-4" aria-label={t('Experiments')}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-heading text-[1.25rem] font-bold text-text-primary">{t('Experiments already run ({count})', { count: data.experiments.length })}</h2>
                    <VerdictSummary data={data} />
                  </div>
                  {data.experiments.map((e, i) => (
                    <ExperimentCard key={e.id} experiment={e} index={i} />
                  ))}
                </section>
                <CreativeSection creative={data.creative} />
                <IdeasSection data={data} />
              </>
            )}
            <CompetitorsSection data={data} />
          </div>
        )}
      </QueryState>
    </div>
  );
}
