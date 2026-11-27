import { Link } from 'react-router-dom';
import { CampaignStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { ImageWithFallback } from '@/components/ui/Misc';
import { Drawer } from '@/components/ui/Overlay';
import { Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { cn, formatCompact, formatDate, formatDelta, formatNumber, formatPercent } from '@/lib/format';
import { campaignService } from '@/services/campaigns';
import { contentService } from '@/services/content';
import type { Campaign, ContentItem } from '@/types/domain';
import { campaignDurationLabel, OBJECTIVE_LABEL, pctDelta } from './campaignUtils';

const TYPE_LABEL: Record<ContentItem['type'], string> = { reel: msg('Reel'), carousel: msg('Carousel'), story: msg('Story'), post: msg('Post') };

/** Quick look at one campaign from the list: two numbers, the AI tip and the two best posts. */
export function CampaignQuickViewDrawer({
  campaign,
  onClose,
  onEdit,
  onDuplicate,
  duplicatePending,
}: {
  campaign: Campaign | null;
  onClose: () => void;
  onEdit: (c: Campaign) => void;
  onDuplicate: (c: Campaign) => void;
  duplicatePending?: boolean;
}) {
  const t = useT();
  if (!campaign) return null;
  return (
    <Drawer
      open
      onClose={onClose}
      width="w-full sm:w-96"
      title={campaign.name}
      subtitle={`${campaign.code} · ${t(OBJECTIVE_LABEL[campaign.objective])} · ${campaignDurationLabel(campaign, t)}`}
      headerExtra={
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <CampaignStatusBadge status={campaign.status} />
          <Link to={`/campaigns/${campaign.id}`} className="inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">
            {t('Open campaign')} <Icon name="arrow_forward" className="text-[0.875rem]" />
          </Link>
        </div>
      }
      footer={
        <div className="w-full flex items-center gap-2">
          <Button variant="primary" className="flex-1" onClick={() => onEdit(campaign)} icon="edit">
            {t('Edit')}
          </Button>
          <Button onClick={() => onDuplicate(campaign)} loading={duplicatePending} icon="content_copy">
            {t('Copy as draft')}
          </Button>
        </div>
      }
    >
      <QuickViewBody campaign={campaign} />
    </Drawer>
  );
}

function QuickViewBody({ campaign }: { campaign: Campaign }) {
  const t = useT();
  const contentQ = useQuery(`content:campaign:${campaign.id}`, () => contentService.listByCampaign(campaign.id));
  const extrasQ = useQuery(`campaigns:extras:${campaign.id}`, () => campaignService.detail(campaign.id));
  const m = campaign.metrics;
  const reachDelta = pctDelta(m?.reach, campaign.baseline?.reach);
  const top = [...(contentQ.data ?? [])].sort((a, b) => b.metrics.views - a.metrics.views).slice(0, 2);
  const recommendation = extrasQ.data?.quickViewRecommendation;

  return (
    <div className="space-y-5">
      {m ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl border border-border-strong bg-surface-card">
            <span className="text-body-sm text-text-secondary">{t('People reached')}</span>
            <div className="font-heading text-[1.5rem] font-bold text-text-primary mt-1 tnum">{formatCompact(m.reach)}</div>
            <span className={cn('text-xs font-semibold', reachDelta === undefined ? 'text-text-secondary' : reachDelta >= 0 ? 'text-status-active' : 'text-error')}>
              {reachDelta === undefined ? t('Views: {count}', { count: formatCompact(m.views) }) : t('{change} vs last month', { change: formatDelta(reachDelta) })}
            </span>
          </div>
          <div className="p-4 rounded-xl border border-primary-container bg-surface-card">
            <span className="text-body-sm text-text-secondary">{t('Leads')}</span>
            <div className="font-heading text-[1.5rem] font-bold text-text-primary mt-1 tnum">{formatNumber(m.leads)}</div>
            <span className="text-xs text-text-secondary font-semibold">{t('{rate} became leads', { rate: formatPercent(m.conversionRate, 1) })}</span>
          </div>
        </div>
      ) : (
        <p className="text-body-sm text-text-secondary p-4 rounded-xl bg-surface-canvas flex items-start gap-2">
          <Icon name="schedule" className="text-[1.125rem] text-text-tertiary" />
          {campaign.startDate ? t('Numbers show up after it starts on {date}.', { date: formatDate(campaign.startDate) }) : t('Numbers show up after it starts.')}
        </p>
      )}

      {extrasQ.status === 'loading' ? (
        <Skeleton className="h-20" />
      ) : (
        recommendation && (
          <div className="p-4 rounded-xl bg-ai-subtle border border-ai-border space-y-1.5">
            <div className="flex items-center gap-1.5 text-ai-accent font-semibold text-label-md">
              <Icon name="auto_awesome" className="text-[1rem]" />
              <span>{t('AI tip')}</span>
              <InfoTip text={t('Written by AI from sample data. Check before you act on it.')} className="ml-auto" />
            </div>
            <p className="text-body-sm text-text-secondary">{recommendation}</p>
          </div>
        )
      )}

      <div className="space-y-2">
        <h3 className="text-label-md text-text-primary font-semibold">{t('Best posts')}</h3>
        {contentQ.status === 'loading' ? (
          <div className="space-y-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : top.length === 0 ? (
          <p className="text-body-sm text-text-secondary p-3 rounded-xl border border-dashed border-border-strong">{t('No posts linked to this campaign yet.')}</p>
        ) : (
          <div className="space-y-2">
            {top.map((item) => (
              <Link key={item.id} to={`/content/${item.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-canvas transition-colors">
                <div className="h-11 w-11 rounded-lg bg-slate-800 shrink-0 overflow-hidden">
                  <ImageWithFallback src={item.thumbnailUrl} alt={item.thumbnailAlt} className="h-full w-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-body-sm font-semibold text-text-primary truncate">{item.title}</div>
                  <div className="text-[0.75rem] text-text-secondary tnum">
                    {t(TYPE_LABEL[item.type])} · {t('Views: {count}', { count: formatCompact(item.metrics.views) })}
                  </div>
                </div>
                <Icon name="chevron_right" className="text-[1rem] text-text-tertiary" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
