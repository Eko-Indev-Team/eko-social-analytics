import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, QueryState } from '@/components/ui/States';
import { AdsTabs } from '@/features/ads/AdsTabs';
import { AwardsSection, ChannelCompare, DeliverySection, GroupTables, PincodesSection, RankedAdsTable, StatesSection, VerdictsSection } from '@/features/ads-reports/PerformanceSections';
import { DemoTitleBadge, ReportSection, SourceNotice, StatusCountsStrip } from '@/features/ads-reports/ReportUi';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { adsReportsService } from '@/services/adsReports';

/** Ads → Performance: which ads worked, measured on the same scale (cost per result and per quality result). */
export default function AdsPerformancePage() {
  const t = useT();
  useDocumentTitle(t('Ad performance'));
  const query = useQuery('ads:performance', adsReportsService.performance);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Which ads actually worked')}
        titleAddon={<DemoTitleBadge />}
        description={t('Every ad that spent money, on the same scale: cost per result, cost per quality result and click rate.')}
      />
      <AdsTabs />
      <QueryState query={query}>
        {(data) =>
          !data.hasData ? (
            <EmptyState
              icon="ads_click"
              title={t('No ad results yet')}
              description={
                data.configured
                  ? t('Meta Ads is connected. Results appear here after the first sync.')
                  : t('Connect Meta Ads: add META_ADS_ACCESS_TOKEN to backend/.env, then sync.')
              }
            />
          ) : (
            <div className="space-y-6">
              <SourceNotice configured={data.configured} hasData={data.hasData} signupsConfigured={data.signupsConfigured} needsSignups />
              <AwardsSection data={data} />
              <ReportSection
                icon="fact_check"
                title={t('Lead Form leads by status')}
                subtitle={t('"Strongly qualified" means SBI strong or ESAF strong. Pitch ESAF: missed SBI, ESAF not offered yet.')}
              >
                <StatusCountsStrip counts={data.channels.leadForm.statusCounts} />
              </ReportSection>
              <ChannelCompare data={data} />
              <VerdictsSection data={data} />
              <RankedAdsTable rows={data.rows} />
              <GroupTables data={data} />
              <DeliverySection data={data} />
              <StatesSection data={data} />
              <PincodesSection data={data} />
            </div>
          )
        }
      </QueryState>
    </div>
  );
}
