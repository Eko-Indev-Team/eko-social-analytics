import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { DemoBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/Misc';
import { useT } from '@/i18n/I18nContext';
import { isDemoMode } from '@/lib/config';
import type { ReportDetail } from '@/types/reports';
import { ReportStatusBadge, ReportTypeBadge } from '../ReportBadges';

export interface ReportHeaderActions {
  onEdit: () => void;
  onRegenerate: () => void;
  onCsv: () => void;
  onPrint: () => void;
  onXlsx: () => void;
  onExportOptions: () => void;
}

/** Back link, report name, a few chips, one meta line, and two buttons (More, Download). */
export function ReportDetailHeader({ detail, progress, actions }: { detail: ReportDetail; progress: number | null; actions: ReportHeaderActions }) {
  const t = useT();
  const { report, computed } = detail;
  const regenerating = progress !== null;
  return (
    <div className="space-y-4">
      <Link className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary text-label-md font-semibold print:hidden" to="/reports">
        <Icon name="arrow_back" className="text-[1rem]" />
        {t('Reports')}
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-[1.75rem] leading-9 font-bold text-text-primary">{report.title}</h1>
            <ReportTypeBadge type={report.type} />
            <ReportStatusBadge status={report.status} />
            {isDemoMode && <DemoBadge />}
          </div>
          <div className="flex flex-wrap items-center gap-y-1 gap-x-2 text-body-sm text-text-secondary">
            <span className="tnum" title={t('Report number')}>
              {report.code}
            </span>
            <span className="text-text-tertiary" aria-hidden>
              ·
            </span>
            <span className="tnum">{computed.periodLabel}</span>
            <span className="text-text-tertiary" aria-hidden>
              ·
            </span>
            <Link to={`/accounts/${report.accountId}`} className="hover:text-text-primary hover:underline">
              @ekoindia
            </Link>
            <span className="text-text-tertiary" aria-hidden>
              ·
            </span>
            <span className="inline-flex flex-wrap items-center gap-1">
              {report.scope === 'account' && <span>{t('Whole account')}</span>}
              {report.scope !== 'account' &&
                computed.campaigns.map((c, i) => (
                  <Fragment key={c.id}>
                    <Link to={`/campaigns/${c.id}`} className="underline decoration-border-strong hover:text-text-primary">
                      {c.name}
                    </Link>
                    {i < computed.campaigns.length - 1 && ','}
                  </Fragment>
                ))}
              {report.scope !== 'account' && computed.campaigns.length === 0 && <span>{t('No campaigns with data')}</span>}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
          <Dropdown
            label={t('More actions')}
            trigger={({ toggle, open }) => (
              <Button onClick={toggle} aria-expanded={open} aria-haspopup="menu" iconRight="expand_more" className="h-9" disabled={regenerating}>
                {t('More')}
              </Button>
            )}
          >
            {(close) => (
              <>
                <MenuItem icon="tune" onClick={() => (close(), actions.onEdit())}>
                  {t('Edit settings')}
                </MenuItem>
                <MenuItem icon="refresh" onClick={() => (close(), actions.onRegenerate())}>
                  {t('Update numbers')}
                </MenuItem>
              </>
            )}
          </Dropdown>
          <Dropdown
            label={t('Download report')}
            className="min-w-[15rem]"
            trigger={({ toggle, open }) => (
              <Button variant="primary" size="md" icon="download" iconRight="expand_more" onClick={toggle} aria-expanded={open} aria-haspopup="menu">
                {t('Download')}
              </Button>
            )}
          >
            {(close) => (
              <>
                <MenuItem icon="csv" onClick={() => (close(), actions.onCsv())}>
                  {t('CSV file')}
                </MenuItem>
                <MenuItem icon="picture_as_pdf" onClick={() => (close(), actions.onPrint())}>
                  {t('Print or save as PDF')}
                </MenuItem>
                <MenuItem icon="table_view" onClick={() => (close(), actions.onXlsx())}>
                  {t('Excel file (not available yet)')}
                </MenuItem>
                <div className="border-t border-border-subtle my-1" />
                <MenuItem icon="tune" onClick={() => (close(), actions.onExportOptions())}>
                  {t('Download options…')}
                </MenuItem>
              </>
            )}
          </Dropdown>
        </div>
      </div>
      {regenerating && (
        <div className="space-y-1 print:hidden" aria-live="polite">
          <div className="flex justify-between text-body-sm text-text-secondary">
            <span>{t('Updating numbers…')}</span>
            <span className="tnum">{Math.round(progress)}%</span>
          </div>
          <ProgressBar value={progress} label={t('Update progress')} />
        </div>
      )}
    </div>
  );
}
