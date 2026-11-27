import { Link } from 'react-router-dom';
import { AiBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { AiAnalysisItem, AiAnalysisKind } from '@/types/campaigns';
import { UnavailableNote } from './SectionCard';

const kinds: Record<AiAnalysisKind, { label: string; icon: string; head: string; box: string }> = {
  working: { label: msg('What works'), icon: 'check_circle', head: 'text-status-active', box: 'bg-surface-canvas' },
  attention: { label: msg('Needs a look'), icon: 'warning', head: 'text-status-paused', box: 'bg-surface-canvas' },
  opportunity: { label: msg('Chance for more leads'), icon: 'lightbulb', head: 'text-ai-accent', box: 'bg-surface-canvas' },
  recommendation: { label: msg('Try this'), icon: 'psychology', head: 'text-primary', box: 'bg-amber-900/40 border border-amber-800' },
};

/** AI summary for one campaign: what works, what needs a look, a chance and one tip. */
export function AiCampaignAnalysis({ analysis, hasMetrics }: { analysis: AiAnalysisItem[] | undefined; hasMetrics: boolean }) {
  const t = useT();
  return (
    <section className="bg-surface-card border border-border-strong rounded-xl shadow-card p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-full bg-ai-subtle text-ai-accent flex items-center justify-center">
            <Icon name="auto_awesome" className="text-[1.125rem]" />
          </span>
          <h2 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('AI summary')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <AiBadge />
          <InfoTip text={t('Written by AI from sample data. Check before you act on it.')} />
        </div>
      </div>
      {analysis && analysis.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          {analysis.map((a) => {
            const k = kinds[a.kind];
            return (
              <div key={a.kind} className={cn('p-3 rounded-lg', k.box)}>
                <div className={cn('flex items-center gap-1.5 text-label-md font-semibold', k.head)}>
                  <Icon name={k.icon} className="text-[1rem]" />
                  {t(k.label)}
                </div>
                <p className="mt-1 text-body-sm text-text-primary">{a.text}</p>
              </div>
            );
          })}
          <Link to="/ai-insights" className="text-label-md text-text-primary hover:text-primary-container font-semibold flex items-center gap-1 self-start">
            {t('See all AI tips')} <Icon name="arrow_forward" className="text-[1rem]" />
          </Link>
        </div>
      ) : (
        <UnavailableNote icon="auto_awesome">
          {hasMetrics ? t('No AI summary for this campaign yet.') : t('The AI summary comes once the campaign has numbers.')}{' '}
          <Link to="/ai-insights" className="text-ai-accent font-semibold hover:underline">
            {t('See all AI tips')} →
          </Link>
        </UnavailableNote>
      )}
    </section>
  );
}
