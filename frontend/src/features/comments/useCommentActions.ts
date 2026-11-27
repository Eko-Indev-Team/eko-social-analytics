import { modeText } from '@/lib/config';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@/hooks/useMutation';
import { useToast } from '@/components/ui/Toast';
import { msg, useT } from '@/i18n/I18nContext';
import { commentsService, type CommentPatch } from '@/services/comments';
import type { CommentStatus, InstagramComment } from '@/types/comments';
import type { Lead } from '@/types/domain';
import { statusMeta } from './commentMeta';

/** Toast texts per new status (English keys; translated when shown). */
const statusToast: Partial<Record<CommentStatus, { title: string; description?: string }>> = {
  reviewed: { title: msg('Marked as reviewed'), description: msg('Removed from the “Needs a reply” list.') },
  responded: { title: msg('Marked as replied'), description: msg('Saved here only. Reply in the Instagram app — SocialBoard does not post replies.') },
  archived: { title: msg('Comment archived'), description: msg('Hidden from the list. Nothing changed on Instagram.') },
  needs_response: { title: msg('Moved back to “Needs a reply”') },
};

/** Triage actions for the Comments page (nothing is sent to Instagram). */
export function useCommentActions() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();

  const update = useMutation((id: string, patch: CommentPatch) => commentsService.update(id, patch), { invalidate: ['comments'] });
  const bulk = useMutation((ids: string[], status: CommentStatus) => commentsService.bulkSetStatus(ids, status), { invalidate: ['comments'] });
  const convert = useMutation((id: string) => commentsService.convertToLead(id), {
    invalidate: ['leads', 'comments'],
    onError: (e) => toast({ tone: 'error', title: t('Could not create the lead'), description: e.message }),
  });

  const setStatus = async (comment: InstagramComment, status: CommentStatus) => {
    const res = await update.mutate(comment.id, { status });
    const note = statusToast[status];
    if (res && note) toast({ tone: status === 'responded' ? 'demo' : 'success', title: t(note.title), description: note.description ? t(note.description) : undefined });
  };

  const toggleFlag = async (comment: InstagramComment) => {
    const res = await update.mutate(comment.id, { flagged: !comment.flagged });
    if (res) toast({ tone: 'success', title: res.flagged ? t('Flagged for follow-up') : t('Flag removed') });
  };

  const bulkSetStatus = async (ids: string[], status: CommentStatus) => {
    const res = await bulk.mutate(ids, status);
    if (res)
      toast({
        tone: 'success',
        title: t('Comments updated: {count}', { count: res.updated }),
        description: modeText(
          t('New status: {status} (sample data)', { status: t(statusMeta[status].label) }),
          t('New status: {status}', { status: t(statusMeta[status].label) }),
        ),
      });
    return res;
  };

  const openLead = (leadId: string) => navigate(`/leads?lead=${encodeURIComponent(leadId)}`);

  /**
   * Converts a comment to a lead (one atomic, idempotent request in api mode). If the commenter is
   * already a lead, the comment is linked to that lead and it is opened — no duplicate is created.
   * Returns the newly created lead, or undefined when an existing lead was linked/opened.
   */
  const convertToLead = async (comment: InstagramComment, existing: Lead | undefined): Promise<Lead | undefined> => {
    if (!comment.campaignId && !existing) {
      toast({ tone: 'warning', title: t('Cannot make a lead'), description: t('This comment is not linked to a campaign.') });
      return undefined;
    }
    const result = await convert.mutate(comment.id);
    if (!result) return undefined;
    if (!result.created) {
      toast({ tone: 'info', title: t('{name} is already a lead', { name: result.lead.name }), description: t('Linked this comment to that lead. No duplicate was made.') });
      openLead(result.lead.id);
      return undefined;
    }
    toast({
      tone: 'success',
      title: t('Lead created: {name}', { name: result.lead.name }),
      description: modeText(t('Added to Leads as “New” (sample data).'), t('Added to Leads as “New”.')),
    });
    return result.lead;
  };

  return {
    setStatus,
    toggleFlag,
    bulkSetStatus,
    convertToLead,
    openLead,
    isPending: update.isPending || bulk.isPending || convert.isPending,
    isConverting: convert.isPending,
  };
}
