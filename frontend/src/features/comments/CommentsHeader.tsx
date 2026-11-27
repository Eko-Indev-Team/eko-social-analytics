import { PageHeader } from '@/components/layout/PageHeader';
import { DemoBadge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { useT } from '@/i18n/I18nContext';

/** Title, one line, a "More" menu (bulk actions, quick reply mode, export) and the Leads link. */
export function CommentsHeader({
  selectedCount,
  onBulkStatus,
  onExport,
  onStartTriage,
}: {
  selectedCount: number;
  onBulkStatus: (status: 'reviewed' | 'archived') => void;
  onExport: () => void;
  onStartTriage: () => void;
}) {
  const t = useT();
  return (
    <PageHeader
      title={t('Comments')}
      titleAddon={<DemoBadge />}
      description={t('Read, sort and answer what people say.')}
      actions={
        <>
          <Dropdown
            label={t('More actions')}
            trigger={({ toggle, open }) => (
              <Button icon="more_horiz" onClick={toggle} aria-expanded={open} aria-haspopup="menu">
                {t('More')}
              </Button>
            )}
          >
            {(close) => (
              <>
                <div className="px-3 py-1.5 text-label-sm text-text-tertiary">
                  {selectedCount > 0 ? t('{count} selected', { count: selectedCount }) : t('Tick rows in the list to act on many at once')}
                </div>
                {selectedCount > 0 && (
                  <>
                    <MenuItem icon="done_all" onClick={() => (close(), onBulkStatus('reviewed'))}>
                      {t('Mark selected as reviewed')}
                    </MenuItem>
                    <MenuItem icon="archive" onClick={() => (close(), onBulkStatus('archived'))}>
                      {t('Archive selected')}
                    </MenuItem>
                  </>
                )}
                <MenuItem icon="play_arrow" onClick={() => (close(), onStartTriage())}>
                  {t('Reply to the most important first')}
                </MenuItem>
                <MenuItem icon="file_download" onClick={() => (close(), onExport())}>
                  {t('Export shown comments (CSV)')}
                </MenuItem>
              </>
            )}
          </Dropdown>
          <LinkButton to="/leads" variant="primary" size="md" iconRight="arrow_forward">
            {t('View leads')}
          </LinkButton>
        </>
      }
    />
  );
}
