import { Link } from 'react-router-dom';
import { AiBadge, LeadStatusBadge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback, ProgressBar } from '@/components/ui/Misc';
import { Drawer } from '@/components/ui/Overlay';
import { useQuery } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { formatCompact, formatDate, formatNumber, formatPercent } from '@/lib/format';
import { campaignService } from '@/services/campaigns';
import { leadService } from '@/services/leads';
import type { ContentItem } from '@/types/domain';
import { contentMediaLabel, contentTypeIcon, contentTypeLabel } from './selectors';

/** Content quick view, opened from "Best posts" on the dashboard. */
export function ContentQuickViewDrawer({ item, onClose }: { item: ContentItem | null; onClose: () => void }) {
  const t = useT();
  return (
    <Drawer
      open={item !== null}
      onClose={onClose}
      width="w-full sm:max-w-md"
      title={
        <span className="flex items-center gap-2">
          <Icon name={item ? contentTypeIcon(item.type) : 'movie'} className="text-primary-container" />
          {item?.type === 'reel' ? t('Reel details') : t('Post details')}
        </span>
      }
      footer={
        item && (
          <>
            <LinkButton to={`/leads?content=${item.id}`} variant="secondary" size="sm" className="flex-1 sm:flex-none">
              {t('See leads')}
            </LinkButton>
            <LinkButton to={`/content/${item.id}`} variant="primary" size="sm" iconRight="arrow_forward" className="flex-1 sm:flex-none">
              {t('Open full details')}
            </LinkButton>
          </>
        )
      }
    >
      {item && <QuickViewBody item={item} />}
    </Drawer>
  );
}

const smallStats = [
  { key: 'reach', label: msg('Reach') },
  { key: 'likes', label: msg('Likes') },
  { key: 'comments', label: msg('Comments') },
  { key: 'shares', label: msg('Shares') },
] as const;

function QuickViewBody({ item }: { item: ContentItem }) {
  const t = useT();
  const campaigns = useQuery('campaigns:list', campaignService.list);
  const leads = useQuery('leads:list', leadService.list);
  const campaign = campaigns.data?.find((c) => c.id === item.campaignId);
  const attributed = (leads.data ?? []).filter((l) => l.contentId === item.id).sort((a, b) => b.score - a.score);
  const m = item.metrics;

  return (
    <div className="space-y-5">
      <div>
        <div className="h-44 rounded-xl bg-slate-800 overflow-hidden relative mb-3">
          <ImageWithFallback src={item.thumbnailUrl} alt={item.thumbnailAlt} className="w-full h-full" />
          <span className="absolute bottom-2 left-2 bg-navy/80 text-white text-[0.625rem] font-bold px-2 py-0.5 rounded-full">{contentMediaLabel(item, t)}</span>
        </div>
        <h3 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{item.title}</h3>
        <span className="text-xs text-text-tertiary">
          {t(contentTypeLabel(item.type))} · {t('Posted {date}', { date: formatDate(item.publishedAt) })}
          {campaign && (
            <>
              {' · '}
              <Link to={`/campaigns/${campaign.id}`} className="hover:text-text-primary hover:underline">
                {campaign.name}
              </Link>
            </>
          )}
          {!item.campaignId && ` · ${t('No campaign')}`}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2.5 rounded-xl bg-surface-canvas border border-border-strong">
          <span className="text-text-tertiary text-[0.6875rem] block">{t('Views')}</span>
          <span className="font-bold text-text-primary tnum">{formatNumber(m.views)}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-surface-canvas border border-border-strong">
          <span className="text-text-tertiary text-[0.6875rem] block">{t('Engagement')}</span>
          <span className="font-bold text-status-active tnum">{formatPercent(m.engagementRate, 1)}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-surface-canvas border border-primary-container">
          <span className="text-primary text-[0.6875rem] font-bold block">{t('Leads')}</span>
          <span className="font-bold text-text-primary tnum">{formatNumber(m.leads)}</span>
        </div>
      </div>

      <dl className="grid grid-cols-4 gap-2 text-center text-[0.6875rem]">
        {smallStats.map(({ key, label }) => (
          <div key={key} className="py-1.5">
            <dt className="text-text-tertiary text-[0.625rem]">{t(label)}</dt>
            <dd className="font-semibold text-text-primary tnum">{formatCompact(m[key])}</dd>
          </div>
        ))}
      </dl>

      {m.retention !== undefined && (
        <div className="p-3.5 rounded-xl bg-surface-canvas border border-border-strong">
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="font-bold text-text-primary">{t('Watched to the end')}</span>
            <span className="text-status-active font-bold tnum">{formatPercent(m.retention, 1)}</span>
          </div>
          <ProgressBar value={m.retention} label={t('Watched to the end')} className="h-2" />
        </div>
      )}

      <div>
        <h4 className="font-bold text-xs text-text-primary mb-1.5">{t('Caption')}</h4>
        <p className="text-xs text-text-secondary bg-surface-canvas rounded-xl p-2.5 whitespace-pre-line">{item.caption}</p>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h4 className="font-bold text-xs text-text-primary">{t('Leads from this post')}</h4>
          <AiBadge label={msg('Scored by AI')} />
        </div>
        {leads.status === 'loading' ? (
          <p className="text-xs text-text-tertiary">{t('Loading…')}</p>
        ) : attributed.length === 0 ? (
          <p className="text-xs text-text-tertiary">{t('No leads from this post yet.')}</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {attributed.slice(0, 3).map((l) => (
              <li key={l.id}>
                <Link to={`/leads?lead=${l.id}`} className="block p-2.5 rounded-xl bg-surface-canvas border border-border-subtle hover:border-primary-container transition-colors">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-bold text-text-primary">@{l.handle}</span>
                    <LeadStatusBadge status={l.status} />
                  </span>
                  <span className="block text-text-secondary mt-0.5 line-clamp-2">“{l.firstMessage}”</span>
                  <span className="block mt-1 text-[0.625rem] text-primary font-bold tnum">{t('AI score {score}/100', { score: l.score })}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
