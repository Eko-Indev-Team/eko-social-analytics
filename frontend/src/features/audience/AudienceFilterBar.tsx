import { Link } from 'react-router-dom';
import { Select } from '@/components/ui/Controls';
import { InfoTip } from '@/components/ui/InfoTip';
import { Notice } from '@/components/ui/Misc';
import { useT } from '@/i18n/I18nContext';
import { formatCompact, formatNumber } from '@/lib/format';
import type { AudienceFilters, AudiencePageData } from './model';

/** Compact filters: campaign, post and the "compare with last month" switch. */
export function AudienceFilterBar({ data, filters, onChange }: { data: AudiencePageData | undefined; filters: AudienceFilters; onChange: (f: AudienceFilters) => void }) {
  const t = useT();
  const campaigns = data?.campaigns.filter((c) => c.metrics) ?? [];
  const content = (data?.content ?? []).filter((c) => filters.campaignId === 'all' || c.campaignId === filters.campaignId);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        aria-label={t('Campaign')}
        className="w-auto max-w-[260px]"
        value={filters.campaignId}
        onChange={(e) => onChange({ ...filters, campaignId: e.target.value, contentId: 'all' })}
      >
        <option value="all">{t('All campaigns')}</option>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select aria-label={t('Post')} className="w-auto max-w-[260px]" value={filters.contentId} onChange={(e) => onChange({ ...filters, contentId: e.target.value })}>
        <option value="all">{t('All posts')}</option>
        {content.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </Select>
      <label className="flex items-center gap-2 cursor-pointer select-none text-label-md text-text-secondary">
        <input
          type="checkbox"
          checked={filters.compare}
          onChange={(e) => onChange({ ...filters, compare: e.target.checked })}
          className="w-4 h-4 rounded border-slate-700 text-border-focused focus:ring-0"
        />
        {t('Compare with last month')}
      </label>
      <span className="ml-auto flex items-center gap-1 text-label-sm text-text-tertiary">
        {t('Sample data')}
        <InfoTip text={t('Sample numbers shaped like Instagram Insights. Not fetched from Instagram.')} />
      </span>
    </div>
  );
}

/** Short note shown when a campaign or post is picked (the sections below stay account-wide). */
export function AudienceFilterNotice({ data, filters }: { data: AudiencePageData; filters: AudienceFilters }) {
  const t = useT();
  const item = filters.contentId !== 'all' ? data.content.find((c) => c.id === filters.contentId) : undefined;
  const campaign = filters.campaignId !== 'all' ? data.campaigns.find((c) => c.id === filters.campaignId) : undefined;
  if (!item && !campaign) return null;
  const profile = campaign ? data.intel.campaignProfiles.find((p) => p.campaignId === campaign.id) : undefined;

  if (item) {
    return (
      <Notice tone="demo" title={item.title}>
        {t('{views} views · {reach} people reached · {leads} leads.', {
          views: formatCompact(item.metrics.views),
          reach: formatCompact(item.metrics.reach),
          leads: formatNumber(item.metrics.leads),
        })}{' '}
        {t('The sections below show your whole account.')}{' '}
        <Link to={`/content/${item.id}`} className="text-primary font-semibold hover:underline">
          {t('Open post')} →
        </Link>
      </Notice>
    );
  }
  if (!campaign) return null;
  return (
    <Notice tone="demo" title={campaign.name}>
      {campaign.metrics && (
        <>
          {t('{views} views · {reach} people reached · {leads} leads.', {
            views: formatCompact(campaign.metrics.views),
            reach: formatCompact(campaign.metrics.reach),
            leads: formatNumber(campaign.metrics.leads),
          })}{' '}
        </>
      )}
      {profile && (
        <>
          {t('{pct}% non-followers, mostly aged {age} ({ageShare}%), top state {state} ({stateShare}%).', {
            pct: profile.nonFollowerPct,
            age: profile.coreAge.label,
            ageShare: profile.coreAge.share,
            state: profile.dominantState.label,
            stateShare: profile.dominantState.share,
          })}{' '}
        </>
      )}
      {t('The sections below show your whole account.')}{' '}
      <Link to={`/campaigns/${campaign.id}`} className="text-primary font-semibold hover:underline">
        {t('Open campaign')} →
      </Link>
    </Notice>
  );
}
