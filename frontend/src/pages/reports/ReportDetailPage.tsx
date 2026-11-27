import { modeText } from '@/lib/config';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppUi } from '@/app/AppUiContext';
import { LinkButton } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Misc';
import { EmptyState, ErrorState, PageSkeleton, QueryState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { NotFoundError } from '@/lib/api/source';
import { reportService } from '@/services/reports';
import { ReportDetailHeader } from '@/features/reports/detail/ReportDetailHeader';
import { ExecutiveSummary } from '@/features/reports/detail/ExecutiveSummary';
import { KpiStrip } from '@/features/reports/detail/KpiStrip';
import { FormatEfficiencyCard, TimelineCard } from '@/features/reports/detail/ReportCharts';
import { CampaignBreakdownTable, CreativesTable } from '@/features/reports/detail/ReportTables';
import { AiRecommendations, AudienceSection } from '@/features/reports/detail/ReportInsights';
import { ExportModal, PrintStyles, type ExportFormat } from '@/features/reports/detail/ReportExport';
import { ReportConfigDrawer } from '@/features/reports/ReportConfigDrawer';
import { downloadReportCsv } from '@/features/reports/reportCsv';
import { pickConfig } from '@/features/reports/reportOptions';
import type { ReportConfig, ReportDetail, ReportSectionKey } from '@/types/reports';

function StatusNotice({ detail, onRegenerate }: { detail: ReportDetail; onRegenerate: () => void }) {
  const t = useT();
  const { report } = detail;
  if (report.status === 'generating')
    return (
      <Notice tone="warning" icon="progress_activity" title={t('This report is still being created')}>
        {t('The numbers below are a preview.')}
      </Notice>
    );
  if (report.status === 'scheduled')
    return (
      <Notice tone="info" icon="schedule" title={t('Scheduled · next run {when}', { when: report.nextRunLabel ?? t('not set') })}>
        {t(modeText(msg('This is a preview. In sample mode the schedule is saved but no email is sent.'), msg('This is a preview. The schedule is saved; email sending is not set up yet.')))}
      </Notice>
    );
  if (report.status === 'failed')
    return (
      <Notice tone="warning" icon="error" title={t('The last update failed')}>
        {report.failureReason}{' '}
        <button type="button" onClick={onRegenerate} className="underline font-semibold text-text-primary">
          {t('Try again')}
        </button>
      </Notice>
    );
  if (report.status === 'archived')
    return (
      <Notice tone="demo" icon="archive" title={t('Archived report')}>
        {t('Kept for reference. Numbers are worked out again from current data.')}
      </Notice>
    );
  return null;
}

function ReportBody({ detail }: { detail: ReportDetail }) {
  const t = useT();
  const toast = useToast();
  const { openCreateCampaign } = useAppUi();
  const { report } = detail;
  const has = (s: ReportSectionKey) => report.sections.includes(s);
  const [progress, setProgress] = useState<number | null>(null);
  const [editing, setEditing] = useState<ReportConfig | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [printExcluded, setPrintExcluded] = useState<ReportSectionKey[]>([]);
  const timer = useRef<number>();
  useEffect(() => () => window.clearInterval(timer.current), []);

  const regenerate = useMutation(reportService.regenerate, {
    invalidate: ['reports'],
    onSuccess: () =>
      toast({ tone: 'demo', title: t('Report updated'), description: t(modeText(msg('Worked out again from sample data, not from Instagram.'), msg('Worked out again from your saved data.'))) }),
  });

  const startRegenerate = () => {
    if (progress !== null) return;
    let value = 0;
    setProgress(0);
    timer.current = window.setInterval(() => {
      value += 12.5;
      setProgress(Math.min(100, value));
      if (value >= 100) {
        window.clearInterval(timer.current);
        void regenerate.mutate(report.id).finally(() => setProgress(null));
      }
    }, 150);
  };

  const csv = () => {
    downloadReportCsv(detail);
    toast({ tone: 'demo', title: t('Downloaded {file}', { file: `${report.id}-demo.csv` }), description: t(modeText(msg('CSV made in your browser from sample data.'), msg('CSV made in your browser.'))) });
  };
  const print = (excluded: ReportSectionKey[] = []) => {
    setPrintExcluded(excluded);
    window.setTimeout(() => window.print(), 50);
  };
  const xlsx = () => toast({ tone: 'demo', title: t('Excel files are not available yet'), description: t('Use CSV, or print and save as PDF.') });

  const onExport = (format: ExportFormat, excluded: ReportSectionKey[]) => {
    setExportOpen(false);
    if (format === 'csv') csv();
    else if (format === 'pdf') print(excluded);
    else xlsx();
  };

  return (
    <div id="report-print-root" className="space-y-6">
      <PrintStyles excluded={printExcluded} />
      <ReportDetailHeader
        detail={detail}
        progress={progress}
        actions={{ onEdit: () => setEditing(pickConfig(report)), onRegenerate: startRegenerate, onCsv: csv, onPrint: () => print(), onXlsx: xlsx, onExportOptions: () => setExportOpen(true) }}
      />
      <StatusNotice detail={detail} onRegenerate={startRegenerate} />
      {has('summary') && <ExecutiveSummary detail={detail} cplBenchmark={detail.cplBenchmarkInr} />}
      {has('kpis') && <KpiStrip detail={detail} cplBenchmark={detail.cplBenchmarkInr} />}
      {(has('timeline') || has('formats')) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {has('timeline') && (
            <div className={has('formats') ? 'lg:col-span-8 min-w-0' : 'lg:col-span-12 min-w-0'}>
              <TimelineCard detail={detail} />
            </div>
          )}
          {has('formats') && (
            <div className={has('timeline') ? 'lg:col-span-4' : 'lg:col-span-12'}>
              <FormatEfficiencyCard detail={detail} />
            </div>
          )}
        </div>
      )}
      {has('audience') && <AudienceSection detail={detail} />}
      {(has('campaigns') || has('creatives')) && (
        <div className="space-y-6">
          {has('campaigns') && <CampaignBreakdownTable detail={detail} />}
          {has('creatives') && <CreativesTable detail={detail} />}
        </div>
      )}
      {has('recommendations') && (
        <AiRecommendations
          detail={detail}
          onApply={() => {
            openCreateCampaign();
            toast({ tone: 'demo', title: t('New campaign opened'), description: t('AI tips are not filled in for you yet. Use them as a guide.') });
          }}
        />
      )}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} detail={detail} onExport={onExport} />
      <ReportConfigDrawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        initial={editing ?? pickConfig(report)}
        reportId={report.id}
        onSaved={() => {
          setEditing(null);
          toast({ tone: 'demo', title: t('Report settings saved'), description: t(modeText(msg('Numbers worked out again from sample data (this session only).'), msg('Numbers worked out again from campaign data.'))) });
        }}
      />
    </div>
  );
}

export default function ReportDetailPage() {
  const t = useT();
  const { reportId = '' } = useParams();
  const query = useQuery(`reports:detail:${reportId}`, () => reportService.get(reportId));
  useDocumentTitle(query.data ? query.data.report.title : t('Report'));
  return (
    <QueryState
      query={query}
      loading={<PageSkeleton kpis={8} />}
      empty={
        <EmptyState
          icon="description"
          title={t('Nothing to show yet')}
          description={t('This report has no data right now.')}
          action={
            <LinkButton to="/reports" icon="arrow_back">
              {t('Back to reports')}
            </LinkButton>
          }
        />
      }
      error={(err, retry) =>
        err instanceof NotFoundError ? (
          <EmptyState
            icon="search_off"
            title={t('Report not found')}
            description={t('This report may have been removed.')}
            action={
              <LinkButton to="/reports" icon="arrow_back">
                {t('Back to reports')}
              </LinkButton>
            }
          />
        ) : (
          <ErrorState error={err} onRetry={retry} />
        )
      }
    >
      {(detail) => <ReportBody detail={detail} />}
    </QueryState>
  );
}
