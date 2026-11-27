import { useState, type ReactNode } from 'react';
import { SearchInput } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { msg, useT } from '@/i18n/I18nContext';
import { cn, formatNumber } from '@/lib/format';
import type { CommentSummary } from '@/types/comments';
import type { Campaign, ContentItem, InstagramAccount } from '@/types/domain';
import { defaultFilters, intentMeta, pct, presets, type CommentFilters, type PresetKey } from './commentMeta';

const selectCls = 'w-full h-9 text-label-md bg-slate-950 border border-slate-700 rounded-lg text-text-primary px-2.5 pr-7 focus:outline-none focus:border-border-focused cursor-pointer';

function FilterField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-label-sm text-text-secondary mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

const intentOrder = ['application', 'eligibility', 'product', 'information', 'feedback', 'complaint', 'other'] as const;

const presetLabels: Record<PresetKey, string> = {
  'high-leads': msg('Likely leads ({count})'),
  complaints: msg('Complaints ({count})'),
  awaiting: msg('Need a reply ({count})'),
};

/** Search + Sentiment + Status always visible; the other filters open with "Filters". Quick presets underneath. */
export function CommentFilterBar({
  filters,
  onChange,
  summary,
  campaigns,
  content,
  accounts,
  matching,
  sampleSize,
}: {
  filters: CommentFilters;
  onChange: (next: CommentFilters) => void;
  summary: CommentSummary;
  campaigns: Campaign[];
  content: ContentItem[];
  accounts: InstagramAccount[];
  matching: number;
  sampleSize: number;
}) {
  const t = useT();
  const set = <K extends keyof CommentFilters>(key: K, value: CommentFilters[K]) => onChange({ ...filters, [key]: value });
  const total = summary.totalComments;
  const commentCampaigns = campaigns.filter((c) => (c.metrics?.comments ?? 0) > 0);
  const contentOptions = content.filter((c) => c.metrics.comments > 0 && (filters.campaignId === 'all' || c.campaignId === filters.campaignId));
  const complaints = summary.intents.find((i) => i.intent === 'complaint')?.comments ?? 0;

  const moreActive = (['accountId', 'period', 'campaignId', 'contentId', 'intent', 'potential'] as const).filter((k) => filters[k] !== defaultFilters[k]).length;
  const [open, setOpen] = useState(moreActive > 0);
  const showMore = open || moreActive > 0;

  const presetActive = (key: PresetKey) => Object.entries(presets[key]).every(([k, v]) => filters[k as keyof CommentFilters] === v);
  const applyPreset = (key: PresetKey) => onChange(presetActive(key) ? { ...defaultFilters, search: filters.search } : { ...defaultFilters, search: filters.search, ...presets[key] });
  const presetCounts: Record<PresetKey, number> = { 'high-leads': summary.potentialLeads, complaints, awaiting: summary.needsResponse };

  return (
    <div className="bg-surface-card border border-border-strong rounded-xl shadow-card p-4 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[14rem]">
          <label htmlFor="comment-keyword" className="block text-label-sm text-text-secondary mb-1">
            {t('Search')}
          </label>
          <SearchInput id="comment-keyword" type="search" value={filters.search} onChange={(e) => set('search', e.target.value)} placeholder={t('Search name or text…')} />
        </div>
        <div className="w-40">
          <FilterField id="cf-sentiment" label={t('Sentiment')}>
            <select id="cf-sentiment" className={selectCls} value={filters.sentiment} onChange={(e) => set('sentiment', e.target.value as CommentFilters['sentiment'])}>
              <option value="all">{t('All')}</option>
              <option value="positive">{t('Positive ({pct})', { pct: pct(summary.sentiment.positive, total) })}</option>
              <option value="neutral">{t('Neutral ({pct})', { pct: pct(summary.sentiment.neutral, total) })}</option>
              <option value="negative">{t('Negative ({pct})', { pct: pct(summary.sentiment.negative, total) })}</option>
            </select>
          </FilterField>
        </div>
        <div className="w-44">
          <FilterField id="cf-status" label={t('Response status')}>
            <select id="cf-status" className={selectCls} value={filters.status} onChange={(e) => set('status', e.target.value as CommentFilters['status'])}>
              <option value="open">{t('All open')}</option>
              <option value="needs_response">{t('Needs a reply ({count})', { count: formatNumber(summary.needsResponse) })}</option>
              <option value="reviewed">{t('Reviewed')}</option>
              <option value="responded">{t('Replied ({count})', { count: formatNumber(summary.responded) })}</option>
              <option value="resolved">{t('Resolved ({count})', { count: formatNumber(summary.resolved) })}</option>
              <option value="lead_created">{t('Lead created')}</option>
              <option value="archived">{t('Archived')}</option>
            </select>
          </FilterField>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={showMore}
          aria-controls="comment-more-filters"
          className={cn(
            'h-9 px-3.5 rounded-full border text-label-md font-semibold flex items-center gap-1.5 transition-colors',
            moreActive > 0 ? 'border-primary-container text-primary' : 'border-border-strong text-text-primary hover:bg-surface-canvas',
          )}
        >
          <Icon name="tune" className="text-[1rem]" />
          {moreActive > 0 ? t('Filters ({count})', { count: moreActive }) : t('Filters')}
        </button>
      </div>

      {showMore && (
        <div id="comment-more-filters" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <FilterField id="cf-account" label={t('Account')}>
            <select id="cf-account" className={selectCls} value={filters.accountId} onChange={(e) => set('accountId', e.target.value)}>
              <option value="all">{t('All accounts')}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.isPrimary ? t('@{handle} (main)', { handle: a.handle }) : `@${a.handle}`}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField id="cf-period" label={t('Date')}>
            <select id="cf-period" className={selectCls} value={filters.period} onChange={(e) => set('period', e.target.value as CommentFilters['period'])}>
              <option value="all">{t('Oct 1–31, 2024')}</option>
              <option value="7d">{t('Last 7 days')}</option>
              <option value="24h">{t('Last 24 hours')}</option>
            </select>
          </FilterField>
          <FilterField id="cf-campaign" label={t('Campaign')}>
            <select id="cf-campaign" className={selectCls} value={filters.campaignId} onChange={(e) => onChange({ ...filters, campaignId: e.target.value, contentId: 'all' })}>
              <option value="all">{t('All campaigns')}</option>
              {commentCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField id="cf-content" label={t('Post')}>
            <select id="cf-content" className={selectCls} value={filters.contentId} onChange={(e) => set('contentId', e.target.value)}>
              <option value="all">{t('All posts')}</option>
              {contentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField id="cf-intent" label={t('Topic')}>
            <select id="cf-intent" className={selectCls} value={filters.intent} onChange={(e) => set('intent', e.target.value as CommentFilters['intent'])}>
              <option value="all">{t('All topics')}</option>
              {intentOrder.map((i) => (
                <option key={i} value={i}>
                  {t(intentMeta[i].label)}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField id="cf-potential" label={t('Lead chance')}>
            <select id="cf-potential" className={selectCls} value={filters.potential} onChange={(e) => set('potential', e.target.value as CommentFilters['potential'])}>
              <option value="all">{t('All')}</option>
              <option value="high">{t('High')}</option>
              <option value="medium">{t('Medium')}</option>
              <option value="low">{t('Low')}</option>
            </select>
          </FilterField>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 text-label-md">
        <div className="flex items-center gap-2 flex-wrap">
          {(Object.keys(presetLabels) as PresetKey[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={presetActive(key)}
              onClick={() => applyPreset(key)}
              className={cn(
                'px-3 py-1 rounded-full text-label-sm border transition-colors',
                presetActive(key)
                  ? 'bg-primary-container/20 text-primary font-semibold border-primary-container/40'
                  : 'bg-surface-card text-text-secondary hover:text-text-primary border-border-strong',
              )}
            >
              {t(presetLabels[key], { count: formatNumber(presetCounts[key]) })}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-text-tertiary flex-wrap">
          <span className="tnum">{t('{matching} of {sample} shown', { matching, sample: sampleSize })}</span>
          <button type="button" onClick={() => onChange(defaultFilters)} className="text-primary hover:underline font-semibold">
            {t('Reset')}
          </button>
        </div>
      </div>
    </div>
  );
}
