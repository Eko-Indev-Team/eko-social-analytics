import { Button } from '@/components/ui/Button';
import { useT } from '@/i18n/I18nContext';
import type { Campaign } from '@/types/domain';

/** Bulk actions for selected rows (pause / resume in SocialBoard only, CSV download). */
export function CampaignsBulkBar({
  selected,
  pending,
  onPause,
  onResume,
  onExport,
  onClear,
}: {
  selected: Campaign[];
  pending: boolean;
  onPause: () => void;
  onResume: () => void;
  onExport: () => void;
  onClear: () => void;
}) {
  const t = useT();
  const canPause = selected.some((c) => c.status === 'active');
  const canResume = selected.some((c) => c.status === 'paused');
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-surface-card border border-primary-container/50 shadow-card"
      role="region"
      aria-label={t('Bulk actions')}
    >
      <span className="text-label-md text-text-primary font-semibold tnum">{t('Selected: {count}', { count: selected.length })}</span>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="xs" icon="pause" onClick={onPause} disabled={!canPause || pending} title={canPause ? undefined : t('No running campaigns selected')}>
          {t('Pause')}
        </Button>
        <Button size="xs" icon="play_arrow" onClick={onResume} disabled={!canResume || pending} title={canResume ? undefined : t('No paused campaigns selected')}>
          {t('Resume')}
        </Button>
        <Button size="xs" icon="file_download" onClick={onExport}>
          {t('Download CSV')}
        </Button>
        <Button size="xs" variant="ghost" icon="close" onClick={onClear}>
          {t('Clear')}
        </Button>
      </div>
    </div>
  );
}
