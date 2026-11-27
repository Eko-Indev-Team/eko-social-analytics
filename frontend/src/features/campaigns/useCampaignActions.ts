import { useNavigate } from 'react-router-dom';
import { useMutation } from '@/hooks/useMutation';
import { useToast } from '@/components/ui/Toast';
import { useT } from '@/i18n/I18nContext';
import { campaignService } from '@/services/campaigns';
import type { Campaign, CampaignStatus } from '@/types/domain';

/** Pause / resume / duplicate actions shared by the campaigns table, quick-view drawer and detail page. */
export function useCampaignActions() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();

  const statusMutation = useMutation((ids: string[], status: CampaignStatus) => Promise.all(ids.map((id) => campaignService.setStatus(id, status))), {
    invalidate: ['campaigns', 'activity'],
    onError: (e) => toast({ tone: 'error', title: t('Could not change the status'), description: e.message }),
  });

  const duplicateMutation = useMutation(
    (c: Campaign) =>
      campaignService.create({
        name: `${c.name} (Copy)`,
        objective: c.objective,
        startDate: c.startDate ?? '',
        endDate: c.endDate ?? '',
        accountId: c.accountId,
        targetRegions: c.targetRegions,
        hashtags: c.hashtags,
        budgetInr: c.budgetInr,
        leadGoal: c.leadGoal,
        primaryAgeGroup: c.primaryAgeGroup,
        status: 'draft',
      }),
    { invalidate: ['campaigns', 'activity'], onError: (e) => toast({ tone: 'error', title: t('Could not copy the campaign'), description: e.message }) },
  );

  /** Toggles active ⇄ paused for one or many campaigns; others are skipped. */
  const setStatus = async (targets: Campaign[], status: 'active' | 'paused') => {
    const from: CampaignStatus = status === 'paused' ? 'active' : 'paused';
    const eligible = targets.filter((c) => c.status === from);
    if (eligible.length === 0) {
      toast({
        tone: 'info',
        title: status === 'paused' ? t('Nothing to pause') : t('Nothing to resume'),
        description: status === 'paused' ? t('Only running campaigns can be paused.') : t('Only paused campaigns can be resumed.'),
      });
      return false;
    }
    const result = await statusMutation.mutate(
      eligible.map((c) => c.id),
      status,
    );
    if (!result) return false; // the error toast (with the server's reason) was already shown
    const skipped = targets.length - eligible.length;
    const one = eligible.length === 1;
    const title =
      status === 'paused'
        ? one
          ? t('"{name}" paused', { name: eligible[0].name })
          : t('Campaigns paused: {count}', { count: eligible.length })
        : one
          ? t('"{name}" resumed', { name: eligible[0].name })
          : t('Campaigns resumed: {count}', { count: eligible.length });
    const note = t('Changed in SocialBoard only, not on Instagram.');
    toast({
      tone: 'demo',
      title,
      description: skipped > 0 ? `${note} ${t('Skipped: {count}', { count: skipped })}` : note,
    });
    return true;
  };

  const duplicate = async (c: Campaign, opts: { open?: boolean } = {}) => {
    const created = await duplicateMutation.mutate(c);
    if (!created) return;
    toast({ tone: 'demo', title: t('Draft "{name}" created', { name: created.name }), description: t('Saved in SocialBoard only. Nothing was posted to Instagram.') });
    if (opts.open) navigate(`/campaigns/${created.id}`);
    return created;
  };

  return { setStatus, duplicate, statusPending: statusMutation.isPending, duplicatePending: duplicateMutation.isPending };
}
