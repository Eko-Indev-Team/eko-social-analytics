import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { aiService } from '@/services/ai';
import type { LeadPriorities } from '@/types/ai';
import { AiJobProgress } from './AiWidgets';
import { useAiJob } from './useAiJob';

/** AI follow-up summary for one lead (api mode). Clearly a suggestion; nothing is sent to the lead. */
export function LeadAiSummaryPanel({ leadId }: { leadId: string }) {
  const t = useT();
  const summary = useQuery(`ai:lead-summary:${leadId}`, () => aiService.leadSummary(leadId), { isEmpty: () => false });
  const job = useAiJob({ invalidate: [`ai:lead-summary:${leadId}`] });
  const data = summary.data;
  return (
    <section className="rounded-xl border border-ai-border bg-ai-subtle/60 p-3 space-y-2" aria-label={t('AI follow-up tip')}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[0.75rem] text-ai-accent font-semibold">
          <Icon name="auto_awesome" className="text-[0.8125rem]" /> {t('AI follow-up tip')}
          <InfoTip text={t('Uses only status, campaign, source, age and the first message. It does not guess if the lead will convert, and it never contacts the lead.')} />
        </span>
        <Button size="xs" onClick={() => void job.start(() => aiService.requestLeadSummary(leadId))} loading={job.starting} disabled={!!job.active}>
          {data ? t('Refresh') : t('Summarise')}
        </Button>
      </div>
      {job.active && <AiJobProgress job={job.active} />}
      {summary.status === 'loading' ? (
        <Skeleton className="h-12" />
      ) : summary.error ? (
        <p className="text-[0.75rem] text-error">{summary.error.message}</p>
      ) : data ? (
        <div className="text-[0.75rem] space-y-1.5">
          <p className="text-text-primary">{data.summary}</p>
          <p>
            <span className="text-text-tertiary">{t('Why follow up:')} </span>
            {data.followUpReason}
          </p>
          <p>
            <span className="text-text-tertiary">{t('Next step:')} </span>
            <span className="font-semibold">{data.suggestedNextAction}</span>
          </p>
          <p className="text-[0.6875rem] text-text-tertiary">
            {t('Uncertainty: {level}', { level: data.uncertainty })} · {new Date(data.createdAt).toLocaleString()}
          </p>
          {data.injectionSuspected && <Badge tone="amber">{t('The first message looks like instructions to an AI. Check carefully.')}</Badge>}
        </div>
      ) : (
        <p className="text-[0.75rem] text-text-tertiary">{t('No tip yet. A tip is only a suggestion.')}</p>
      )}
    </section>
  );
}

/** Follow-up priorities, worked out without AI: who is waiting for a reply, and leads per campaign. */
export function LeadPrioritiesPanel() {
  const t = useT();
  const q = useQuery('ai:lead-priorities', aiService.leadPriorities, { isEmpty: () => false });
  return (
    <section className="bg-surface-card border border-border-strong rounded-xl shadow-card p-5" aria-labelledby="lead-priorities">
      <div className="mb-4">
        <div className="flex items-center gap-1.5">
          <h2 id="lead-priorities" className="font-heading text-[1.0625rem] font-semibold text-text-primary">
            {t('Follow-up priorities')}
          </h2>
          {q.data && <InfoTip text={[q.data.definition, q.data.dataNote, q.data.statusNote].filter(Boolean).join(' ')} />}
        </div>
        <p className="text-body-sm text-text-secondary">{t('Waiting for a reply')}</p>
      </div>
      <QueryState query={q} loading={<Skeleton className="h-16" />}>
        {(p: LeadPriorities) => (
          <div className="space-y-4">
            {p.waitingForContact.length === 0 ? (
              <p className="text-body-sm text-text-secondary">{t('No one is waiting too long. New leads: {count}', { count: p.newLeadsTotal })}</p>
            ) : (
              <ul className="divide-y divide-border-subtle text-body-sm">
                {p.waitingForContact.slice(0, 8).map((w) => (
                  <li key={w.leadId} className="py-2 flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <span className="font-semibold text-text-primary">{w.name}</span>
                      {w.campaign && <span className="text-text-tertiary"> · {w.campaign}</span>}
                    </span>
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[0.75rem] font-semibold bg-status-paused-subtle text-status-paused">
                      {t('waiting {days} days', { days: w.daysWaiting })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {p.byCampaign.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[0.75rem] font-semibold text-text-secondary">{t('Leads by campaign')}</p>
                <div className="flex flex-wrap gap-2 text-[0.75rem]">
                  {p.byCampaign.slice(0, 6).map((c) => (
                    <span key={c.campaignId} className="px-2.5 py-1 rounded-full bg-surface-canvas text-text-secondary">
                      {c.campaign}: <span className="font-semibold text-text-primary tnum">{c.total}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </QueryState>
    </section>
  );
}
