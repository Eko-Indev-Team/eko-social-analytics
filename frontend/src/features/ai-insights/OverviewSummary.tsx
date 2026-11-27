import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AiBadge } from '@/components/ui/Badge';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { KpiCard } from '@/components/ui/KpiCard';
import { useToast } from '@/components/ui/Toast';
import { msg, useT } from '@/i18n/I18nContext';
import { cn, formatNumber } from '@/lib/format';
import type { InsightsOverview, RecommendedAction } from '@/types/insights';
import { RichText, stripMarkup } from './insightMeta';

/** Four headline numbers. Action counts come from the recommended-actions store. */
export function InsightKpiTiles({ overview, actions }: { overview: InsightsOverview; actions: RecommendedAction[] }) {
  const t = useT();
  const open = actions.filter((a) => a.status === 'pending_review' || a.status === 'reviewed');
  const high = open.filter((a) => a.priority === 'high').length;
  const k = overview.kpis;
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label={msg('Actions to do')} icon="checklist" value={open.length} footnote={t('{count} high priority', { count: high })} highlight />
      <KpiCard label={msg('Campaigns checked')} icon="campaign" tone="teal" value={k.synthesizedCampaigns} />
      <KpiCard label={msg('Lead signals')} icon="person_search" tone="success" value={formatNumber(k.leadSignals)} hint={msg('Comments that AI thinks show interest. An estimate.')} />
      <KpiCard label={msg('AI confidence')} icon="auto_awesome" tone="ai" value={`${k.modelConfidence}%`} hint={msg('How sure the AI is about these insights.')} />
    </section>
  );
}

function Block({ icon, iconClass, label, children, className }: { icon: string; iconClass: string; label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 text-body-sm font-semibold text-text-secondary mb-1.5">
        <Icon name={icon} className={cn('text-[1rem]', iconClass)} />
        {label}
      </div>
      <p className="text-body-md text-text-primary leading-relaxed">{children}</p>
    </div>
  );
}

/** AI summary card: overall, what went well, what needs attention, and the one thing to do next. */
export function ExecutiveSynthesis({ overview, onRegenerate, topInsightId }: { overview: InsightsOverview; onRegenerate: () => void; topInsightId: string }) {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const e = overview.executive;

  const copy = async () => {
    const text = [
      t('AI summary ({period}). Made by AI from sample data.', { period: overview.periodLabel }),
      e.overall,
      e.positive,
      e.concern,
      t('Do this next: {action}', { action: e.recommendation }),
    ]
      .map(stripMarkup)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      toast({ tone: 'success', title: t('Summary copied') });
    } catch {
      toast({ tone: 'error', title: t('Could not copy'), description: t('This browser does not allow copying.') });
    }
  };

  return (
    <section className="bg-surface-card border border-border-strong rounded-xl shadow-card p-5 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('AI summary')}</h2>
            <AiBadge />
            <InfoTip text={overview.disclaimer} />
          </div>
          <p className="text-body-sm text-text-secondary">{overview.periodLabel}</p>
        </div>
        <Dropdown
          label={t('More')}
          trigger={({ toggle, open }) => (
            <button type="button" onClick={toggle} aria-expanded={open} aria-label={t('More')} className="text-text-secondary hover:text-text-primary p-1 rounded-lg">
              <Icon name="more_horiz" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon="content_copy" onClick={() => (close(), copy())}>
                {t('Copy summary')}
              </MenuItem>
              <MenuItem icon="auto_awesome" onClick={() => (close(), navigate(`/ai-insights/${topInsightId}`))}>
                {t('Open top insight')}
              </MenuItem>
              <MenuItem icon="refresh" onClick={() => (close(), onRegenerate())}>
                {t('Generate insights')}
              </MenuItem>
            </>
          )}
        </Dropdown>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-5">
          <Block icon="insights" iconClass="text-primary-container" label={t('Overall')}>
            <RichText text={e.overall} />
          </Block>
          <Block icon="check_circle" iconClass="text-status-active" label={t('What went well')}>
            <RichText text={e.positive} />
          </Block>
        </div>
        <div className="space-y-5">
          <Block icon="warning" iconClass="text-error" label={t('What needs attention')}>
            <RichText text={e.concern} />
          </Block>
          <Block icon="lightbulb" iconClass="text-primary-container" label={t('Do this next')} className="bg-primary-container/10 rounded-xl p-4">
            {e.recommendation}
          </Block>
        </div>
      </div>
    </section>
  );
}
