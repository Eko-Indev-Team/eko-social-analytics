import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Misc';
import { QueryState } from '@/components/ui/States';
import { AdsTabs } from '@/features/ads/AdsTabs';
import { DemoTitleBadge, SourceNotice } from '@/features/ads-reports/ReportUi';
import { count, STATUS_LABEL, STATUS_ORDER, STATUS_TONE } from '@/features/ads-reports/reportFormat';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { isDemoMode } from '@/lib/config';
import { cn } from '@/lib/format';
import { adsReportsService } from '@/services/adsReports';

function Line({ label, value, strong, sub }: { label: ReactNode; value: number; strong?: boolean; sub?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-2 border-b border-border-subtle last:border-b-0', sub && 'pl-4')}>
      <span className={cn('text-body-sm', sub ? 'text-text-tertiary' : 'text-text-secondary')}>{label}</span>
      <span className={cn('font-heading tnum text-text-primary', strong ? 'text-[1.5rem] font-bold' : 'text-[1.0625rem] font-semibold')}>{count(value)}</span>
    </div>
  );
}

/** Ads → Overview: Lead Form leads and website signups side by side, each with its own idea of "qualified". */
export default function AdsOverviewPage() {
  const t = useT();
  useDocumentTitle(t('Ads overview'));
  const query = useQuery('ads:overview', adsReportsService.overview);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Both channels, one page')}
        titleAddon={<DemoTitleBadge />}
        description={t('Facebook Lead Form leads and website signups side by side: how many came through each, and how many are qualified.')}
      />
      <AdsTabs />
      <QueryState query={query}>
        {(d) => (
          <div className="space-y-6">
            <SourceNotice configured={d.configured} hasData={d.hasAdData} />
            {!isDemoMode && !d.hasAdData && (
              <Notice tone="info" title={t('No Lead Form data yet')}>
                {t('Connect Meta Ads: add META_ADS_ACCESS_TOKEN to backend/.env, then sync.')}
              </Notice>
            )}
            {!isDemoMode && !d.signupsConfigured && (
              <Notice tone="info" title={t('Website signups are not connected')}>
                {t('Add EKO_SIGNUP_ADMIN_BASE_URL, EKO_SIGNUP_ADMIN_USER and EKO_SIGNUP_ADMIN_PASSWORD to backend/.env, then sync.')}
              </Notice>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <h2 className="flex items-center gap-2 font-heading text-[1.0625rem] font-semibold text-text-primary">
                  <Icon name="assignment" className="text-[1.25rem] text-status-completed" />
                  {t('Facebook Lead Form')}
                </h2>
                <div className="mt-3">
                  <Line label={t('Leads')} value={d.formLeads} strong />
                  <Line label={t('Strongly qualified (SBI or ESAF)')} value={d.formQualified} />
                  {STATUS_ORDER.map((k) => (
                    <Line
                      key={k}
                      sub
                      label={
                        <Badge tone={STATUS_TONE[k]} dot>
                          {t(STATUS_LABEL[k])}
                        </Badge>
                      }
                      value={d.formStatusCounts[k]}
                    />
                  ))}
                  <Line label={t('In a pincode the ad targeted')} value={d.formPincodeQualified} />
                  <Line label={t('Leads where the pincode could be checked')} value={d.formPincodeCheckable} sub />
                </div>
              </Card>
              <Card className="p-5">
                <h2 className="flex items-center gap-2 font-heading text-[1.0625rem] font-semibold text-text-primary">
                  <Icon name="language" className="text-[1.25rem] text-ai-accent" />
                  {t('Website signup link')}
                </h2>
                <p className="text-[0.75rem] text-text-tertiary mt-0.5">{t("Qualified by the signup site's own verdict")}</p>
                <div className="mt-3">
                  <Line label={t('Signups')} value={d.urlSignupsTotal} strong />
                  <Line label={t('From a Facebook ad')} value={d.urlSignupsFacebook} sub />
                  <Line label={t('Strong qualify')} value={d.urlStrongQualify} />
                  <Line label={t('Not qualified')} value={d.urlNotQualify} />
                </div>
              </Card>
            </div>
            <Card className="p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-body-sm text-text-secondary">{t('Overall (both channels)')}</p>
                <p className="font-heading text-[1.75rem] font-bold text-text-primary tnum">{count(d.overallTotal)}</p>
              </div>
              <p className="text-body-sm text-text-tertiary max-w-2xl">
                {t(
                  "Each channel measures qualification differently. A Lead Form lead is strongly qualified for SBI when its pincode is one the ad targeted, it can invest and it studied to 12th or above. A 12th-pass lead that misses the pincode or can't invest can be strongly qualified for the zero-investment ESAF model by agreeing to it. Website signups carry the site's own verdict. They are shown separately so neither is misread as the other.",
                )}
              </p>
            </Card>
            <div className="flex flex-wrap gap-3 text-body-sm">
              <span className="text-text-secondary">{t('See the detail:')}</span>
              <Link className="text-primary hover:underline" to="/ads/leads">
                {t('Ad leads')}
              </Link>
              <Link className="text-primary hover:underline" to="/ads/signups">
                {t('Website signups')}
              </Link>
              <Link className="text-primary hover:underline" to="/ads/performance">
                {t('Performance')}
              </Link>
            </div>
          </div>
        )}
      </QueryState>
    </div>
  );
}
