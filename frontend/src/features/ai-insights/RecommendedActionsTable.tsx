import { modeText } from '@/lib/config';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TableShell } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { Modal } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useMutation';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { insightsService } from '@/services/insights';
import type { RecommendedAction } from '@/types/insights';
import { actionStatusMeta, PriorityPill } from './insightMeta';

/** Dismiss reasons: English source text; the English value is what gets saved as feedback. */
const reasons = [msg('Not relevant to current goals'), msg('Already in progress'), msg('Data looks incorrect'), msg('Needs more evidence'), msg('Other')];
const th = 'py-2.5 px-4 text-[0.75rem] font-semibold whitespace-nowrap';

/** Suggested actions: mark done, dismiss (with a reason) or mark all reviewed. */
export function RecommendedActionsTable({ actions }: { actions: RecommendedAction[] }) {
  const t = useT();
  const toast = useToast();
  const [dismissing, setDismissing] = useState<RecommendedAction>();
  const [reason, setReason] = useState<string>(reasons[0]);
  const [note, setNote] = useState('');

  const setStatus = useMutation(insightsService.setActionStatus, { invalidate: ['insights'] });
  const reviewAll = useMutation(insightsService.markAllActionsReviewed, {
    invalidate: ['insights'],
    onSuccess: (r) => toast({ tone: 'success', title: r.updated ? t('Marked as reviewed: {count}', { count: r.updated }) : t('All actions were already reviewed') }),
  });

  const active = actions.filter((a) => a.status !== 'dismissed' && a.status !== 'done').length;

  const markDone = async (a: RecommendedAction) => {
    const next = a.status === 'done' ? 'reviewed' : 'done';
    const res = await setStatus.mutate(a.id, next);
    if (res)
      toast({
        tone: 'success',
        title: next === 'done' ? t('Marked as done') : t('Action reopened'),
        description: next === 'done' ? modeText(t('Saved in this browser only. SocialBoard never changes your Instagram campaigns.'), t('Saved in SocialBoard. SocialBoard never changes your Instagram campaigns.')) : undefined,
      });
  };

  const confirmDismiss = async () => {
    if (!dismissing) return;
    const feedback = note.trim() ? `${reason}: ${note.trim()}` : reason;
    const res = await setStatus.mutate(dismissing.id, 'dismissed', feedback);
    if (res) {
      toast({ tone: 'success', title: t('Suggestion dismissed'), description: t('Reason saved: "{reason}"', { reason: feedback }) });
      setDismissing(undefined);
      setNote('');
      setReason(reasons[0]);
    }
  };

  return (
    <section className="bg-surface-card border border-border-strong rounded-xl shadow-card overflow-hidden">
      <div className="px-5 pt-5 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('Suggested actions')}</h2>
            <span className="px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold bg-surface-canvas text-text-secondary">{t('Open: {count}', { count: active })}</span>
          </div>
          <p className="text-body-sm text-text-secondary mt-0.5">{t('Most useful first. Impact numbers are estimates.')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon="tune"
            onClick={() => toast({ tone: 'demo', title: t('Rules need the backend'), description: t('You can set suggestion rules once the server is connected.') })}
          >
            {t('Rules')}
          </Button>
          <Button size="sm" onClick={() => reviewAll.mutate()} loading={reviewAll.isPending}>
            {t('Mark all reviewed')}
          </Button>
        </div>
      </div>
      <TableShell>
        <thead>
          <tr className="bg-surface-canvas text-text-secondary border-y border-border-strong text-left">
            <th className={cn(th, 'w-24')}>{t('Priority')}</th>
            <th className={th}>{t('Action')}</th>
            <th className={th}>{t('Expected impact')}</th>
            <th className={cn(th, 'w-36')}>{t('Status')}</th>
            <th className={cn(th, 'text-right')}>
              <span className="sr-only">{t('Actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle text-body-md font-body-md">
          {actions.map((a) => (
            <tr key={a.id} className={cn('hover:bg-surface-canvas transition-colors', a.status === 'dismissed' && 'opacity-60')}>
              <td className="py-3 px-4">
                <PriorityPill priority={a.priority} short />
              </td>
              <td className="py-3 px-4 max-w-md whitespace-normal">
                <Link to={`/ai-insights/${a.insightId}`} className="font-semibold text-text-primary hover:underline">
                  {a.title}
                </Link>
                <div className="text-body-sm text-text-secondary truncate" title={a.rationale}>
                  {a.rationale}
                </div>
                <Link to={a.target.to} className="inline-flex items-center gap-1 text-[0.75rem] text-primary hover:underline font-medium mt-0.5">
                  <span>{a.target.label}</span>
                  <Icon name="arrow_forward" className="text-[0.8125rem]" />
                </Link>
                {a.feedback && <div className="text-[0.6875rem] text-text-tertiary mt-0.5">{t('Reason: {reason}', { reason: a.feedback })}</div>}
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-1 text-status-active font-semibold text-body-sm">
                  {a.impact}
                  <InfoTip text={`${a.metric} · ${a.metricNote}`} />
                </div>
                <div className="text-[0.6875rem] text-text-tertiary">{t('Estimate')}</div>
              </td>
              <td className="py-3 px-4">
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm font-label-sm font-semibold whitespace-nowrap', actionStatusMeta[a.status].pill)}>
                  {t(actionStatusMeta[a.status].label)}
                </span>
              </td>
              <td className="py-3 px-4 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => markDone(a)}
                    disabled={a.status === 'dismissed' || setStatus.isPending}
                    aria-label={a.status === 'done' ? t('Reopen: {title}', { title: a.title }) : t('Mark done: {title}', { title: a.title })}
                    title={a.status === 'done' ? t('Reopen') : t('Mark done')}
                    className={cn('p-1 rounded-lg hover:bg-status-active-subtle disabled:opacity-40', a.status === 'done' ? 'text-white bg-status-active-solid hover:bg-status-active-solid' : 'text-status-active')}
                  >
                    <Icon name="check" />
                  </button>
                  {a.status === 'dismissed' ? (
                    <button
                      type="button"
                      onClick={() => setStatus.mutate(a.id, 'pending_review')}
                      aria-label={t('Restore: {title}', { title: a.title })}
                      title={t('Restore')}
                      className="p-1 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-canvas"
                    >
                      <Icon name="undo" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDismissing(a)}
                      aria-label={t('Dismiss: {title}', { title: a.title })}
                      title={t('Dismiss')}
                      className="p-1 rounded-lg text-text-tertiary hover:text-error hover:bg-error-container/20"
                    >
                      <Icon name="close" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      <Modal
        open={!!dismissing}
        onClose={() => setDismissing(undefined)}
        title={t('Dismiss suggestion')}
        subtitle={dismissing?.title}
        icon="feedback"
        size="sm"
        footer={
          <>
            <Button onClick={() => setDismissing(undefined)}>{t('Cancel')}</Button>
            <Button variant="danger" onClick={confirmDismiss} loading={setStatus.isPending}>
              {t('Dismiss')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label={t('Why are you dismissing this?')} htmlFor="dismiss-reason">
            <select
              id="dismiss-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-9 px-3 bg-slate-950 border border-slate-700 rounded-lg text-label-md text-text-primary focus:outline-none focus:border-border-focused"
            >
              {reasons.map((r) => (
                <option key={r} value={r}>
                  {t(r)}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={t('More feedback (optional)')}
            htmlFor="dismiss-note"
            hint={modeText(t('Saved in this browser only.'), t('Saved in SocialBoard. No AI is trained on it.'))}
          >
            <textarea
              id="dismiss-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={280}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-label-md text-text-primary focus:outline-none focus:border-border-focused"
            />
          </Field>
        </div>
      </Modal>
    </section>
  );
}
