import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { SegmentedControl, Select } from '@/components/ui/Controls';
import { KpiCard } from '@/components/ui/KpiCard';
import { Notice } from '@/components/ui/Misc';
import { EmptyState, QueryState } from '@/components/ui/States';
import { AdsTabs } from '@/features/ads/AdsTabs';
import { ReportSection, DemoTitleBadge, SourceNotice } from '@/features/ads-reports/ReportUi';
import { SignupsTable, TIER_LABEL } from '@/features/ads-reports/SignupsTable';
import { count } from '@/features/ads-reports/reportFormat';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { isDemoMode } from '@/lib/config';
import { adsReportsService } from '@/services/adsReports';
import type { AttributionTier } from '@/types/adsReports';

const VERDICTS = ['STRONG_QUALIFY', 'QUALIFY', 'NOT_QUALIFY'];

/** Ads → Website signups: who signed up on the website, which ad brought them, and the site's verdict. */
export default function AdsSignupsPage() {
  const t = useT();
  useDocumentTitle(t('Website signups'));
  const [tier, setTier] = useState<'all' | AttributionTier>('all');
  const [verdict, setVerdict] = useState('');
  const filters = { tier: tier === 'all' ? null : tier, verdict: verdict || null };
  const query = useQuery(`ads:signups:${filters.tier ?? ''}:${filters.verdict ?? ''}`, () => adsReportsService.signups(filters), {
    isEmpty: () => false,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Who signed up on the website')}
        titleAddon={<DemoTitleBadge />}
        description={t('Real website signups, matched to the ad that brought them, with the signup site\'s own verdict.')}
      />
      <AdsTabs />
      <QueryState query={query}>
        {(data) => {
          const tt = data.totals;
          const noneYet = tt.totalSignups === 0;
          return (
            <div className="space-y-6">
              <SourceNotice configured={data.configured} hasData={data.hasAdData} />
              {!isDemoMode && !data.signupsConfigured && (
                <Notice tone="info" title={t('Website signups are not connected')}>
                  {t('Add EKO_SIGNUP_ADMIN_BASE_URL, EKO_SIGNUP_ADMIN_USER and EKO_SIGNUP_ADMIN_PASSWORD to backend/.env, then sync.')}
                </Notice>
              )}
              {!data.piiVisible && (
                <Notice tone="info" icon="lock" title={t('Names, phone numbers and addresses are hidden')}>
                  {t('Your role sees counts and the last 4 digits only. Ask an Editor, Admin or Owner for full details.')}
                </Notice>
              )}
              {noneYet ? (
                <EmptyState icon="how_to_reg" title={t('No signups recorded yet')} description={t('Signups appear here after the signup admin is connected and synced.')} />
              ) : (
                <>
                  <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                    <KpiCard label="All signups" value={count(tt.totalSignups)} icon="how_to_reg" tone="teal" />
                    <KpiCard label="Matched to an ad" value={count(tt.campaignMatched)} icon="link" tone="success" hint="The signup link carried a Meta campaign ID and came from Facebook." />
                    <KpiCard label="From Facebook, ad unknown" value={count(tt.fbclidOnly)} icon="help" tone="warning" hint="Came from Facebook, but the link had no campaign tag." />
                    <KpiCard label="Not from Facebook" value={count(tt.notFacebook)} icon="public" tone="ai" />
                  </div>
                  <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                    <KpiCard label="From Facebook (all)" value={count(tt.facebookAttributed)} icon="thumb_up" tone="igPurple" />
                    <KpiCard label="Strong qualify (site's verdict)" value={count(tt.strongQualify)} icon="verified" tone="success" />
                    <KpiCard label="Lead Form leads, for comparison" value={count(tt.facebookLeadFormLeads)} icon="assignment" tone="teal" />
                  </div>
                  <ReportSection
                    icon="list"
                    title={t('Signups ({count})', { count: data.signups.length })}
                    actions={
                      <div className="flex flex-wrap items-center gap-2">
                        <SegmentedControl
                          size="xs"
                          ariaLabel={t('Where from')}
                          value={tier}
                          onChange={setTier}
                          options={[
                            { value: 'all', label: t('All') },
                            { value: 'campaign_matched', label: t(TIER_LABEL.campaign_matched) },
                            { value: 'fbclid_only', label: t(TIER_LABEL.fbclid_only) },
                            { value: 'none', label: t(TIER_LABEL.none) },
                          ]}
                        />
                        <Select aria-label={t("Site's verdict")} value={verdict} onChange={(e) => setVerdict(e.target.value)} className="h-8 text-xs">
                          <option value="">{t('Any verdict')}</option>
                          {VERDICTS.map((v) => (
                            <option key={v} value={v}>
                              {v.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                            </option>
                          ))}
                        </Select>
                      </div>
                    }
                  >
                    {data.signups.length === 0 ? (
                      <div className="text-center py-8 space-y-3">
                        <p className="text-body-sm text-text-secondary">{t('No signups match these filters.')}</p>
                        <Button
                          size="xs"
                          icon="filter_alt_off"
                          onClick={() => {
                            setTier('all');
                            setVerdict('');
                          }}
                        >
                          {t('Clear filters')}
                        </Button>
                      </div>
                    ) : (
                      <SignupsTable signups={data.signups} piiVisible={data.piiVisible} />
                    )}
                  </ReportSection>
                </>
              )}
            </div>
          );
        }}
      </QueryState>
    </div>
  );
}
