import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { useT } from '@/i18n/I18nContext';
import type { Insight, InsightStatus } from '@/types/insights';
import { AiGeneratedBadge, EvidenceTable, QualityPill, qualityMeta } from './AiWidgets';

const card = 'bg-surface-card border border-border-strong rounded-xl shadow-card p-5';
const title = 'font-heading text-[1.0625rem] font-semibold text-text-primary';

/** Detail view for an AI-generated insight: claim → evidence (with definitions/periods) → suggestion → details. */
export function AiInsightBody({ insight, onStatus, busy }: { insight: Insight; onStatus: (s: InsightStatus) => void; busy: boolean }) {
  const t = useT();
  const ai = insight.ai!;
  const expired = new Date(ai.expiresAt).getTime() < Date.now();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-8 space-y-6 min-w-0">
        <section className={`${card} space-y-4`}>
          <div className="flex items-center gap-2 flex-wrap">
            <AiGeneratedBadge ai={ai} />
            <QualityPill quality={ai.evidenceQuality} />
            {expired && <span className="text-[0.6875rem] text-text-tertiary">{t('Review window ended {date}', { date: new Date(ai.expiresAt).toLocaleDateString() })}</span>}
          </div>
          <p className="text-body-md text-text-primary">{ai.summary}</p>
          <div>
            <h3 className="text-body-sm font-semibold text-text-secondary mb-1">{t('What we saw')}</h3>
            <p className="text-body-sm text-text-primary">{insight.observed}</p>
          </div>
          <div>
            <h3 className="text-body-sm font-semibold text-text-secondary mb-1 flex items-center gap-1.5">
              {t('Why it may matter')}
              <InfoTip text={t('Things that happen together are not proof that one causes the other.')} />
            </h3>
            <p className="text-body-sm text-text-primary">{ai.explanation}</p>
          </div>
        </section>

        <section className={card}>
          <div className="flex items-center gap-1.5 mb-1">
            <h2 className={title}>{t('Evidence')}</h2>
            <InfoTip text={`${t(qualityMeta[ai.evidenceQuality].help)} ${t('Evidence quality is about the data, not the chance that the suggestion is right.')}`} />
          </div>
          <p className="text-body-sm text-text-secondary mb-3">{t('Every number was checked against these figures before saving.')}</p>
          <EvidenceTable evidence={ai.evidence} />
        </section>
      </div>

      <div role="complementary" className="lg:col-span-4 space-y-4">
        <section className="bg-ai-subtle border border-ai-border rounded-xl p-5">
          <h2 className="text-body-sm font-semibold text-ai-accent flex items-center gap-1.5 mb-2">
            <Icon name="lightbulb" className="text-[1rem]" /> {t('Suggested next step')}
          </h2>
          <p className="text-body-sm text-text-primary">{ai.recommendedAction}</p>
          <p className="text-[0.6875rem] text-text-tertiary mt-2">{t('Only a suggestion: nothing has been changed in your campaigns or on Instagram.')}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" icon="bookmark" onClick={() => onStatus('saved')} disabled={busy || insight.status === 'saved'}>
              {t('Save')}
            </Button>
            <Button size="sm" variant="primary" icon="task_alt" onClick={() => onStatus('completed')} disabled={busy || insight.status === 'completed'}>
              {t('Mark action completed')}
            </Button>
            <Button size="sm" variant="ghost" icon="visibility_off" onClick={() => onStatus('dismissed')} disabled={busy || insight.status === 'dismissed'}>
              {t('Dismiss')}
            </Button>
          </div>
          {insight.primaryLink && (
            <Link to={insight.primaryLink.to} className="inline-block mt-3 text-label-sm text-primary font-semibold hover:underline">
              {insight.primaryLink.label} →
            </Link>
          )}
        </section>
        <section className={`${card} text-[0.75rem] text-text-secondary space-y-1`}>
          <h2 className="text-body-sm font-semibold text-text-primary mb-1">{t('Details')}</h2>
          <p>{t('Made {date} by {provider} · {model}', { date: new Date(ai.generatedAt).toLocaleString(), provider: ai.provider, model: ai.model })}</p>
          <p>{t('Prompt version {version}', { version: ai.promptVersion })}</p>
          <p>{t('Data used: {sources}', { sources: ai.sources.join(', ') })}</p>
          <p>{t('Review by {date}', { date: new Date(ai.expiresAt).toLocaleDateString() })}</p>
        </section>
        {ai.sources.includes('demo_dataset') && (
          <p className="flex items-center gap-1.5 text-body-sm text-text-secondary">
            <Icon name="science" className="text-[1rem] text-text-tertiary" />
            {t('Based on sample data')}
            <InfoTip text={t('These numbers come from the sample records in the database, not from live Instagram data.')} />
          </p>
        )}
      </div>
    </div>
  );
}
