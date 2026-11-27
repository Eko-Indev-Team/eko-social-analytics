import { campaignStatusLabel } from '@/components/ui/Badge';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { Campaign, CampaignStatus } from '@/types/domain';
import { STATUS_DOT, STATUS_ORDER } from './campaignUtils';

export type StatusFilter = 'all' | CampaignStatus;

const chip = (active: boolean) =>
  cn(
    'px-3 py-1.5 rounded-full text-label-md font-semibold flex items-center gap-1.5 shrink-0 transition-colors',
    active ? 'bg-primary-container text-on-primary-container shadow-sm' : 'bg-surface-card border border-border-strong text-text-secondary hover:text-text-primary',
  );

const count = (active: boolean) => cn('px-1.5 rounded-full text-[0.6875rem] tnum', active ? 'bg-white/20' : 'text-text-tertiary');

/** Status filter pills with live counts. */
export function CampaignStatusChips({ campaigns, value, onChange }: { campaigns: Campaign[]; value: StatusFilter; onChange: (v: StatusFilter) => void }) {
  const t = useT();
  const total = (s: CampaignStatus) => campaigns.filter((c) => c.status === s).length;
  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5" role="tablist" aria-label={t('Filter by status')}>
      <button type="button" role="tab" aria-selected={value === 'all'} onClick={() => onChange('all')} className={chip(value === 'all')}>
        <span>{t('All')}</span>
        <span className={count(value === 'all')}>{campaigns.length}</span>
      </button>
      {STATUS_ORDER.map((s) => {
        const active = value === s;
        return (
          <button key={s} type="button" role="tab" aria-selected={active} onClick={() => onChange(s)} className={chip(active)}>
            <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[s])} />
            <span>{t(campaignStatusLabel(s))}</span>
            <span className={count(active)}>{total(s)}</span>
          </button>
        );
      })}
    </div>
  );
}
