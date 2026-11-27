import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { EmptyState, QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { modeText } from '@/lib/config';
import { accountService } from '@/services/accounts';
import { reportService } from '@/services/reports';
import { ReportConfigDrawer } from '@/features/reports/ReportConfigDrawer';
import { downloadLibraryCsv, downloadReportCsv } from '@/features/reports/reportCsv';
import { blankConfig, defaultSections, pickConfig } from '@/features/reports/reportOptions';
import { ReportsAiBanner } from '@/features/reports/ReportsAiBanner';
import { defaultReportFilters, ReportsFilterBar, type ReportFilters } from '@/features/reports/ReportsFilters';
import { ReportsKpis } from '@/features/reports/ReportsKpis';
import { canDownload, ReportsTable } from '@/features/reports/ReportsTable';
import type { Report, ReportConfig, ReportListItem } from '@/types/reports';

function TableSkeleton() {
  const t = useT();
  return (
    <section className="bg-surface-card rounded-xl border border-border-strong shadow-card p-5 space-y-3" role="status" aria-label={t('Loading reports')}>
      <Skeleton className="h-6 w-1/4" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </section>
  );
}

function EmptyReports({ onCreate }: { onCreate: () => void }) {
  const t = useT();
  return (
    <EmptyState
      icon="description"
      title={t('No reports found')}
      description={t('Try other filters, or create a new report.')}
      action={
        <Button variant="primary" size="md" icon="add" onClick={onCreate}>
          {t('Create report')}
        </Button>
      }
    />
  );
}

function matches(r: ReportListItem, f: ReportFilters) {
  const q = f.search.trim().toLowerCase();
  if (q && ![r.title, r.code, r.summary.primary, r.summary.secondary].some((s) => s.toLowerCase().includes(q))) return false;
  if (f.type !== 'all' && r.type !== f.type) return false;
  if (f.status !== 'all' && r.status !== f.status) return false;
  if (f.account !== 'all' && r.accountId !== f.account) return false;
  return true;
}

/** Reports: four numbers, a simple filter bar, the report list and the create / schedule / export actions. */
export default function ReportsPage() {
  const t = useT();
  useDocumentTitle(t('Reports'));
  const navigate = useNavigate();
  const toast = useToast();
  const list = useQuery('reports:list', reportService.list);
  const ctx = useQuery('reports:context', reportService.context);
  const accounts = useQuery('reports:accounts', accountService.list);
  const [filters, setFilters] = useState<ReportFilters>(defaultReportFilters);
  const [drawer, setDrawer] = useState<{ open: boolean; initial: ReportConfig; reportId?: string }>({ open: false, initial: blankConfig() });

  const filtered = useMemo(() => (list.data ?? []).filter((r) => matches(r, filters)), [list.data, filters]);
  const withData = ctx.data?.campaigns.filter((c) => c.metrics).map((c) => c.id) ?? [];

  const openCreate = (overrides: Partial<ReportConfig> = {}) => setDrawer({ open: true, initial: blankConfig(overrides) });
  const openSchedule = () =>
    openCreate({ title: 'Weekly Performance Digest', type: 'executive_summary', scope: 'account', campaignIds: withData, sections: defaultSections.executive_summary, schedule: 'weekly', formats: ['pdf'] });
  const batchExport = () => {
    downloadLibraryCsv(filtered);
    toast({
      tone: 'demo',
      title: t('Exported a list of {count} reports', { count: filtered.length }),
      description: t(modeText(msg('CSV of the reports shown (sample data).'), msg('CSV of the reports shown.'))),
    });
  };

  const duplicate = useMutation(reportService.duplicate, {
    invalidate: ['reports'],
    onSuccess: (r) => toast({ tone: 'demo', title: t('Copy created: {name}', { name: r.title }), description: t(modeText(msg('Saved for this session only (sample data).'), msg('Saved to SocialBoard.'))) }),
  });
  const archive = useMutation(reportService.setArchived, {
    invalidate: ['reports'],
    onSuccess: (r) => toast({ title: r.status === 'archived' ? t('Archived: {name}', { name: r.title }) : t('Restored: {name}', { name: r.title }), tone: 'success' }),
  });

  const handleDownload = async (r: ReportListItem) => {
    if (!canDownload(r)) {
      toast({ tone: 'info', title: t('Not ready yet'), description: r.status === 'failed' ? t('This report failed. Create it again first.') : t('This report has not been created yet.') });
      return;
    }
    downloadReportCsv(await reportService.get(r.id));
    toast({ tone: 'demo', title: t('Downloaded {file}', { file: `${r.id}-demo.csv` }), description: t(modeText(msg('CSV made in your browser from sample data.'), msg('CSV made in your browser.'))) });
  };

  const handleSaved = (report: Report, config: ReportConfig) => {
    const editing = !!drawer.reportId;
    setDrawer((d) => ({ ...d, open: false }));
    toast({
      tone: 'demo',
      title: editing ? t('Report updated') : t('Report created'),
      description:
        config.schedule !== 'none'
          ? t(modeText(msg('Schedule saved. Emails are not sent in sample mode.'), msg('Schedule saved.')))
          : t(modeText(msg('Numbers come from sample data, not from Instagram.'), msg('Numbers come from your saved Instagram data.'))),
    });
    if (!editing) navigate(`/reports/${report.id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Reports')}
        description={t('Create, view and download your reports.')}
        actions={
          <>
            <Dropdown
              label={t('More actions')}
              trigger={({ toggle, open }) => (
                <Button onClick={toggle} aria-expanded={open} iconRight="expand_more" className="h-9">
                  {t('More')}
                </Button>
              )}
            >
              {(close) => (
                <>
                  <MenuItem icon="schedule" onClick={() => (close(), openSchedule())}>
                    {t('Schedule a report')}
                  </MenuItem>
                  <MenuItem icon="layers" onClick={() => (close(), list.data && batchExport())}>
                    {t('Export list (CSV)')}
                  </MenuItem>
                </>
              )}
            </Dropdown>
            <Button variant="primary" size="md" icon="add" onClick={() => openCreate()}>
              {t('Create report')}
            </Button>
          </>
        }
      />

      {list.status === 'success' && ctx.data && list.data ? (
        <ReportsKpis items={list.data} ctx={ctx.data} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}

      <ReportsFilterBar filters={filters} onChange={setFilters} accounts={accounts.data ?? []} />

      <QueryState query={list} loading={<TableSkeleton />} empty={<EmptyReports onCreate={() => openCreate()} />}>
        {() =>
          filtered.length === 0 ? (
            <EmptyReports onCreate={() => openCreate()} />
          ) : (
            <ReportsTable
              items={filtered}
              totalCount={list.data?.length ?? 0}
              actions={{
                onDownload: handleDownload,
                onDuplicate: (r) => duplicate.mutate(r.id),
                onToggleArchive: (r) => archive.mutate(r.id, r.status !== 'archived'),
                onEdit: (r) => setDrawer({ open: true, initial: pickConfig(r), reportId: r.id }),
              }}
            />
          )
        }
      </QueryState>

      {ctx.data && (
        <ReportsAiBanner
          ctx={ctx.data}
          onDraft={() =>
            openCreate({
              title: 'Hindi Reel Conversions — Executive Brief',
              campaignIds: ['sbi-csp-october', 'sbi-csp-mitra-recruitment'],
              sections: ['summary', 'kpis', 'formats', 'creatives', 'recommendations'],
              formats: ['pdf'],
            })
          }
        />
      )}

      <ReportConfigDrawer
        open={drawer.open}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        initial={drawer.initial}
        reportId={drawer.reportId}
        onSaved={handleSaved}
      />
    </div>
  );
}
