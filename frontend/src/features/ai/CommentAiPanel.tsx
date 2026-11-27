import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { invalidateQueries, useQuery } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { aiService } from '@/services/ai';
import type { CommentIntentLabel, CommentLabels } from '@/types/ai';
import { AiJobProgress } from './AiWidgets';
import { describeAiError, useAiJob } from './useAiJob';

/** English source labels (msg-marked); translate with t() where rendered. */
export const intentLabels: Record<CommentIntentLabel, string> = {
  product_inquiry: msg('Asks about the product'),
  pricing_inquiry: msg('Asks about price'),
  contact_request: msg('Wants to be contacted'),
  interest: msg('Shows interest'),
  complaint_support: msg('Complaint or support'),
  spam_irrelevant: msg('Spam or off-topic'),
  other: msg('Other'),
};
const SENTIMENTS: CommentLabels['sentiment'][] = ['positive', 'neutral', 'negative'];
const sentimentLabels: Record<CommentLabels['sentiment'], string> = {
  positive: msg('Positive'),
  neutral: msg('Neutral'),
  negative: msg('Negative'),
};

/** Toolbar (api mode): queue AI sorting for comments without a current label and follow the job. */
export function CommentAiToolbar() {
  const t = useT();
  const job = useAiJob({ invalidate: ['ai:cls'] });
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-ai-subtle border border-ai-border rounded-xl p-3 mb-4">
      <div className="flex-1 text-body-sm text-text-primary">
        <span className="font-semibold inline-flex items-center gap-1.5">
          {t('Sort comments with AI')}
          <InfoTip text={t('AI suggests mood, intent and whether it is a lead. A person should check each label. Nothing is posted or changed automatically.')} />
        </span>
        {job.active && (
          <div className="mt-2 max-w-md">
            <AiJobProgress job={job.active} />
          </div>
        )}
      </div>
      <Button icon="auto_awesome" variant="primary" onClick={() => void job.start(() => aiService.classifyComments())} loading={job.starting} disabled={!!job.active}>
        {job.active ? t('Sorting…') : t('Sort new comments')}
      </Button>
    </div>
  );
}

/** AI prediction for one comment + human review (confirm / correct). The prediction is never overwritten. */
export function CommentAiPanel({ commentId }: { commentId: string }) {
  const t = useT();
  const toast = useToast();
  const q = useQuery(`ai:cls:${commentId}`, () => aiService.classifications([commentId]), { isEmpty: () => false });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<CommentLabels>>({});
  const [saving, setSaving] = useState(false);
  const row = q.data?.[0];

  const save = async (reviewStatus: 'confirmed' | 'corrected') => {
    if (!row) return;
    setSaving(true);
    try {
      await aiService.reviewClassification(row.id, reviewStatus === 'confirmed' ? { reviewStatus } : { reviewStatus, ...draft });
      toast({ title: reviewStatus === 'confirmed' ? t('AI label confirmed') : t('Correction saved'), description: t('Saved next to the AI suggestion.') });
      setEditing(false);
      invalidateQueries('ai:cls');
    } catch (err) {
      toast({ tone: 'error', ...describeAiError(err, t) });
    } finally {
      setSaving(false);
    }
  };

  if (q.status === 'loading') return <Skeleton className="h-20" />;
  if (q.error) return <p className="text-[0.75rem] text-error">{t('Could not load AI labels: {error}', { error: q.error.message })}</p>;
  if (!row) return <p className="text-[0.75rem] text-text-tertiary">{t('No AI label yet. Use “Sort new comments” above.')}</p>;
  const eff = row.effective;
  const review = row.reviewStatus === 'unreviewed' ? t('Not reviewed') : row.reviewStatus === 'confirmed' ? t('Confirmed by a person') : t('Corrected by a person');
  return (
    <div className="rounded-xl border border-ai-border bg-ai-subtle/60 p-3 space-y-2" aria-label={t('AI label')}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[0.75rem] text-ai-accent font-semibold">
          <Icon name="auto_awesome" className="text-[0.8125rem]" /> {t('AI suggestion')}
        </span>
        <Badge tone={row.reviewStatus === 'unreviewed' ? 'amber' : 'active'}>{review}</Badge>
        <span className="text-[0.6875rem] text-text-tertiary">{t('Uncertainty: {level}', { level: row.prediction.uncertainty })}</span>
      </div>
      {row.injectionSuspected && (
        <p className="text-[0.75rem] text-amber-300">{t('This comment looks like instructions to an AI system. It was read as plain text; please check the label.')}</p>
      )}
      <dl className="grid grid-cols-3 gap-2 text-[0.75rem]">
        <div>
          <dt className="text-text-tertiary">{t('Mood')}</dt>
          <dd className="font-semibold text-text-primary">{t(sentimentLabels[eff.sentiment])}</dd>
        </div>
        <div>
          <dt className="text-text-tertiary">{t('Intent')}</dt>
          <dd className="font-semibold text-text-primary">{t(intentLabels[eff.intent])}</dd>
        </div>
        <div>
          <dt className="text-text-tertiary">{t('Lead')}</dt>
          <dd className="font-semibold text-text-primary">{eff.leadSignal ? t('Yes') : t('No')}</dd>
        </div>
      </dl>
      <p className="text-[0.75rem] text-text-secondary">“{row.prediction.explanation}”</p>
      {row.reviewStatus === 'corrected' && (
        <p className="text-[0.6875rem] text-text-tertiary">
          {t('AI first said: {mood} · {intent} · lead {lead}', {
            mood: t(sentimentLabels[row.prediction.sentiment]),
            intent: t(intentLabels[row.prediction.intent]),
            lead: row.prediction.leadSignal ? t('yes') : t('no'),
          })}
        </p>
      )}
      {editing ? (
        <div className="space-y-2 text-[0.75rem]">
          <div className="flex flex-wrap gap-2">
            <select
              aria-label={t('Corrected mood')}
              className="h-8 border border-border-strong rounded px-2"
              value={draft.sentiment ?? eff.sentiment}
              onChange={(e) => setDraft((d) => ({ ...d, sentiment: e.target.value as CommentLabels['sentiment'] }))}
            >
              {SENTIMENTS.map((s) => (
                <option key={s} value={s}>
                  {t(sentimentLabels[s])}
                </option>
              ))}
            </select>
            <select
              aria-label={t('Corrected intent')}
              className="h-8 border border-border-strong rounded px-2"
              value={draft.intent ?? eff.intent}
              onChange={(e) => setDraft((d) => ({ ...d, intent: e.target.value as CommentIntentLabel }))}
            >
              {Object.entries(intentLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {t(l)}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={draft.leadSignal ?? eff.leadSignal} onChange={(e) => setDraft((d) => ({ ...d, leadSignal: e.target.checked }))} /> {t('Lead')}
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="xs" variant="primary" onClick={() => void save('corrected')} loading={saving} disabled={Object.keys(draft).length === 0}>
              {t('Save correction')}
            </Button>
            <Button size="xs" onClick={() => setEditing(false)}>
              {t('Cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="xs" icon="check" onClick={() => void save('confirmed')} loading={saving} disabled={row.reviewStatus === 'confirmed'}>
            {t('Confirm')}
          </Button>
          <Button
            size="xs"
            icon="edit"
            onClick={() => {
              setDraft({});
              setEditing(true);
            }}
          >
            {t('Correct')}
          </Button>
        </div>
      )}
    </div>
  );
}
