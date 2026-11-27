import { useMemo, useState } from 'react';
import { useAppUi } from '@/app/AppUiContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { SearchInput, Select } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { useTable } from '@/hooks/useTable';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { accountService } from '@/services/accounts';
import { campaignService } from '@/services/campaigns';
import type { Campaign, CampaignObjective } from '@/types/domain';
import { CampaignQuickViewDrawer } from '@/features/campaigns/CampaignQuickViewDrawer';
import { CampaignsBulkBar } from '@/features/campaigns/CampaignsBulkBar';
import { CampaignsKpiSkeleton, CampaignsKpiStrip } from '@/features/campaigns/CampaignsKpiStrip';
import { CampaignStatusChips, type StatusFilter } from '@/features/campaigns/CampaignStatusChips';
import { campaignSortAccessors, CampaignsTable, CampaignsTableSkeleton, type CampaignSortKey } from '@/features/campaigns/CampaignsTable';
import { downloadCampaignsCsv, OBJECTIVE_LABEL, OBJECTIVES } from '@/features/campaigns/campaignUtils';
import { EditCampaignModal } from '@/features/campaigns/EditCampaignModal';
import { useCampaignActions } from '@/features/campaigns/useCampaignActions';

const SORT_PRESETS: Array<{ key: CampaignSortKey; label: string }> = [
  { key: 'reach', label: msg('Most people reached') },
  { key: 'leads', label: msg('Most leads') },
  { key: 'engagementRate', label: msg('Most engagement') },
  { key: 'created', label: msg('Newest first') },
];

