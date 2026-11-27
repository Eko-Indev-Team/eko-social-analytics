import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { useToast } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useMutation';
import { msg, useT } from '@/i18n/I18nContext';
import { modeText } from '@/lib/config';
import { cn, formatNumber, formatPercent } from '@/lib/format';
import { leadService } from '@/services/leads';
import type { ClassifiedComment } from '@/types/content';
import { ratio } from '../contentMeta';
import type { AnalyticsPageData } from './model';
import { SectionCard, UnavailableSection } from './SectionCard';

function CommentRow({ comment, data, leadId, onLead }: { comment: ClassifiedComment; data: AnalyticsPageData; leadId?: string; onLead: (id: string) => void }) {
  const t = useT();
  const toast = useToast();
  const { mutate, isPending } = useMutation(leadService.createFromComment, {
    invalidate: ['leads'],
    onSuccess: ({ lead, created }) => {
      onLead(lead.id);
      toast({
        title: created ? t('Lead added') : t('Already a lead'),
        description: created
          ? t(modeText(msg('@{handle} was added to Leads (sample data only, not sent to a CRM).'), msg('@{handle} was added to Leads (not sent to a CRM).')), { handle: comment.handle })
          : t('@{handle} is already in your leads.', { handle: comment.handle }),
      });
    },
    onError: (e) => toast({ tone: 'error', title: t('Could not add the lead'), description: e.message }),
  });

  const assign = () =>
    mutate({
      name: comment.name,
      handle: comment.handle,
      location: comment.location,
      campaignId: data.item.campaignId ?? 'sbi-csp-october',
      contentId: data.item.id,
      score: comment.score,
      source: 'comment',
      firstMessage: comment.text,
    });

  return (
    <div className="p-3.5 bg-surface-canvas rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[0.75rem] font-bold">{comment.handle[0].toUpperCase()}</div>
          <span className="text-label-md font-semibold text-text-primary">@{comment.handle}</span>
          <span className="text-[0.75rem] text-text-tertiary">{comment.ago}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-full bg-ai-subtle text-ai-accent text-[0.6875rem] font-semibold">{comment.classification}</span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[0.6875rem] font-bold tnum',
              comment.score >= 85 ? 'bg-status-active-subtle text-status-active' : 'bg-slate-800 text-slate-300',
            )}
          >
            {t('Score {score}/100', { score: comment.score })}
          </span>
        </div>
      </div>
      <p className="text-body-md text-text-primary mb-2">“{comment.text}”</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-text-tertiary">
        <span>{t('Mood: {value}', { value: comment.sentiment })}</span>
        <span>{t('Intent: {value}', { value: comment.intent })}</span>
        <span className="text-amber-300 font-semibold">{t('Lead chance: {value}', { value: comment.potential })}</span>
        {leadId ? (
          <Link to={`/leads?lead=${leadId}`} className="ml-auto text-primary hover:underline font-bold text-label-sm">
            {t('View lead')} →
          </Link>
        ) : (
          <button type="button" onClick={assign} disabled={isPending} className="ml-auto text-primary hover:underline font-bold text-label-sm disabled:opacity-50">
            {isPending ? t('Adding…') : `${t('Add as lead')} →`}
          </button>
        )}
      </div>
    </div>
  );
}

/** Sample comments that look like lead questions; "Add as lead" creates a lead. */
export function CommentStreamCard({ data }: { data: AnalyticsPageData }) {
  const t = useT();
  const comments = data.analytics?.comments;
  const [leadIds, setLeadIds] = useState<Record<string, string>>({});
  if (!comments) return <UnavailableSection title={t('Comments')} className="col-span-12 lg:col-span-7" />;
  const total = formatNumber(data.item.metrics.comments);

  return (
    <SectionCard
      className="col-span-12 lg:col-span-7"
      title={t('Comments')}
      addon={<InfoTip text={t('Sorted and scored by AI. Check before you act on it.')} />}
      subtitle={t('Lead questions picked from {count} comments', { count: total })}
      right={
        <Link to="/comments" className="inline-flex items-center gap-1 text-label-md font-semibold text-text-primary hover:text-primary-container">
          <span>{t('See all')}</span>
          <Icon name="arrow_forward" className="text-[0.875rem]" />
        </Link>
      }
    >
      <div className="space-y-3">
        {comments.map((c) => (
          <CommentRow key={c.id} comment={c} data={data} leadId={leadIds[c.id] ?? c.leadId} onLead={(id) => setLeadIds((p) => ({ ...p, [c.id]: id }))} />
        ))}
      </div>
    </SectionCard>
  );
}

/** Where the leads came from, and the steps from views to leads. */
export function LeadAttributionCard({ data }: { data: AnalyticsPageData }) {
  const t = useT();
  const la = data.analytics?.leadAttribution;
  if (!la) return <UnavailableSection title={t('Where leads came from')} className="col-span-12 lg:col-span-5" />;
  const m = data.item.metrics;
  const stages = [
    { label: t('Views'), value: formatNumber(m.views), bar: 'bg-slate-700', width: '100%' },
    { label: la.engagedThresholdLabel, value: `${formatNumber(la.engagedViewers)} (${formatPercent(ratio(la.engagedViewers, m.views), 1)})`, bar: 'bg-slate-600', width: '55%' },
    { label: t('Comments'), value: `${formatNumber(m.comments)} (${formatPercent(ratio(m.comments, m.views))})`, bar: 'bg-amber-800', width: '35%' },
    { label: t('Leads'), value: formatNumber(m.leads), bar: 'bg-emerald-800', width: '20%' },
  ];

  return (
    <SectionCard
      className="col-span-12 lg:col-span-5 flex flex-col"
      title={t('Where leads came from')}
      subtitle={t('{pct} of comments became leads', { pct: formatPercent(ratio(m.leads, m.comments), 1) })}
    >
      <div className="space-y-2 mb-5">
        {la.channels.map((c) => (
          <div key={c.label} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-surface-canvas">
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', c.dotClassName)} />
              <span className="text-label-sm text-text-primary font-medium truncate">{c.label}</span>
            </div>
            <div className="text-label-sm font-bold text-text-primary tnum whitespace-nowrap">
              {t('{count} leads', { count: c.leads })} <span className="font-normal text-text-tertiary">({Math.round(ratio(c.leads, m.leads))}%)</span>
            </div>
          </div>
        ))}
      </div>
      <div className="text-label-md font-semibold text-text-primary mb-2">{t('From views to leads')}</div>
      <div className="space-y-1.5">
        {stages.map((s) => (
          <div key={s.label} className="relative rounded-lg p-2 text-label-sm flex justify-between items-center gap-2 overflow-hidden bg-surface-canvas">
            <div className={cn('absolute inset-y-0 left-0 opacity-40', s.bar)} style={{ width: s.width }} />
            <span className="relative z-10 font-medium text-text-primary">{s.label}</span>
            <span className="relative z-10 font-bold tnum text-right text-text-primary">{s.value}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[0.75rem] text-text-tertiary">{t('CRM sync is not connected.')}</p>
    </SectionCard>
  );
}
