import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { DemoBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Misc';
import { EmptyState, ErrorState, QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { AdLeadsTable, adLeadSortAccessors, type AdLeadSortKey } from '@/features/ads/AdLeadsTable';
import { AdsTabs } from '@/features/ads/AdsTabs';
import { QUALIFICATION_ORDER, qualificationHint, qualificationLabel } from '@/features/ads/QualificationBadge';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { useTable } from '@/hooks/useTable';
import { useT } from '@/i18n/I18nContext';
import { isDemoMode } from '@/lib/config';
import { cn } from '@/lib/format';
import type { QualificationStatus } from '@/lib/qualification';
import { adsService, countByStatus } from '@/services/ads';
import type { AdLead } from '@/types/ads';

type Filter = 'all' | QualificationStatus;

const isFilter = (v: string | null): v is Filter => v === 'all' || (QUALIFICATION_ORDER as readonly string[]).includes(v ?? '');

/** Every lead-form lead from the ads, filtered by qualification status, with the "Pitch ESAF" answer and Excel download. */
export default function AdsLeadsPage() {
  const t = useT();
  useDocumentTitle(t('Ad leads'));
  const toast = useToast();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('status');
  const filter: Filter = isFilter(fromUrl) ? fromUrl : 'all';
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  // Search on the server (debounced) so masked users still find leads by ad name or pincode.
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // One fetch for all statuses (the chips need the counts); the status filter is applied here.
  const leads = useQuery(`ads:leads:all:${q}`, () => adsService.leads({ q }));
  const counts = useMemo(() => countByStatus(leads.data ?? []), [leads.data]);
  const rows = useMemo(() => (leads.data ?? []).filter((l) => filter === 'all' || l.qualificationStatus === filter), [leads.data, filter]);
  const table = useTable<AdLead, AdLeadSortKey>(rows, { accessors: adLeadSortAccessors, initialSort: { key: 'created', direction: 'desc' }, pageSize: 25 });

  const setFilter = (next: Filter) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === 'all') p.delete('status');
        else p.set('status', next);
        return p;
      },
      { replace: true },
    );

  const download = useMutation(() => adsService.downloadLeads({ filter: filter === 'all' ? undefined : filter }), {
    onSuccess: (r) => toast({ tone: isDemoMode ? 'demo' : 'success', title: t('Downloaded {file}', { file: r.filename }) }),
    onError: (e) => toast({ tone: 'error', title: t('Could not download'), description: e.message }),
  });

  const total = leads.data?.length ?? 0;
  const chips: Array<{ value: Filter; label: string; count: number; hint?: string }> = [
    { value: 'all', label: t('All'), count: total },
    ...QUALIFICATION_ORDER.map((s) => ({ value: s, label: t(qualificationLabel(s)), count: counts[s], hint: t(qualificationHint(s)) })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Ad leads')}
        description={t('People who filled the form in an ad, and how good a fit they are.')}
        titleAddon={isDemoMode ? <DemoBadge /> : undefined}
        actions={
          can('ads:leads') ? (
            <Button icon="download" onClick={() => void download.mutate()} disabled={download.isPending || rows.length === 0}>
              {t('Download Excel')}
            </Button>
          ) : undefined
        }
      />
      <AdsTabs />

      {!can('ads:leads') && (
        <Notice icon="lock" title={t('Names and phone numbers are hidden')}>
          {t('Only editors and admins see them and can download the Excel file.')}
        </Notice>
      )}

      <section className="bg-surface-card border border-border-strong rounded-xl shadow-card overflow-hidden" aria-label={t('Ad leads')}>
        <div className="flex flex-col gap-3 px-5 pt-5 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('All ad leads')}</h2>
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search by name, phone, ad or pincode…')} containerClassName="w-72 max-w-full" aria-label={t('Search leads')} />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('Filter by status')}>
            {chips.map((c) => {
              const active = c.value === filter;
              return (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={active}
                  title={c.hint}
                  onClick={() => setFilter(c.value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-label-md transition-colors',
                    active ? 'bg-gold/10 border-gold/60 text-gold font-semibold' : 'border-border-strong text-text-secondary hover:text-text-primary hover:bg-surface-canvas',
                  )}
                >
                  {active && <Icon name="check" className="text-[0.875rem]" />}
                  {c.label}
                  <span className="text-[0.6875rem] font-bold tnum opacity-80">{c.count}</span>
                </button>
              );
            })}
          </div>
        </div>
        <QueryState
          query={leads}
          loading={
            <div className="p-4 space-y-2" role="status" aria-label={t('Loading…')}>
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          }
          error={(err, retry) => <ErrorState className="m-4" title={t('Could not load leads')} error={err} onRetry={retry} />}
          empty={
            <EmptyState
              className="m-4"
              icon={q ? 'search_off' : 'group_off'}
              title={q ? t('No matching leads') : t('No ad leads yet')}
              description={q ? t('Try a different search.') : t('Leads show up here after a sync with Meta.')}
            />
          }
        >
          {() =>
            rows.length === 0 ? (
              <EmptyState
                className="m-4"
                icon="filter_alt_off"
                title={t('No leads with this status')}
                action={
                  <Button variant="primary" onClick={() => setFilter('all')}>
                    {t('Show all')}
                  </Button>
                }
              />
            ) : (
              <AdLeadsTable table={table} />
            )
          }
        </QueryState>
      </section>
    </div>
  );
}
