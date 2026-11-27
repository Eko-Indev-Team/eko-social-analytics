import { useState } from 'react';
import { useAuth } from '@/app/AuthContext';
import { Button } from '@/components/ui/Button';
import { Select, TextInput } from '@/components/ui/Controls';
import { useToast } from '@/components/ui/Toast';
import { QualificationBadge, qualificationLabel, ReasonList } from '@/features/ads/QualificationBadge';
import { useMutation } from '@/hooks/useMutation';
import { useT } from '@/i18n/I18nContext';
import { modeText } from '@/lib/config';
import type { QualificationStatus } from '@/lib/qualification';
import { leadService } from '@/services/leads';
import type { Lead, LeadQualificationPatch } from '@/types/domain';

type Tri = '' | 'yes' | 'no';
const toTri = (v: boolean | undefined): Tri => (v === undefined ? '' : v ? 'yes' : 'no');

/**
 * SBI / ESAF fit of an SocialBoard lead: the status badge with plain-word reasons, and (for editors) the answers that
 * decide it: pincode, education, can invest and the ESAF answer. The status is recomputed after saving.
 */
export function LeadQualification({ lead }: { lead: Lead }) {
  const t = useT();
  const toast = useToast();
  const { can } = useAuth();
  const editable = can('write');
  const [pincode, setPincode] = useState(lead.pincode ?? '');
  const [education, setEducation] = useState(lead.educationAnswer ?? '');
  const [invest, setInvest] = useState<Tri>(toTri(lead.canInvest));
  const [esaf, setEsaf] = useState<Tri>(lead.esafResponse ?? '');

  const pinValid = pincode === '' || /^\d{6}$/.test(pincode);
  const patch: LeadQualificationPatch = {};
  if (pincode !== (lead.pincode ?? '')) patch.pincode = pincode || null;
  if (education.trim() !== (lead.educationAnswer ?? '')) patch.educationAnswer = education.trim() || null;
  if (invest !== toTri(lead.canInvest)) patch.canInvest = invest === '' ? null : invest === 'yes';
  if (esaf !== (lead.esafResponse ?? '')) patch.esafResponse = esaf || null;
  const changed = Object.keys(patch).length > 0;

  const save = useMutation((p: LeadQualificationPatch) => leadService.updateQualification(lead.id, p), {
    invalidate: ['leads'],
    onSuccess: (l) =>
      toast({
        title: l.qualificationStatus
          ? t('Fit is now: {status}', { status: t(qualificationLabel(l.qualificationStatus as QualificationStatus)) })
          : t('Saved'),
        description: modeText(t('Saved for this browser session (sample data).'), t('Saved.')),
      }),
    onError: (e) => toast({ tone: 'error', title: t('Could not save'), description: e.message }),
  });

  return (
    <section className="p-3 rounded bg-surface-canvas border border-border-strong space-y-3" aria-label={t('SBI / ESAF fit')}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="font-bold text-text-primary">{t('SBI / ESAF fit')}</h4>
        <QualificationBadge status={lead.qualificationStatus} />
      </div>
      {lead.qualificationStatus && <ReasonList status={lead.qualificationStatus} reasons={lead.sbiReasons ?? []} className="block" />}
      {editable ? (
        <form
          className="grid grid-cols-2 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (changed && pinValid) void save.mutate(patch);
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-text-secondary">{t('Pincode')}</span>
            <TextInput
              value={pincode}
              inputMode="numeric"
              maxLength={6}
              invalid={!pinValid}
              placeholder="273001"
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
              className="h-8 text-xs"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-text-secondary">{t('Education')}</span>
            <TextInput value={education} maxLength={200} placeholder={t('For example: 12th pass')} onChange={(e) => setEducation(e.target.value)} className="h-8 text-xs" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-text-secondary">{t('Can invest?')}</span>
            <Select value={invest} onChange={(e) => setInvest(e.target.value as Tri)} className="h-8 text-xs">
              <option value="">{t('Not known')}</option>
              <option value="yes">{t('Yes')}</option>
              <option value="no">{t('No')}</option>
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-text-secondary">{t('Said yes to ESAF?')}</span>
            <Select value={esaf} onChange={(e) => setEsaf(e.target.value as Tri)} className="h-8 text-xs">
              <option value="">{t('Not asked yet')}</option>
              <option value="yes">{t('Yes')}</option>
              <option value="no">{t('No')}</option>
            </Select>
          </label>
          {!pinValid && <p className="col-span-2 text-error">{t('A pincode has 6 digits.')}</p>}
          {lead.educationAnswer && <p className="col-span-2 text-text-tertiary">{t('Read as: {level}', { level: lead.educationLevel ?? t('Not known') })}</p>}
          <div className="col-span-2 flex justify-end">
            <Button type="submit" size="xs" disabled={!changed || !pinValid} loading={save.isPending}>
              {t('Save answers')}
            </Button>
          </div>
        </form>
      ) : (
        <dl className="grid grid-cols-2 gap-1 text-text-secondary">
          <dt>{t('Pincode')}</dt>
          <dd className="text-text-primary">{lead.pincode ?? '—'}</dd>
          <dt>{t('Education')}</dt>
          <dd className="text-text-primary">{lead.educationLevel ?? lead.educationAnswer ?? '—'}</dd>
          <dt>{t('Can invest?')}</dt>
          <dd className="text-text-primary">{lead.canInvest === undefined ? '—' : lead.canInvest ? t('Yes') : t('No')}</dd>
          <dt>{t('Said yes to ESAF?')}</dt>
          <dd className="text-text-primary">{lead.esafResponse === 'yes' ? t('Yes') : lead.esafResponse === 'no' ? t('No') : '—'}</dd>
        </dl>
      )}
    </section>
  );
}