/** Campaigns list: four numbers, status pills + search, a short table and the quick-look drawer. */
export default function CampaignsPage() {
  const t = useT();
  useDocumentTitle(t('Campaigns'));
  const toast = useToast();
  const { openCreateCampaign } = useAppUi();
  const campaignsQ = useQuery('campaigns:list', campaignService.list);
  const overviewQ = useQuery('accounts:overview', accountService.overview);
  const actions = useCampaignActions();

  const [status, setStatus] = useState<StatusFilter>('all');
  const [objective, setObjective] = useState<'all' | CampaignObjective>('all');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const all = useMemo(() => campaignsQ.data ?? [], [campaignsQ.data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      (c) =>
        (status === 'all' || c.status === status) &&
        (objective === 'all' || c.objective === objective) &&
        (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.hashtags.some((h) => h.toLowerCase().includes(q))),
    );
  }, [all, status, objective, search]);

  const table = useTable<Campaign, CampaignSortKey>(filtered, { accessors: campaignSortAccessors, initialSort: { key: 'reach', direction: 'desc' }, pageSize: 10 });
  const sortPreset = table.sort?.direction === 'desc' && SORT_PRESETS.some((p) => p.key === table.sort?.key) ? table.sort.key : '';

  const selectedCampaigns = all.filter((c) => selected.has(c.id));
  const drawerCampaign = all.find((c) => c.id === drawerId) ?? null;
  const editCampaign = all.find((c) => c.id === editId) ?? null;
  const filtersActive = status !== 'all' || objective !== 'all' || search.trim() !== '';

  const onSelect = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const clearFilters = () => {
    setStatus('all');
    setObjective('all');
    setSearch('');
  };

  const exportSelected = () => {
    downloadCampaignsCsv(selectedCampaigns, 'socialboard-selected-campaigns-demo.csv');
    toast({ tone: 'demo', title: t('Downloaded {count} campaigns as CSV', { count: selectedCampaigns.length }), description: t('Made in your browser from sample data.') });
  };

  const openEdit = (c: Campaign) => {
    setDrawerId(null);
    setEditId(c.id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Campaigns')}
        description={t('All your Instagram campaigns in one place.')}
        actions={
          <Button variant="primary" size="md" icon="add" onClick={openCreateCampaign}>
            {t('New campaign')}
          </Button>
        }
      />

      {campaignsQ.status === 'loading' || overviewQ.status === 'loading' ? <CampaignsKpiSkeleton /> : <CampaignsKpiStrip campaigns={all} overview={overviewQ.data} />}

      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <CampaignStatusChips campaigns={all} value={status} onChange={setStatus} />
          <div className="flex items-center gap-2">
            <SearchInput
              aria-label={t('Search campaigns')}
              placeholder={t('Search by name or hashtag…')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              containerClassName="w-full lg:w-64"
            />
            <Button
              size="md"
              icon="tune"
              onClick={() => setShowFilters((f) => !f)}
              aria-expanded={showFilters}
              className={cn(objective !== 'all' && 'border-primary-container')}
            >
              {t('Filters')}
            </Button>
          </div>
        </div>
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-xl bg-surface-card border border-border-strong">
            <Select aria-label={t('Filter by goal')} value={objective} onChange={(e) => setObjective(e.target.value as typeof objective)} className="appearance-none font-medium">
              <option value="all">{t('All goals')}</option>
              {OBJECTIVES.map((o) => (
                <option key={o} value={o}>
                  {t(OBJECTIVE_LABEL[o])}
                </option>
              ))}
            </Select>
            <Select
              aria-label={t('Sort campaigns')}
              value={sortPreset}
              onChange={(e) => {
                const key = e.target.value as CampaignSortKey;
                if (table.sort?.key === key && table.sort.direction === 'asc') table.toggleSort(key);
                else if (table.sort?.key !== key) table.toggleSort(key);
              }}
              className="appearance-none font-medium"
            >
              {sortPreset === '' && (
                <option value="" disabled>
                  {t('Sorted by column')}
                </option>
              )}
              {SORT_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {t(p.label)}
                </option>
              ))}
            </Select>
            {filtersActive && (
              <button type="button" onClick={clearFilters} className="text-label-md font-semibold text-text-secondary hover:text-text-primary flex items-center gap-1 ml-auto">
                <Icon name="filter_alt_off" className="text-[1rem]" />
                {t('Clear filters')}
              </button>
            )}
          </div>
        )}
      </div>

      {selectedCampaigns.length > 0 && (
        <CampaignsBulkBar
          selected={selectedCampaigns}
          pending={actions.statusPending}
          onPause={() => actions.setStatus(selectedCampaigns, 'paused')}
          onResume={() => actions.setStatus(selectedCampaigns, 'active')}
          onExport={exportSelected}
          onClear={() => setSelected(new Set())}
        />
      )}

      {campaignsQ.status === 'loading' ? (
        <CampaignsTableSkeleton />
      ) : campaignsQ.status === 'error' ? (
        <ErrorState title={msg('Could not load campaigns')} error={campaignsQ.error} onRetry={campaignsQ.refetch} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="campaign"
          title={filtersActive ? t('No matching campaigns') : t('No campaigns yet')}
          description={filtersActive ? t('Try another status or search.') : t('Create your first campaign to track it here.')}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {filtersActive && (
                <Button size="md" icon="filter_alt_off" onClick={clearFilters}>
                  {t('Clear filters')}
                </Button>
              )}
              <Button variant="primary" size="md" icon="add" onClick={openCreateCampaign}>
                {t('New campaign')}
              </Button>
            </div>
          }
        />
      ) : (
        <CampaignsTable
          table={table}
          selected={selected}
          onSelect={onSelect}
          onOpen={(c) => setDrawerId(c.id)}
          onEdit={openEdit}
          onToggleStatus={(c) => actions.setStatus([c], c.status === 'active' ? 'paused' : 'active')}
          onDuplicate={(c) => actions.duplicate(c)}
        />
      )}

      <CampaignQuickViewDrawer
        campaign={drawerCampaign}
        onClose={() => setDrawerId(null)}
        onEdit={openEdit}
        onDuplicate={(c) => actions.duplicate(c)}
        duplicatePending={actions.duplicatePending}
      />
      <EditCampaignModal campaign={editCampaign} onClose={() => setEditId(null)} />
    </div>
  );
}
