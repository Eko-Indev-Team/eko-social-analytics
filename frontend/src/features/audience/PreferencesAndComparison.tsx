import { Link } from 'react-router-dom';
import { CampaignStatusBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { msg, useT } from '@/i18n/I18nContext';
import { cn, formatCompact, formatPercent } from '@/lib/format';
import { AudienceCard } from './AudienceCard';
import type { AudiencePageData } from './model';

/** What each age group likes to watch (lead / engagement / lead-rate figures come from the segment table). */
export function ContentPreferencesSection({ data }: { data: AudiencePageData }) {
  const t = useT();
  const { intel, content } = data;
  return (
    <AudienceCard
      title={t('What each group likes')}
      subtitle={t('Best formats and topics per age group')}
      actions={
        <Link to="/content" className="text-label-md text-primary font-semibold hover:underline flex items-center gap-1">
          {t('Open content')} <Icon name="arrow_forward" className="text-[0.875rem]" />
        </Link>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {intel.contentPreferences.map((p) => {
          const seg = intel.segments.find((s) => s.id === p.segmentId);
          const top = content.find((c) => c.id === p.topContentId);
          const amber = p.tone === 'amber';
          const rows: Array<[string, string]> = [
            [msg('Best format'), p.topFormat],
            [msg('Next best'), p.runnerUp],
            [msg('Topic'), p.topic],
          ];
          return (
            <div key={p.segmentId} className="p-4 bg-surface-canvas rounded-lg flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={cn(
                    'px-2.5 py-0.5 rounded-full text-xs font-semibold',
                    amber ? 'bg-amber-400/15 text-amber-400' : 'bg-status-completed-subtle text-status-completed',
                  )}
                >
                  {p.title}
                </span>
                {seg && <span className="text-xs font-semibold text-text-primary">{t('{count} leads', { count: seg.leads })}</span>}
              </div>
              <p className="text-xs text-text-secondary">{t('Wants: {intent}', { intent: p.intent })}</p>
              <div className="space-y-1.5">
                {rows.map(([k, v]) => (
                  <div key={k} className="text-xs text-text-primary flex items-center gap-2">
                    <Icon name="check_small" className={cn('text-[1rem]', amber ? 'text-primary' : 'text-status-completed')} />
                    <span>
                      {t(k)}: <strong className="font-semibold">{v}</strong>
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
                {top ? (
                  <Link to={`/content/${top.id}`} className="tnum hover:underline">
                    {t('Top post: {views} views', { views: formatCompact(top.metrics.views) })}
                  </Link>
                ) : (
                  <span />
                )}
                {seg && (
                  <span className="tnum">
                    {t('Engagement {rate} · Lead rate {leadRate}', { rate: formatPercent(seg.engagementRate), leadRate: formatPercent(seg.conversionRate, 1) })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AudienceCard>
  );
}

/** Two campaigns side by side (views from campaignService, audience profile from sample data). */
export function CampaignComparisonSection({ data }: { data: AudiencePageData }) {
  const t = useT();
  return (
    <AudienceCard title={t('Compare campaigns')} subtitle={t('Who each campaign reached')}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.intel.campaignProfiles.map((p) => {
          const c = data.campaigns.find((x) => x.id === p.campaignId);
          if (!c) return null;
          const tiles = [
            { key: 'views', label: t('Views'), value: formatCompact(c.metrics?.views), accent: false },
            { key: 'non', label: t('Non-followers'), value: `${p.nonFollowerPct}%`, accent: p.nonFollowerPct >= 50 },
            { key: 'age', label: t('Main age ({age})', { age: p.coreAge.label }), value: `${p.coreAge.share}%`, accent: false },
            { key: 'state', label: t('Top state ({state})', { state: p.dominantState.label }), value: `${p.dominantState.share}%`, accent: false },
          ];
          return (
            <div key={p.campaignId} className="p-4 bg-surface-canvas rounded-lg">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <span className="text-label-sm text-text-tertiary">{p.flightLabel}</span>
                  <h4 className="font-heading text-[1rem] font-semibold text-text-primary">{c.name}</h4>
                </div>
                <CampaignStatusBadge status={c.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                {tiles.map((tile) => (
                  <div key={tile.key}>
                    <span className="text-text-secondary block">{tile.label}</span>
                    <strong className={cn('font-semibold text-sm tnum', tile.accent ? 'text-primary' : 'text-text-primary')}>{tile.value}</strong>
                  </div>
                ))}
              </div>
              <Link to={`/campaigns/${c.id}`} className="text-xs font-semibold text-primary hover:underline">
                {t('Open campaign')} →
              </Link>
            </div>
          );
        })}
      </div>
    </AudienceCard>
  );
}

/** Short data-limits line + quick links at the bottom of the page. */
export function DataLimitsNotice() {
  const t = useT();
  return (
    <section className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-secondary px-1">
      <span className="flex items-center gap-1.5">
        <Icon name="lock" className="text-[1rem] text-text-tertiary" />
        {t('Instagram does not share exact locations or income. All numbers here are sample data.')}
      </span>
      <span className="flex flex-wrap items-center gap-3 font-semibold">
        <Link className="text-primary hover:underline" to="/content">
          {t('Content')} →
        </Link>
        <Link className="text-primary hover:underline" to="/comments">
          {t('Comments')} →
        </Link>
        <Link className="text-primary hover:underline" to="/leads">
          {t('Leads')} →
        </Link>
        <Link className="text-primary hover:underline" to="/accounts/acc-ekoindia">
          {t('Account status')} →
        </Link>
      </span>
    </section>
  );
}
