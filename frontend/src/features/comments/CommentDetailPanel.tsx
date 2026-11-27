import { CommentAiPanel } from '@/features/ai/CommentAiPanel';
import { isDemoMode } from '@/lib/config';
import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { InstagramComment } from '@/types/comments';
import type { Campaign, ContentItem, Lead } from '@/types/domain';
import { CommentAvatar, formatReceived, HighlightedText, Pill, statusMeta } from './commentMeta';

export interface DetailPanelProps {
  comment: InstagramComment;
  content: ContentItem | undefined;
  campaign: Campaign | undefined;
  existingLead: Lead | undefined;
  /** Lead created in this session from this comment (shows the success alert). */
  createdLead: Lead | undefined;
  busy: boolean;
  converting: boolean;
  onCopyReply: () => void;
  onMarkResponded: () => void;
  onMarkReviewed: () => void;
  onToggleFlag: () => void;
  onConvert: () => void;
  onDismiss: () => void;
  onOpenLead: (leadId: string) => void;
}

const smallBtn =
  'flex-1 py-1.5 px-3 rounded-full border border-border-strong bg-surface-card hover:bg-surface-canvas text-text-primary text-label-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-50';

/** Detail body: who wrote it, the post, the comment, the AI read and the suggested reply. */
export const CommentDetailBody = forwardRef<HTMLDivElement, DetailPanelProps>(function CommentDetailBody(
  { comment: c, content, campaign, existingLead, busy, onCopyReply, onMarkResponded, onMarkReviewed, onToggleFlag },
  replyRef,
) {
  const t = useT();
  return (
    <div className="space-y-4">
      {!isDemoMode && <CommentAiPanel commentId={c.id} />}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <CommentAvatar comment={c} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-text-primary text-body-md truncate">{c.authorName}</span>
              {c.verified && <Icon name="verified" className="text-tertiary text-[1rem]" label={t('Verified')} />}
            </div>
            <div className="text-text-secondary text-label-sm">
              @{c.handle}
              {c.location && ` · ${c.location}`}
            </div>
          </div>
        </div>
        <span className="text-label-sm bg-ai-subtle text-ai-accent px-2.5 py-0.5 rounded-full font-semibold whitespace-nowrap" title={t('Lead score from AI, 0 to 100')}>
          {t('Score {score}', { score: c.intentScore })}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Pill className={statusMeta[c.status].pill}>{t(statusMeta[c.status].label)}</Pill>
        {c.flagged && (
          <Pill className="bg-error-container/40 text-error font-semibold">
            <Icon name="flag" filled className="text-[0.75rem]" /> {t('Flagged')}
          </Pill>
        )}
        {existingLead && (
          <Pill className="bg-ai-subtle text-ai-accent font-semibold">
            <Icon name="contact_page" className="text-[0.75rem]" /> {t('Lead: {name}', { name: existingLead.name })}
          </Pill>
        )}
      </div>

      <blockquote className="p-3 bg-surface-canvas rounded-lg text-body-md text-text-primary leading-relaxed">
        "<HighlightedText text={c.text} highlights={c.highlights} markClassName="bg-primary-container/20 font-semibold px-1 rounded text-text-primary" />"
        <footer className="mt-2 text-label-sm text-text-tertiary flex flex-wrap justify-between gap-2">
          <span>{formatReceived(c.receivedAt)}</span>
          <span>{t('Language: {language}', { language: c.language })}</span>
        </footer>
      </blockquote>

      <div className="flex items-center gap-2 text-label-sm min-w-0">
        <Icon name={content?.type === 'reel' ? 'smart_display' : 'image'} className="text-[1rem] text-text-tertiary shrink-0" />
        <div className="min-w-0 flex-1">
          <Link to={`/content/${c.contentId}`} className="font-semibold text-text-primary truncate block hover:underline">
            {content?.title ?? c.contentId}
          </Link>
          {campaign ? (
            <Link to={`/campaigns/${campaign.id}`} className="text-text-secondary truncate block hover:underline">
              {campaign.name}
            </Link>
          ) : (
            <span className="text-text-secondary">{t('Not part of a campaign')}</span>
          )}
        </div>
      </div>

      <div className="p-3 rounded-lg bg-ai-subtle">
        <div className="flex items-center gap-1.5 mb-1 text-label-md font-semibold text-ai-accent">
          <Icon name="auto_awesome" className="text-[0.9375rem]" />
          <span>{t('AI read')}</span>
          <InfoTip text={t('Written by AI from the comment. Check before you act on it.')} />
        </div>
        <p className="text-body-sm text-text-primary leading-snug">{c.ai.summary}</p>
        <div className="mt-2 flex items-center gap-x-4 gap-y-1 flex-wrap text-label-sm text-ai-accent">
          <span>{t('Buying interest: {pct}%', { pct: c.ai.commercialIntent })}</span>
          <span>
            {c.ai.qualifierLabel}: <strong>{c.ai.qualifierValue}</strong>
          </span>
          <span>{t('Priority: {tier}', { tier: c.ai.priorityTier })}</span>
        </div>
      </div>

      <div ref={replyRef} tabIndex={-1} className="outline-none">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-label-md text-text-secondary font-semibold">{t('Suggested reply')}</span>
          <InfoTip text={t('Written by AI. SocialBoard does not post replies: copy it and reply in the Instagram app.')} />
        </div>
        {c.suggestedReply ? (
          <>
            <div className="p-3 bg-surface-canvas rounded-lg text-body-sm text-text-primary leading-relaxed">"{c.suggestedReply}"</div>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={onCopyReply} className={smallBtn}>
                <Icon name="content_copy" className="text-[0.875rem]" />
                <span>{t('Copy reply')}</span>
              </button>
              <button type="button" onClick={onMarkResponded} disabled={busy || c.status === 'responded'} className={smallBtn}>
                <Icon name="check" className="text-[0.875rem]" />
                <span>{c.status === 'responded' ? t('Replied') : t('Mark replied')}</span>
              </button>
            </div>
          </>
        ) : (
          <div className="p-3 bg-surface-canvas rounded-lg text-body-sm text-text-secondary">{t('No reply suggested: this looks like spam or off-topic.')}</div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={onMarkReviewed} disabled={busy || c.status === 'reviewed'} className={smallBtn}>
          <Icon name="done_all" className="text-[0.875rem]" /> {c.status === 'reviewed' ? t('Reviewed') : t('Mark reviewed')}
        </button>
        <button
          type="button"
          onClick={onToggleFlag}
          disabled={busy}
          aria-pressed={c.flagged}
          className={cn(
            'flex-1 py-1.5 px-3 rounded-full border text-label-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-50',
            c.flagged ? 'border-error/30 bg-error-container/30 text-error' : 'border-border-strong bg-surface-card hover:bg-surface-canvas text-text-primary',
          )}
        >
          <Icon name="flag" filled={c.flagged} className="text-[0.875rem]" /> {c.flagged ? t('Flagged') : t('Flag')}
        </button>
      </div>
    </div>
  );
});

/** Footer: make-a-lead button + archive / Leads links. */
export function CommentDetailFooter({ comment: c, existingLead, createdLead, converting, onConvert, onDismiss, onOpenLead }: DetailPanelProps) {
  const t = useT();
  const linkedLeadId = createdLead?.id ?? c.leadId ?? existingLead?.id;
  return (
    <div className="space-y-2 w-full">
      {createdLead && (
        <div className="p-2 rounded-lg bg-status-active-subtle text-status-active text-label-sm font-semibold flex items-center gap-1.5 flex-wrap" role="status">
          <Icon name="task_alt" className="text-[1rem]" />
          <span>{isDemoMode ? t('Lead created for {name} (sample data).', { name: createdLead.name }) : t('Lead created for {name}.', { name: createdLead.name })}</span>
          <button type="button" onClick={() => onOpenLead(createdLead.id)} className="underline">
            {t('Open lead')} →
          </button>
        </div>
      )}
      {linkedLeadId ? (
        <button
          type="button"
          onClick={() => onOpenLead(linkedLeadId)}
          className="w-full py-2.5 px-4 rounded-lg bg-status-active-solid text-white text-body-md font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm hover:opacity-90"
        >
          <Icon name="contact_page" />
          <span>{createdLead || c.leadId ? t('Open lead') : t('Already a lead — open')}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onConvert}
          disabled={converting}
          className="w-full py-2.5 px-4 rounded-lg bg-primary-container hover:bg-brand-primary-hover text-on-primary-container text-body-md font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-60"
        >
          <Icon name={converting ? 'progress_activity' : 'star'} filled={!converting} className={converting ? 'animate-spin' : undefined} />
          <span>{converting ? t('Creating lead…') : t('Make a lead')}</span>
        </button>
      )}
      {existingLead && !createdLead && !c.leadId && (
        <p className="text-label-sm text-text-tertiary text-center">{t('@{handle} is already in Leads. Opening it avoids a duplicate.', { handle: c.handle })}</p>
      )}
      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={onDismiss} disabled={c.status === 'archived'} className="text-label-sm text-text-secondary hover:text-text-primary disabled:opacity-50">
          {c.status === 'archived' ? t('Archived') : t('Archive comment')}
        </button>
        <Link to="/leads" className="text-label-sm text-primary font-semibold hover:underline">
          {t('Go to Leads')} →
        </Link>
      </div>
    </div>
  );
}

/** Inline right-column panel (xl+). On smaller screens the page renders the same body in a Drawer. */
export const CommentDetailPanel = forwardRef<HTMLDivElement, DetailPanelProps>(function CommentDetailPanel(props, replyRef) {
  const t = useT();
  return (
    <div className="hidden xl:flex xl:col-span-4 bg-surface-card border border-border-strong rounded-xl shadow-card flex-col justify-between min-w-0" aria-label={t('Comment detail')}>
      <div>
        <div className="px-5 pt-4 pb-2 flex items-center justify-between gap-2">
          <h3 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('Comment')}</h3>
          <span className="text-label-sm text-text-tertiary whitespace-nowrap">#{props.comment.ref}</span>
        </div>
        <div className="px-5 pb-4">
          <CommentDetailBody ref={replyRef} {...props} />
        </div>
      </div>
      <div className="px-5 py-4 border-t border-border-strong">
        <CommentDetailFooter {...props} />
      </div>
    </div>
  );
});
