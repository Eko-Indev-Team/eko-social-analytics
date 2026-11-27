import { Link } from 'react-router-dom';
import { AiBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { useToast } from '@/components/ui/Toast';
import { useT } from '@/i18n/I18nContext';
import { cn, formatPercent } from '@/lib/format';
import { rankOf, type AnalyticsPageData } from './model';
import { UnavailableSection } from './SectionCard';

const toneCls = { positive: 'text-emerald-300', neutral: 'text-text-primary', primary: 'text-primary' } as const;

/** AI review of the post: score tiles and one recommendation. */
export function PerformanceAuditCard({ data }: { data: AnalyticsPageData }) {
  const t = useT();
  const toast = useToast();
  const audit = data.analytics?.audit;
  if (!audit) return <UnavailableSection title={t('AI review')} className="mb-8" />;
  const { item, allContent } = data;

  const derived = (d: 'engagementRate' | 'leadsRank' | undefined) =>
    d === 'engagementRate'
      ? { detail: `(${formatPercent(item.metrics.engagementRate)})` }
      : d === 'leadsRank'
        ? { footnote: t('{count} leads (#{rank})', { count: item.metrics.leads, rank: rankOf(item, allContent, 'leads') }) }
        : {};

  return (
    <section className="bg-surface-card rounded-xl border border-border-strong p-5 mb-8 shadow-card" aria-labelledby="content-review-title">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="content-review-title" className="font-heading text-[1.0625rem] font-semibold text-text-primary">
              {t('AI review')}
            </h2>
            <AiBadge />
            <InfoTip text={t('Written by AI from sample data. Check before you act on it.')} />
          </div>
          <p className="text-body-sm text-text-secondary">{audit.benchmarkNote}</p>
        </div>
        <span className="text-label-sm text-text-secondary">{t('Confidence: {pct}%', { pct: audit.confidencePct })}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {audit.scores.map((s) => {
          const d = derived(s.derive);
          const detail = d.detail ?? s.detail;
          return (
            <div key={s.label} className="p-3 bg-surface-canvas rounded-xl">
              <div className="text-label-sm text-text-secondary mb-1">{s.label}</div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={cn('font-heading text-[1.25rem] font-bold', toneCls[s.tone])}>{s.value}</span>
                {detail && <span className={cn('text-label-sm font-semibold', s.tone === 'positive' ? 'text-emerald-300' : 'text-text-secondary')}>{detail}</span>}
              </div>
              <div className={cn('text-[0.75rem] mt-1', d.footnote ? 'text-text-primary font-semibold' : 'text-text-tertiary')}>{d.footnote ?? s.footnote}</div>
            </div>
          );
        })}
      </div>
      <div className="p-4 bg-surface-canvas border border-primary-container/40 rounded-xl flex flex-col sm:flex-row items-start gap-3.5">
        <Icon name="lightbulb" className="text-primary mt-0.5" />
        <div className="flex-1">
          <div className="text-label-md font-bold text-text-primary mb-1">{audit.recommendation.title}</div>
          <p className="text-body-sm text-text-secondary leading-relaxed">{audit.recommendation.body}</p>
          <ol className="mt-2 space-y-0.5 text-body-sm list-decimal list-inside text-text-primary font-semibold">
            {audit.recommendation.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ol>
        </div>
        <button
          type="button"
          onClick={() => toast({ tone: 'demo', title: t('Needs the server'), description: t('AI scripts are made on the SocialBoard server, which is not connected here.') })}
          className="px-4 py-1.5 bg-primary-container hover:bg-brand-primary-hover text-on-primary-container font-bold text-label-sm rounded-full shrink-0 transition-colors"
        >
          {t('Write a script')}
        </button>
      </div>
    </section>
  );
}

/** Links to related pages at the bottom. */
export function ReelFooterNav({ data }: { data: AnalyticsPageData }) {
  const t = useT();
  const { campaign, item } = data;
  const linkCls = 'text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1';
  return (
    <footer className="mt-8 pt-5 pb-10 border-t border-border-subtle flex flex-col md:flex-row items-center justify-between gap-4 text-label-md text-text-secondary">
      <Link to="/content" className="inline-flex items-center gap-2 hover:text-text-primary transition-colors font-medium">
        <Icon name="arrow_back" className="text-[0.875rem]" />
        <span>{t('Back to Content')}</span>
      </Link>
      <nav aria-label={t('Related pages')} className="flex flex-wrap items-center justify-center gap-5 text-label-sm">
        {campaign && (
          <Link to={`/campaigns/${campaign.id}`} className={linkCls}>
            {t('Campaign')}
            <Icon name="arrow_forward" className="text-[0.75rem]" />
          </Link>
        )}
        <Link to="/audience" className={linkCls}>
          {t('Audience')}
          <Icon name="arrow_forward" className="text-[0.75rem]" />
        </Link>
        <Link to="/comments" className={linkCls}>
          {t('Comments')}
          <Icon name="arrow_forward" className="text-[0.75rem]" />
        </Link>
        <Link to="/leads" className="text-primary hover:underline transition-colors flex items-center gap-1 font-semibold">
          {t('Leads ({count})', { count: item.metrics.leads })}
          <Icon name="arrow_forward" className="text-[0.75rem]" />
        </Link>
      </nav>
    </footer>
  );
}
