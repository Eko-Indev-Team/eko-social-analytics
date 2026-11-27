import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { DemoBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { useToast } from '@/components/ui/Toast';
import { useT } from '@/i18n/I18nContext';
import { exportAudienceReport } from './exportAudienceReport';
import type { AudiencePageData } from './model';

/** Title, a small "Sample data" cue, Export and a "More" menu with the page links. */
export function AudienceHeader({ data }: { data: AudiencePageData | undefined }) {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  return (
    <PageHeader
      title={t('Audience')}
      titleAddon={<DemoBadge />}
      description={t('Who sees your posts and who follows you.')}
      actions={
        <>
          <Button
            icon="file_download"
            disabled={!data}
            onClick={() => {
              if (!data) return;
              exportAudienceReport(data);
              toast({ tone: 'demo', title: t('Audience report downloaded'), description: t('CSV file made from sample data.') });
            }}
          >
            {t('Export')}
          </Button>
          <Dropdown
            label={t('More')}
            trigger={({ open, toggle }) => (
              <Button icon="more_horiz" onClick={toggle} aria-expanded={open} aria-haspopup="menu">
                {t('More')}
              </Button>
            )}
          >
            {(close) => (
              <>
                <MenuItem
                  icon="campaign"
                  onClick={() => {
                    close();
                    navigate('/campaigns');
                  }}
                >
                  {t('View campaigns')}
                </MenuItem>
                <MenuItem
                  icon="person_add"
                  onClick={() => {
                    close();
                    navigate('/leads');
                  }}
                >
                  {t('View leads')}
                </MenuItem>
              </>
            )}
          </Dropdown>
        </>
      }
    />
  );
}
