import { PageHeader } from '@/components/layout/PageHeader';
import { CampaignStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { useT } from '@/i18n/I18nContext';
import type { Campaign } from '@/types/domain';
import { campaignDurationLabel, OBJECTIVE_LABEL } from '../campaignUtils';

/** Breadcrumb, name + status, one line with goal and dates, then Edit, the status action and a "More" menu. */
export function CampaignDetailHeader({
  campaign,
  onEdit,
  onToggleStatus,
  onSchedule,
  onExport,
  onNewContent,
  statusPending,
}: {
  campaign: Campaign;
  onEdit: () => void;
  onToggleStatus: () => void;
  onSchedule: () => void;
  onExport: () => void;
  onNewContent: () => void;
  statusPending: boolean;
}) {
  const t = useT();
  const canToggle = campaign.status === 'active' || campaign.status === 'paused';
  const dates = campaign.startDate || campaign.endDate ? campaignDurationLabel(campaign, t) : t('No dates yet');
  return (
    <PageHeader
      className="pb-2"
      breadcrumbs={[{ label: t('Campaigns'), to: '/campaigns' }, { label: campaign.name }]}
      title={campaign.name}
      titleAddon={<CampaignStatusBadge status={campaign.status} />}
      description={`${t(OBJECTIVE_LABEL[campaign.objective])} · ${dates}`}
      actions={
        <>
          {canToggle && (
            <Button size="md" icon={campaign.status === 'active' ? 'pause' : 'play_arrow'} onClick={onToggleStatus} loading={statusPending}>
              {campaign.status === 'active' ? t('Pause') : t('Resume')}
            </Button>
          )}
          {campaign.status === 'draft' && (
            <Button size="md" icon="event" onClick={onSchedule} loading={statusPending}>
              {t('Schedule')}
            </Button>
          )}
          <Button variant="primary" size="md" icon="edit" onClick={onEdit}>
            {t('Edit')}
          </Button>
          <Dropdown
            label={t('More actions')}
            trigger={({ open, toggle }) => (
              <Button size="icon" icon="more_horiz" onClick={toggle} aria-label={t('More actions')} aria-haspopup="menu" aria-expanded={open} className="h-10 w-10" />
            )}
          >
            {(close) => (
              <>
                <MenuItem icon="ios_share" onClick={() => (close(), onExport())}>
                  {t('Open report')}
                </MenuItem>
                <MenuItem icon="add" onClick={() => (close(), onNewContent())}>
                  {t('Add a post')}
                </MenuItem>
              </>
            )}
          </Dropdown>
        </>
      }
    />
  );
}
