import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n/I18nContext';
import { formatDate, formatNumber } from '@/lib/format';
import type { Campaign, InstagramAccount } from '@/types/domain';
import { campaignDurationLabel, OBJECTIVE_LABEL } from '../campaignUtils';
import { SectionCard } from './SectionCard';

/** Shown on campaigns that have not started (scheduled / draft): what was planned, plus "no numbers yet". */
export function CampaignPlanCard({ campaign, account }: { campaign: Campaign; account: InstagramAccount | undefined }) {
  const t = useT();
  return (
    <SectionCard icon="assignment" title={t('Plan')} subtitle={t('Numbers show up after it starts.')}>
      <div className="mt-4 space-y-5">
        <p className="flex items-start gap-2 p-3 rounded-lg bg-status-completed-subtle text-body-sm text-text-secondary">
          <Icon name="schedule" className="text-[1.125rem] text-status-completed" />
          {campaign.status === 'draft'
            ? t('This is a draft. Add dates and schedule it to start tracking.')
            : campaign.startDate
              ? t('Tracking starts on {date}.', { date: formatDate(campaign.startDate) })
              : t('Tracking starts when the campaign starts.')}
        </p>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-body-sm">
          <Row label={t('Dates')}>{campaignDurationLabel(campaign, t)}</Row>
          <Row label={t('Goal')}>{t(OBJECTIVE_LABEL[campaign.objective])}</Row>
          <Row label={t('Instagram account')}>
            {account ? (
              <Link to={`/accounts/${account.id}`} className="text-primary font-semibold hover:underline">
                @{account.handle}
              </Link>
            ) : (
              '—'
            )}
          </Row>
          <Row label={t('Owner')}>{campaign.owner}</Row>
          <Row label={t('States')}>{campaign.targetRegions.length ? campaign.targetRegions.join(', ') : t('All states')}</Row>
          <Row label={t('Age group')}>{campaign.primaryAgeGroup ? t(campaign.primaryAgeGroup) : t('Not set')}</Row>
          <Row label={t('Hashtags')}>{campaign.hashtags.length ? campaign.hashtags.join(' ') : t('None')}</Row>
          <Row label={t('Posts ready')}>{campaign.creativesNote ?? formatNumber(campaign.creativesCount)}</Row>
          <Row label={t('Budget')}>{campaign.budgetInr !== undefined ? `₹${formatNumber(campaign.budgetInr)}` : t('Not set')}</Row>
          <Row label={t('Lead target')}>{campaign.leadGoal !== undefined ? formatNumber(campaign.leadGoal) : t('Not set')}</Row>
        </dl>
      </div>
    </SectionCard>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.75rem] text-text-tertiary font-medium">{label}</dt>
      <dd className="text-text-primary font-medium mt-0.5 break-words">{children}</dd>
    </div>
  );
}
