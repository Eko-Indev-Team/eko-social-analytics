import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { accountService } from '@/services/accounts';
import { campaignService, type CampaignUpdateInput } from '@/services/campaigns';
import type { Campaign } from '@/types/domain';
import { AccountFields, AudienceFields, BasicsFields } from './CampaignFormFields';
import { formFromCampaign, optionalNumber, parseHashtags, validateCampaignForm, type CampaignFormErrors, type CampaignFormValues } from './campaignUtils';

/** Edit Campaign modal (detail header, quick-view drawer, table row menu). Saves to the in-memory store only. */
export function EditCampaignModal({ campaign, onClose }: { campaign: Campaign | null; onClose: () => void }) {
  return campaign ? <EditForm key={campaign.id} campaign={campaign} onClose={onClose} /> : null;
}

function EditForm({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const accountsQ = useQuery('accounts:list', accountService.list);
  // Keep the campaign's current account selectable even if it is no longer connected.
  const accounts = (accountsQ.data ?? []).map((a) => (a.id === campaign.accountId ? { ...a, status: 'connected' as const } : a));
  const [values, setValues] = useState<CampaignFormValues>(() => formFromCampaign(campaign));
  const [errors, setErrors] = useState<CampaignFormErrors>({});
  const requireDates = campaign.status !== 'draft';

  const update = useMutation((patch: CampaignUpdateInput) => campaignService.update(campaign.id, patch), { invalidate: ['campaigns'] });

  const onChange = (patch: Partial<CampaignFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch) as Array<keyof CampaignFormValues>) delete next[k];
      return next;
    });
  };

  const submit = async () => {
    const errs = validateCampaignForm(values, { requireDates, requireAccount: true });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const saved = await update.mutate({
      name: values.name.trim(),
      objective: values.objective,
      startDate: values.startDate || null,
      endDate: values.endDate || null,
      accountId: values.accountId,
      targetRegions: values.targetRegions,
      hashtags: parseHashtags(values.hashtags),
      budgetInr: optionalNumber(values.budget),
      leadGoal: optionalNumber(values.leadGoal),
      primaryAgeGroup: values.primaryAgeGroup || undefined,
    });
    if (!saved) {
      toast({ tone: 'error', title: t('Could not save changes'), description: t('Please try again.') });
      return;
    }
    toast({ tone: 'demo', title: t('Campaign saved'), description: t('Changed in SocialBoard only, not on Instagram.') });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon="edit"
      title={t('Edit campaign')}
      subtitle={`${campaign.code} · ${campaign.name}`}
      footer={
        <>
          <Button onClick={onClose} disabled={update.isPending}>
            {t('Cancel')}
          </Button>
          <Button variant="primary" onClick={submit} loading={update.isPending} icon="save">
            {t('Save')}
          </Button>
        </>
      }
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
      >
        <BasicsFields values={values} errors={errors} onChange={onChange} autoFocus />
        <div className="border-t border-border-strong pt-5">
          <AccountFields values={values} errors={errors} onChange={onChange} accounts={accounts} />
        </div>
        <div className="border-t border-border-strong pt-5">
          <AudienceFields values={values} onChange={onChange} />
        </div>
        {requireDates && <p className="text-[0.75rem] text-text-tertiary">{t('Start and end dates are needed for this campaign.')}</p>}
        <Notice tone="demo">{t('Changes stay in SocialBoard. Nothing changes on Instagram.')}</Notice>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
