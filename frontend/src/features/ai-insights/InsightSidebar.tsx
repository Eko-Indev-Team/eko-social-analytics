import { Link } from 'react-router-dom';
import { CampaignStatusBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback } from '@/components/ui/Misc';
import { msg, useT } from '@/i18n/I18nContext';
import { cn, formatCompact } from '@/lib/format';
import type { InstagramComment } from '@/types/comments';
import type { Campaign, ContentItem } from '@/types/domain';
import type { Insight } from '@/types/insights';
import { intentMeta } from '@/features/comments/commentMeta';
import { insightStatusMeta } from './insightMeta';

type Funnel = { new: number; contacted: number; qualified: number; converted: number };
const funnelLabels: Record<keyof Funnel, string> = { new: msg('New'), contacted: msg('Contacted'), qualified: msg('Qualified'), converted: msg('Converted') };

/** Column 3: associated artifacts (campaign, media, comparison asset, lead funnel). */
export function ArtifactsCard({
  insight,
  campaign,
  primary,
  comparison,
  funnel,
}: {
  insight: Insight;
  campaign: Campaign | undefined;
  primary: ContentItem | undefined;
  comparison: ContentItem | undefined;
  funnel: Funnel | null | undefined;
}) {
  const t = useT();
  const a = insight.detail?.artifacts;
  const linked = [campaign, primary, comparison, funnel].filter(Boolean).length;
  const funnelTotal = funnel ? funnel.new + funnel.contacted + funnel.qualified + funnel.converted : 0;
  return (
    <div className="bg-surface-card border border-border-strong rounded-xl shadow-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('Related')}</h3>
        <span className="text-body-sm text-text-tertiary tnum">{linked}</span>
      </div>
      {linked === 0 && (
        <p className="text-body-sm text-text-secondary flex items-start gap-2">
          <Icon name="science" className="text-[1rem] text-text-tertiary" />
          {t('Nothing linked to this insight in the sample data.')}
        </p>
      )}
      {campaign && (
        <div className="space-y-1">
          <span className="text-[0.75rem] font-semibold text-text-secondary">{t('Campaign')}</span>
          <div className="p-2.5 rounded border border-border-strong bg-surface-canvas">
            <Link to={`/campaigns/${campaign.id}`} className="font-label-md text-label-md font-bold text-text-primary hover:underline flex items-center gap-1">
              {campaign.name}
              <Icon name="open_in_new" className="text-[0.875rem]" />
            </Link>
            <div className="flex items-center gap-2 mt-1">
              <CampaignStatusBadge status={campaign.status} />
              {campaign.metrics && <span className="text-xs text-text-tertiary tnum">{t('{count} views', { count: formatCompact(campaign.metrics.views) })}</span>}
            </div>
          </div>
        </div>
      )}
      {primary && (
        <div className="space-y-1">
          <span className="text-[0.75rem] font-semibold text-text-secondary">{primary.type === 'reel' ? t('Main reel') : t('Main post')}</span>
          <div className="border border-border-strong rounded bg-surface-canvas overflow-hidden">
            <Link to={`/content/${primary.id}`} className="relative h-36 bg-slate-900 flex items-center justify-center group overflow-hidden" aria-label={t('Open numbers for {title}', { title: primary.title })}>
              <ImageWithFallback
                src={a?.primaryMediaUrl ?? primary.thumbnailUrl}
                alt={a?.primaryMediaAlt ?? primary.thumbnailAlt}
                className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-navy/40" />
              {primary.type === 'reel' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Icon name="play_arrow" filled className="text-[1.5rem]" />
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-xs text-white">
                {primary.durationSec ? <span className="bg-navy/60 px-1.5 py-0.5 rounded font-mono text-[0.6875rem]">0:{String(primary.durationSec).padStart(2, '0')}s</span> : <span />}
                <span className="bg-navy/60 px-1.5 py-0.5 rounded text-[0.6875rem] capitalize">{primary.type === 'reel' ? t('Reel') : primary.type}</span>
              </div>
            </Link>
            <div className="p-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-label-md text-label-md font-semibold text-text-primary block truncate">{primary.title}</span>

              </div>
              <Link to={`/content/${primary.id}`} className="text-xs text-primary font-bold hover:underline flex items-center shrink-0">
                {t('Numbers')} <Icon name="chevron_right" className="text-[0.875rem]" />
              </Link>
            </div>
          </div>
        </div>
      )}
      {comparison && (
        <div className="space-y-1">
          <span className="text-[0.75rem] font-semibold text-text-secondary">{t('Compared with')}</span>
          <div className="p-2.5 rounded border border-border-strong bg-surface-canvas flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-label-md text-label-md font-semibold text-text-primary block truncate">{comparison.title}</span>
              <span className="text-xs text-text-secondary">
                {comparison.type === 'carousel' ? t('Carousel · {count} slides', { count: comparison.slides ?? 0 }) : `${comparison.type[0].toUpperCase()}${comparison.type.slice(1)}`}
              </span>
            </div>
            <Link to={`/content/${comparison.id}`} className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-0.5 shrink-0">
              <span>{t('View')}</span>
              <Icon name="open_in_new" className="text-[0.875rem]" />
            </Link>
          </div>
        </div>
      )}
      {funnel && (
        <div className="space-y-2 pt-1 border-t border-border-strong">
          <div className="flex items-center justify-between pt-2">
            <span className="text-[0.75rem] font-semibold text-text-secondary">{t('Campaign leads: {count}', { count: funnelTotal })}</span>
            <Link to="/leads" className="text-[0.75rem] text-primary font-bold hover:underline">
              {t('Leads')} →
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {(['new', 'contacted', 'qualified', 'converted'] as const).map((k) => (
              <div key={k} className={cn('p-1.5 rounded border', k === 'converted' ? 'bg-emerald-900/40 border-status-active' : 'bg-surface-canvas border-border-strong')}>
                <div className={cn('font-bold text-sm tnum', k === 'converted' ? 'text-status-active' : 'text-text-primary')}>{funnel[k]}</div>
                <div className={cn('text-[0.625rem]', k === 'converted' ? 'text-status-active font-bold' : 'text-text-secondary font-semibold')}>{t(funnelLabels[k])}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const intentTagCls: Record<string, string> = {
  application: 'bg-status-active-subtle text-status-active border-emerald-800',
  eligibility: 'bg-sky-900/40 text-tertiary border-sky-800',
  product: 'bg-status-active-subtle text-status-active border-emerald-800',
  complaint: 'bg-rose-900/40 text-error border-rose-800',
};

/** Verbatim comments cited as evidence (read from the Comments Intelligence store). */
export function CommentEvidenceCard({ comments, contentTitle }: { comments: InstagramComment[]; contentTitle: (id: string) => string }) {
  const t = useT();
  return (
    <div className="bg-surface-card border border-border-strong rounded-xl shadow-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon name="chat" className="text-[1.125rem] text-text-secondary" />
          <h3 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('Example comments')}</h3>
        </div>
        <span className="text-body-sm text-text-tertiary tnum">{comments.length}</span>
      </div>
      {comments.length === 0 ? (
        <p className="text-body-sm text-text-secondary flex items-start gap-2">
          <Icon name="science" className="text-[1rem] text-text-tertiary" />
          {t('No example comments in the sample data.')}
        </p>
      ) : (
        <>
          <p className="text-body-sm text-text-secondary">{t('Real comments, tagged by what the person wants.')}</p>
          <ul className="space-y-2.5">
            {comments.map((c) => (
              <li key={c.id} className="p-3 rounded-lg bg-surface-canvas space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-label-sm text-label-sm font-bold text-text-primary truncate">{c.authorName}</span>
                  <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[0.625rem] font-bold border whitespace-nowrap', intentTagCls[c.intent] ?? 'bg-surface-card-subtle text-text-secondary border-border-strong')}>
                    {t(intentMeta[c.intent].label)}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-text-primary italic">"{c.text}"</p>
                <div className="text-[0.6875rem] text-text-tertiary">
                  {t('On {post} · {when}', { post: contentTitle(c.contentId), when: c.receivedLabel })}
                </div>
              </li>
            ))}
          </ul>
          <Link to="/comments" className="text-label-sm font-label-sm text-primary font-bold hover:underline inline-flex items-center gap-1">
            {t('Open comments')} <Icon name="arrow_forward" className="text-[0.875rem]" />
          </Link>
        </>
      )}
    </div>
  );
}

const lifecycle = {
  new: { label: msg('Waiting for your team'), cls: 'text-status-paused', dot: 'bg-status-paused' },
  reviewed: { label: msg('Reviewed'), cls: 'text-status-active', dot: 'bg-status-active' },
  saved: { label: msg('Saved for later'), cls: 'text-sky-300', dot: 'bg-sky-500' },
  completed: { label: msg('Action completed'), cls: 'text-status-active', dot: 'bg-status-active' },
  dismissed: { label: msg('Dismissed'), cls: 'text-text-secondary', dot: 'bg-text-tertiary' },
} as const;

export function AuditCard({ insight }: { insight: Insight }) {
  const t = useT();
  const audit = insight.detail?.audit;
  const l = lifecycle[insight.status];
  const steps = insight.detail?.steps?.length ?? 0;
  return (
    <div className="bg-surface-card border border-border-strong rounded-xl shadow-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('History')}</h3>
        <Icon name="history" className="text-[1rem] text-text-tertiary" />
      </div>
      <dl className="space-y-2.5 font-body-sm text-body-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-text-secondary">{t('Status')}</dt>
          <dd className={cn('inline-flex items-center gap-1 font-semibold', l.cls)}>
            <span className={cn('w-2 h-2 rounded-full', l.dot)} />
            {t(l.label)}
            <span className="sr-only">({t(insightStatusMeta[insight.status].label)})</span>
          </dd>
        </div>
        {steps > 0 && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-text-secondary">{t('Steps done')}</dt>
            <dd className="font-semibold text-text-primary tnum">{t('{done} of {total}', { done: insight.completedStepIds.length, total: steps })}</dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <dt className="text-text-secondary">{t('Owner')}</dt>
          <dd className="font-semibold text-text-primary text-right">{audit?.operator ?? '—'}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-text-secondary">{t('Source')}</dt>
          <dd className="text-xs text-text-secondary text-right">{audit?.trigger ?? t('Sample data')}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-text-secondary">{t('Model')}</dt>
          <dd className="text-xs text-text-secondary text-right">{audit?.modelVersion ?? '—'}</dd>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border-strong text-xs text-text-tertiary">
          <dt>{t('Last checked')}</dt>
          <dd>{audit?.lastCheck ?? insight.generatedAt}</dd>
        </div>
      </dl>
    </div>
  );
}
