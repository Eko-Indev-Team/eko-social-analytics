import { InfoTip } from '@/components/ui/InfoTip';
import { useT } from '@/i18n/I18nContext';
import { cn, formatNumber } from '@/lib/format';
import type { CommentIntent, CommentSummary } from '@/types/comments';
import { intentMeta, pct } from './commentMeta';

/** What people ask about (AI-sorted). Clicking a row filters the comment list. */
export function IntentMatrix({ summary, activeIntent, onSelect }: { summary: CommentSummary; activeIntent: CommentIntent | 'all'; onSelect: (intent: CommentIntent) => void }) {
  const t = useT();
  const total = summary.totalComments;
  const rows = summary.intents.filter((i) => i.intent !== 'other');
  const spam = summary.intents.find((i) => i.intent === 'other');
  const max = Math.max(...rows.map((r) => r.comments));

  return (
    <div className="lg:col-span-7 bg-surface-card border border-border-strong rounded-xl shadow-card p-5 flex flex-col justify-between min-w-0">
      <div>
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('What people want')}</h2>
              <InfoTip
                text={t('Sorted by AI from the comment text (sample labels here). Only labels with at least {confidence}% confidence are used. Check before you act on it.', {
                  confidence: summary.classificationConfidence,
                })}
              />
            </div>
            <p className="text-body-sm text-text-secondary">{t('Click a row to filter the list')}</p>
          </div>
          <span className="text-label-sm text-text-tertiary">{t('{count} comments', { count: formatNumber(total) })}</span>
        </div>
        <ul className="space-y-1">
          {rows.map((r) => {
            const meta = intentMeta[r.intent];
            const active = activeIntent === r.intent;
            return (
              <li key={r.intent}>
                <button
                  type="button"
                  onClick={() => onSelect(r.intent)}
                  aria-pressed={active}
                  className={cn(
                    'w-full text-left rounded-lg px-3 py-2 transition-colors',
                    active ? 'bg-primary-container/15 ring-1 ring-primary-container/40' : 'hover:bg-surface-canvas',
                  )}
                >
                  <div className="flex items-center justify-between gap-3 text-body-sm mb-1.5">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={cn('w-2 h-2 rounded-full shrink-0', meta.dot)} />
                      <span className={cn('font-medium truncate', r.intent === 'complaint' ? 'text-error' : 'text-text-primary')}>{t(meta.label)}</span>
                    </span>
                    <span className="flex items-center gap-3 shrink-0 text-label-sm">
                      <span className="text-text-tertiary">{t('{count} leads', { count: formatNumber(r.potentialLeads) })}</span>
                      <span className="text-text-secondary tnum w-12 text-right">{pct(r.comments, total)}</span>
                      <span className="text-text-primary font-semibold tnum w-12 text-right">{formatNumber(r.comments)}</span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden bg-slate-800">
                    <div className={cn('h-full rounded-full', meta.dot)} style={{ width: `${(r.comments / max) * 100}%` }} />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {spam && (
        <p className="pt-3 mt-2 text-label-sm text-text-tertiary">
          {t('{count} spam or off-topic comments ({pct}) are left out.', { count: formatNumber(spam.comments), pct: pct(spam.comments, total) })}
        </p>
      )}
    </div>
  );
}
