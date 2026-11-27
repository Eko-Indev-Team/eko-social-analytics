import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Overlay';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { ReportDetail, ReportSectionKey } from '@/types/reports';
import { reportCsvRows, toCsv } from '../reportCsv';

export type ExportFormat = 'pdf' | 'csv' | 'xlsx';

/** Component groups in the export modal → report sections they control in the print view. */
/** Labels are English source text (msg-marked), translated where rendered. */
export const exportComponents: Array<{ key: string; label: string; sections: ReportSectionKey[] }> = [
  { key: 'summary', label: msg('AI summary, key numbers and tips'), sections: ['summary', 'kpis', 'recommendations'] },
  { key: 'charts', label: msg('Charts'), sections: ['timeline', 'formats', 'audience'] },
  { key: 'tables', label: msg('Campaign and post tables'), sections: ['campaigns', 'creatives'] },
];

const formats: Array<{ value: ExportFormat; icon: string; title: string; sub: string }> = [
  { value: 'pdf', icon: 'picture_as_pdf', title: msg('PDF'), sub: msg('Print, then save as PDF') },
  { value: 'csv', icon: 'csv', title: msg('CSV'), sub: msg('Data for spreadsheets') },
  { value: 'xlsx', icon: 'table_view', title: msg('Excel'), sub: msg('Not available yet') },
];

/** "Download report" modal, with honest per-format behaviour. */
export function ExportModal({
  open,
  onClose,
  detail,
  onExport,
}: {
  open: boolean;
  onClose: () => void;
  detail: ReportDetail;
  onExport: (format: ExportFormat, excluded: ReportSectionKey[]) => void;
}) {
  const t = useT();
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [included, setIncluded] = useState<Record<string, boolean>>({ summary: true, charts: true, tables: true });
  useEffect(() => {
    if (open) setFormat('pdf');
  }, [open]);
  const csvBytes = new Blob([toCsv(reportCsvRows(detail))]).size;
  const excluded = exportComponents.filter((c) => !included[c.key]).flatMap((c) => c.sections);
  const info =
    format === 'csv'
      ? { text: t('File size: about {size} KB', { size: (csvBytes / 1024).toFixed(1) }), status: t('Made in your browser'), tone: 'text-status-active' }
      : format === 'pdf'
        ? { text: t('Opens the print window'), status: t('Choose “Save as PDF”'), tone: 'text-status-active' }
        : { text: t('Excel files need the server'), status: t('Not available yet'), tone: 'text-status-paused' };
  const action = format === 'csv' ? t('Download CSV') : format === 'pdf' ? t('Open print view') : t('Request Excel file');

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon="file_download"
      title={t('Download report')}
      subtitle={`${detail.report.title} · ${detail.report.code}`}
      footer={
        <>
          <Button onClick={onClose}>{t('Cancel')}</Button>
          <Button variant="primary" size="md" icon={format === 'xlsx' ? 'info' : 'download'} onClick={() => onExport(format, excluded)}>
            {action}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <span className="text-label-md text-text-primary font-semibold">{t('File type')}</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label={t('File type')}>
            {formats.map((f) => {
              const on = format === f.value;
              return (
                <label
                  key={f.value}
                  className={cn(
                    'relative flex flex-col p-3 rounded-lg cursor-pointer transition-all',
                    on ? 'border-2 border-primary-container bg-amber-900/20' : 'border border-border-strong hover:border-slate-700 bg-surface-card',
                  )}
                >
                  <input type="radio" className="sr-only" name="exportFormat" value={f.value} checked={on} onChange={() => setFormat(f.value)} />
                  <div className="flex items-center justify-between mb-1.5">
                    <Icon name={f.icon} className={cn('text-[1.25rem]', on ? 'text-brand-primary-hover' : 'text-text-tertiary')} />
                    {on && <span className="w-2 h-2 rounded-full bg-primary-container" />}
                  </div>
                  <span className="text-label-md font-semibold text-text-primary">{t(f.title)}</span>
                  <span className="text-[0.75rem] text-text-secondary leading-tight mt-0.5">{t(f.sub)}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="space-y-2.5">
          <span className="text-label-md text-text-primary font-semibold">{t('What to include')}</span>
          <div className="space-y-2 bg-surface-canvas p-3 rounded-lg">
            {exportComponents.map((c) => (
              <label key={c.key} className="flex items-center gap-2.5 text-xs text-text-primary cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-slate-700 text-text-primary focus:ring-0 w-4 h-4"
                  checked={included[c.key]}
                  onChange={(e) => setIncluded((s) => ({ ...s, [c.key]: e.target.checked }))}
                />
                <span className="font-medium">{t(c.label)}</span>
              </label>
            ))}
            {format === 'csv' && <p className="text-[0.6875rem] text-text-tertiary">{t('A CSV always has totals, campaigns and posts.')}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-surface-card-subtle text-body-sm">
          <span className="text-text-secondary">{info.text}</span>
          <span className={cn('inline-flex items-center gap-1 font-bold', info.tone)}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {info.status}
          </span>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Print-friendly layout while the report page is mounted: only the report canvas prints (app chrome,
 * preview bar and action buttons are hidden), and sections unticked in the export modal are dropped.
 */
export function PrintStyles({ excluded }: { excluded: ReportSectionKey[] }) {
  const hide = excluded.map((s) => `[data-print-section="${s}"]`).join(',');
  return (
    <style>{`@media print {
  @page { margin: 12mm; }
  body * { visibility: hidden !important; }
  #report-print-root, #report-print-root * { visibility: visible !important; }
  #report-print-root { position: absolute; left: 0; top: 0; width: 100%; }
  #report-print-root .print\\:hidden { display: none !important; }
  #report-print-root > * { break-inside: avoid; }
  ${hide ? `${hide} { display: none !important; }` : ''}
}`}</style>
  );
}
