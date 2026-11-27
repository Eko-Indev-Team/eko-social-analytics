import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Overlay';
import { Notice } from '@/components/ui/Misc';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { cn, formatNumber } from '@/lib/format';
import { accountService } from '@/services/accounts';
import { campaignService, type NewCampaignInput } from '@/services/campaigns';
import { AccountFields, AudienceFields, BasicsFields } from './CampaignFormFields';
import {
  campaignDurationLabel,
  emptyCampaignForm,
  OBJECTIVE_LABEL,
  optionalNumber,
  parseHashtags,
  validateCampaignForm,
  type CampaignFormErrors,
  type CampaignFormValues,
} from './campaignUtils';

const STEPS = [msg('Basics'), msg('Account'), msg('Audience'), msg('Check & save')];

const STEP1_FIELDS: Array<keyof CampaignFormValues> = ['name', 'startDate', 'endDate', 'budget', 'leadGoal'];

/** Global "New campaign" wizard (sidebar / dashboard / campaigns page). State resets every time it closes. */
export function CreateCampaignModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <CampaignWizard onClose={onClose} /> : null;
}

function CampaignWizard({ onClose }: { onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const accountsQ = useQuery('accounts:list', accountService.list);
  const accounts = accountsQ.data ?? [];
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<CampaignFormValues>(() => emptyCampaignForm());
  const [errors, setErrors] = useState<CampaignFormErrors>({});

  // Default to the first connected account once accounts load.
  useEffect(() => {
    if (values.accountId || accounts.length === 0) return;
    const first = accounts.find((a) => a.status === 'connected');
    if (first) setValues((v) => ({ ...v, accountId: first.id }));
  }, [accounts, values.accountId]);

  const create = useMutation((input: NewCampaignInput) => campaignService.create(input), { invalidate: ['campaigns'] });

  const onChange = (patch: Partial<CampaignFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch) as Array<keyof CampaignFormValues>) delete next[k];
      return next;
    });
  };

  const validateStep = (s: number) => {
    const all = validateCampaignForm(values, { requireAccount: s >= 2 });
    const relevant: CampaignFormErrors = {};
    if (s === 1) STEP1_FIELDS.forEach((k) => all[k] && (relevant[k] = all[k]));
    if (s === 2 && all.accountId) relevant.accountId = all.accountId;
    setErrors(relevant);
    return Object.keys(relevant).length === 0;
  };

  const next = () => validateStep(step) && setStep((s) => Math.min(STEPS.length, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const save = async (status: NewCampaignInput['status']) => {
    const errs = validateCampaignForm(values, { requireDates: status === 'scheduled', requireAccount: true });
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setStep(errs.accountId && !STEP1_FIELDS.some((k) => errs[k]) ? 2 : 1);
      return;
    }
    const created = await create.mutate({
      name: values.name.trim(),
      objective: values.objective,
      startDate: values.startDate,
      endDate: values.endDate,
      accountId: values.accountId,
      targetRegions: values.targetRegions,
      hashtags: parseHashtags(values.hashtags),
      budgetInr: optionalNumber(values.budget),
      leadGoal: optionalNumber(values.leadGoal),
      primaryAgeGroup: values.primaryAgeGroup || undefined,
      status,
    });
    if (!created) {
      toast({ tone: 'error', title: t('Could not save the campaign'), description: t('Please try again.') });
      return;
    }
    toast({
      tone: 'demo',
      title: status === 'draft' ? t('Draft "{name}" saved', { name: created.name }) : t('"{name}" scheduled', { name: created.name }),
      description: t('Saved in SocialBoard only. Nothing was posted to Instagram.'),
    });
    onClose();
    navigate(`/campaigns/${created.id}`);
  };

  const account = accounts.find((a) => a.id === values.accountId);
  const tags = parseHashtags(values.hashtags);

  const footer = (
    <div className="w-full flex items-center justify-between gap-2 flex-wrap">
      <Button size="sm" onClick={back} disabled={step === 1 || create.isPending}>
        {t('Back')}
      </Button>
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="ghost" onClick={onClose} disabled={create.isPending}>
          {t('Cancel')}
        </Button>
        {step < STEPS.length ? (
          <Button size="sm" variant="primary" onClick={next}>
            {t('Next')} →
          </Button>
        ) : (
          <>
            <Button size="sm" onClick={() => save('draft')} loading={create.isPending} icon="draft">
              {t('Save as draft')}
            </Button>
            <Button size="sm" variant="primary" onClick={() => save('scheduled')} loading={create.isPending} icon="event">
              {t('Schedule')}
            </Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <Modal open onClose={onClose} size="lg" title={t('New campaign')} subtitle={t('Step {step} of {total}: {name}', { step, total: STEPS.length, name: t(STEPS[step - 1]) })} footer={footer}>
      <ol className="grid grid-cols-4 border-b border-border-strong text-center text-[0.6875rem] font-semibold -mx-5 -mt-4 mb-5" aria-label={t('Steps')}>
        {STEPS.map((s, i) => {
          const n = i + 1;
          return (
            <li
              key={s}
              aria-current={n === step ? 'step' : undefined}
              className={cn(
                'py-2',
                n < step && 'bg-emerald-900/40 text-status-active font-bold border-b-2 border-emerald-500',
                n === step && 'bg-amber-900/40 text-text-primary font-bold border-b-2 border-primary-container',
                n > step && 'text-text-tertiary',
              )}
            >
              {n}. {t(s)}
            </li>
          );
        })}
      </ol>

      {step === 1 && <BasicsFields values={values} errors={errors} onChange={onChange} autoFocus />}

      {step === 2 &&
        (accountsQ.status === 'loading' ? (
          <Skeleton className="h-32" />
        ) : (
          <div className="space-y-4">
            <AccountFields values={values} errors={errors} onChange={onChange} accounts={accounts} />
            <p className="text-body-sm text-text-secondary flex items-center gap-1.5">
              <Icon name="tag" className="text-[1rem] text-text-tertiary" />
              {t('Posts join the campaign when they use its hashtags.')}
            </p>
          </div>
        ))}

      {step === 3 && <AudienceFields values={values} onChange={onChange} />}

      {step === 4 && (
        <div className="space-y-3">
          <dl className="p-4 rounded-xl bg-surface-canvas space-y-2.5 text-body-sm">
            <ReviewRow label={t('Name')}>{values.name.trim()}</ReviewRow>
            <ReviewRow label={t('Goal')}>{t(OBJECTIVE_LABEL[values.objective])}</ReviewRow>
            <ReviewRow label={t('Dates')}>
              {values.startDate || values.endDate ? campaignDurationLabel({ startDate: values.startDate || null, endDate: values.endDate || null }, t) : t('Not set (needed to schedule)')}
            </ReviewRow>
            <ReviewRow label={t('Account')}>{account ? `${account.displayName} (@${account.handle})` : '—'}</ReviewRow>
            <ReviewRow label={t('States')}>{values.targetRegions.length ? values.targetRegions.join(', ') : t('All states')}</ReviewRow>
            <ReviewRow label={t('Age group')}>{values.primaryAgeGroup ? t(values.primaryAgeGroup) : t('Not set')}</ReviewRow>
            <ReviewRow label={t('Hashtags')}>{tags.length ? tags.join(' ') : t('None')}</ReviewRow>
            <ReviewRow label={t('Budget')}>{values.budget ? `₹${formatNumber(Number(values.budget))}` : t('Not set')}</ReviewRow>
            <ReviewRow label={t('Lead target')} highlight>
              {values.leadGoal ? formatNumber(Number(values.leadGoal)) : t('Not set')}
            </ReviewRow>
          </dl>
          <Notice tone="demo">{t('Saved in SocialBoard only. Nothing is posted to Instagram.')}</Notice>
        </div>
      )}
    </Modal>
  );
}

function ReviewRow({ label, children, highlight }: { label: string; children: ReactNode; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-text-secondary shrink-0">{label}</dt>
      <dd className={cn('font-semibold text-right min-w-0 break-words', highlight ? 'text-primary' : 'text-text-primary')}>{children}</dd>
    </div>
  );
}
