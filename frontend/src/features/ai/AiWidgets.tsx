import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { formatNumber } from '@/lib/format';
import { aiService } from '@/services/ai';
import type { AIJob, EvidenceFact, InsightAI } from '@/types/ai';
import { aiStageLabel } from './useAiJob';

/** Labels and help are English source text (msg-marked); translate with t() where rendered. */
export const qualityMeta: Record<InsightAI['evidenceQuality'], { label: string; tone: 'active' | 'amber' | 'neutral'; help: string }> = {
  high: { label: msg('Evidence: High'), tone: 'active', help: msg('Every number has enough data behind it.') },
  medium: { label: msg('Evidence: Medium'), tone: 'amber', help: msg('Enough data, but some numbers are small or have gaps.') },
  low: { label: msg('Evidence: Low'), tone: 'neutral', help: msg('At least one number has too little data. Treat this as a weak signal.') },
};

const sourceLabel: Record<EvidenceFact['source'], string> = {
  demo_dataset: msg('Sample data'),
  workspace_data: msg('Your data'),
  instagram_api: msg('Instagram (live)'),
};

/** "AI-generated · model" label; makes clear the text is a model suggestion, not a completed action. */
export function AiGeneratedBadge({ ai }: { ai: Pick<InsightAI, 'model' | 'provider'> }) {
  const t = useT();
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold bg-ai-subtle border border-ai-border text-ai-accent"
      title={t('Made by {provider} · {model}', { provider: ai.provider, model: ai.model })}
    >
      <Icon name="auto_awesome" filled className="text-[0.75rem]" /> {t('AI-generated · {model}', { model: ai.model })}
    </span>
  );
}

export function QualityPill({ quality }: { quality: InsightAI['evidenceQuality'] }) {
  const t = useT();
  const meta = qualityMeta[quality];
  return (
    <Badge tone={meta.tone} icon="fact_check">
      <span title={t(meta.help)}>{t(meta.label)}</span>
    </Badge>
  );
}

export function AiJobProgress({ job }: { job: AIJob }) {
  const t = useT();
  return (
    <div className="w-full" role="status" aria-live="polite" aria-label={t('AI progress')}>
      <div className="flex items-center justify-between text-[0.75rem] text-text-secondary mb-1">
        <span>{aiStageLabel(job, t)}</span>
        <span className="tnum">{job.progress}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-container overflow-hidden">
        <div className={`h-full rounded-full transition-all ${job.status === 'retrying' ? 'bg-amber-500' : 'bg-ai-accent'}`} style={{ width: `${Math.max(job.progress, 4)}%` }} />
      </div>
      {job.status === 'retrying' && job.errorMessage && <p className="text-[0.6875rem] text-text-tertiary mt-1">{job.errorMessage}</p>}
    </div>
  );
}

/** One short line about the AI provider; details sit in an (i) tip. The numbers on the page work without AI. */
export function AiStatusNotice() {
  const t = useT();
  const status = useQuery('ai:status', aiService.status, { isEmpty: () => false });
  if (status.status === 'loading') return <Skeleton className="h-6" />;
  if (status.error || !status.data) {
    return (
      <p className="flex items-center gap-1.5 text-body-sm text-status-paused">
        <Icon name="warning" className="text-[1rem]" />
        {t('Could not check the AI status.')}
        <InfoTip text={status.error?.message ?? t('Could not load the AI settings.')} />
      </p>
    );
  }
  const s = status.data;
  if (!s.enabled) {
    return (
      <p className="flex items-center gap-1.5 text-body-sm text-text-secondary">
        <Icon name="info" className="text-[1rem] text-status-completed" />
        {t('AI analysis is not configured on this server.')}
        <InfoTip text={t('The numbers below still work without AI. An admin can turn AI on by setting AI_PROVIDER, AI_MODEL and AI_API_KEY in backend/.env.')} />
      </p>
    );
  }
  return (
    <p className="text-[0.75rem] text-text-tertiary flex flex-wrap items-center gap-x-3 gap-y-0.5">
      <span>{t('AI: {provider} · {model}', { provider: s.provider, model: s.model ?? '—' })}</span>
      <span>
        {s.limits.monthlyTokens
          ? t('Used this month: {used} of {limit} tokens', { used: formatNumber(s.usage.tokensMonth), limit: formatNumber(s.limits.monthlyTokens) })
          : t('Used this month: {used} tokens', { used: formatNumber(s.usage.tokensMonth) })}
      </span>
      <InfoTip
        text={t('{requests} requests this month, {failed} failed. SocialBoard sets these limits, not the AI provider.', {
          requests: s.usage.requestsMonth,
          failed: s.usage.failuresMonth,
        })}
      />
    </p>
  );
}

export function EvidenceTable({ evidence }: { evidence: EvidenceFact[] }) {
  const t = useT();
  const kind = (k: EvidenceFact['kind']) => (k === 'measured' ? t('Measured') : k === 'calculated' ? t('Calculated') : t('Comparison'));
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left border-collapse min-w-[760px] text-body-sm">
        <thead>
          <tr className="border-b border-border-strong text-text-secondary text-[0.75rem] font-semibold">
            <th className="py-2 px-2">{t('Ref')}</th>
            <th className="py-2 px-2">{t('Number')}</th>
            <th className="py-2 px-2 text-right">{t('Value')}</th>
            <th className="py-2 px-2">{t('Period')}</th>
            <th className="py-2 px-2 text-right">{t('Data points')}</th>
            <th className="py-2 px-2">{t('Source')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {evidence.map((f) => (
            <tr key={f.id} className={f.sufficient ? undefined : 'bg-amber-900/40'}>
              <td className="py-2 px-2 font-mono text-[0.75rem] text-text-tertiary">{f.id}</td>
              <td className="py-2 px-2">
                <div className="font-semibold text-text-primary">{f.label}</div>
                <div className="text-[0.6875rem] text-text-tertiary">
                  {kind(f.kind)} · {f.definition}
                </div>
                {!f.sufficient && (
                  <div className="text-[0.6875rem] text-amber-300 mt-0.5">{f.note ? t('Not enough data: {note}', { note: f.note }) : t('Not enough data')}</div>
                )}
              </td>
              <td className="py-2 px-2 text-right tnum font-semibold">{f.display}</td>
              <td className="py-2 px-2 whitespace-nowrap text-[0.75rem]">
                {f.periodStart} → {f.periodEnd}
              </td>
              <td className="py-2 px-2 text-right tnum text-[0.75rem]">
                {f.missing ? t('{count} (+{missing} missing)', { count: f.sampleSize, missing: f.missing }) : f.sampleSize}
              </td>
              <td className="py-2 px-2 text-[0.75rem]">{sourceLabel[f.source] ? t(sourceLabel[f.source]) : f.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
