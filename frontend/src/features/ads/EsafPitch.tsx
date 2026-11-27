import { useAuth } from '@/app/AuthContext';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { isDemoMode } from '@/lib/config';
import type { EsafResponse } from '@/lib/qualification';
import { useMutation } from '@/hooks/useMutation';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { adsService } from '@/services/ads';
import type { AdLead } from '@/types/ads';
import { qualificationLabel } from './QualificationBadge';

/**
 * "Pitch ESAF" answer for an ad lead: Yes / No / clear. Saves `PATCH /ads/leads/{id}` (write permission);
 * the API recomputes the lead's status. Read-only text for viewers.
 */
export function EsafPitchControl({ lead, compact }: { lead: AdLead; compact?: boolean }) {
  const t = useT();
  const toast = useToast();
  const { can } = useAuth();
  const save = useMutation((value: EsafResponse) => adsService.updateLead(lead.id, { esafResponse: value }), {
    invalidate: ['ads:'],
    onSuccess: (updated) =>
      toast({
        tone: isDemoMode ? 'demo' : 'success',
        title: t('ESAF answer saved'),
        description: t('Status is now: {status}', { status: t(qualificationLabel(updated.qualificationStatus)) }),
      }),
    onError: (e) => toast({ tone: 'error', title: t('Could not save the ESAF answer'), description: e.message }),
  });

  const current = lead.esafResponse;
  const answerText = current === 'yes' ? t('Said yes to ESAF') : current === 'no' ? t('Said no to ESAF') : t('ESAF not pitched yet');

  if (!can('write')) return <span className="text-[0.75rem] text-text-tertiary">{answerText}</span>;

  // Below 12th fails ESAF too, so there is nothing to pitch (unless an answer was already recorded).
  if (lead.educationOk === false && !current) return <span className="text-[0.75rem] text-text-tertiary">{t('No ESAF pitch (below 12th)')}</span>;

  const option = (value: 'yes' | 'no', label: string, icon: string) => {
    const active = current === value;
    return (
      <button
        type="button"
        aria-pressed={active}
        disabled={save.isPending}
        onClick={(e) => {
          e.stopPropagation();
          void save.mutate(active ? null : value);
        }}
        title={active ? t('Click again to clear') : undefined}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.75rem] font-semibold transition-colors disabled:opacity-60',
          active
            ? value === 'yes'
              ? 'bg-status-active-subtle border-status-active/50 text-status-active'
              : 'bg-error-container border-error/40 text-error'
            : 'border-border-strong text-text-secondary hover:text-text-primary hover:bg-surface-canvas',
        )}
      >
        <Icon name={icon} className="text-[0.875rem]" />
        {label}
      </button>
    );
  };

  return (
    <div className={cn('flex items-center gap-1.5', compact ? 'flex-nowrap' : 'flex-wrap')} role="group" aria-label={t('ESAF answer for {name}', { name: lead.name ?? lead.id })}>
      {!compact && <span className="text-[0.75rem] text-text-secondary mr-1">{t('ESAF pitch:')}</span>}
      {option('yes', t('Yes'), 'thumb_up')}
      {option('no', t('No'), 'thumb_down')}
      {lead.esafResponseSource === 'form' && current && <span className="text-[0.6875rem] text-text-tertiary">{t('from the form')}</span>}
    </div>
  );
}
