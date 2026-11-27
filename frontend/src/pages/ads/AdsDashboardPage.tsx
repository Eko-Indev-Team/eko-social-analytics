import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { DemoBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { SearchInput, Select } from '@/components/ui/Controls';
import { EmptyState, ErrorState, QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { AdDrawer } from '@/features/ads/AdDrawer';
import { AdsKpis, AdsKpisSkeleton } from '@/features/ads/AdsKpis';
import { AdsStatusBanner, useAdsStatus } from '@/features/ads/AdsStatusBanner';
import { AdsTable, adSortAccessors, type AdSortKey } from '@/features/ads/AdsTable';
import { AdsTabs } from '@/features/ads/AdsTabs';
import { QualificationCountsBar } from '@/features/ads/QualificationBadge';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { useTable } from '@/hooks/useTable';
import { useT } from '@/i18n/I18nContext';
import { isDemoMode } from '@/lib/config';
import { adsService } from '@/services/ads';
import type { AdChannel, AdRow } from '@/types/ads';

type StatusFilter = 'all' | 'running' | 'paused' | 'finished';

const statusGroup = (status: string | null): StatusFilter => {
  const s = (status ?? '').toUpperCase();
  if (s === 'ACTIVE') return 'running';
  if (s.includes('PAUSED')) return 'paused';
  return 'finished';
};

/** Ads dashboard: sync status, numbers, lead quality split and every ad (click one for details). */
export default function AdsDashboardPage() {
  const t = useT();
  useDocumentTitle(t('Ads'));
  const toast = useToast();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const selectedAd = params.get('ad');

  const status = useAdsStatus();
  const summary = useQuery('ads:summary', adsService.summary);
  const ads = useQuery('ads:list', adsService.list);

  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState<'all' | AdChannel>('all');
  const [state, setState] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (ads.data ?? []).filter(
      (a: AdRow) =>
        (!q || [a.adName, a.campaignName, a.accountName, a.id].some((v) => v?.toLowerCase().includes(q))) &&
        (channel === 'all' || a.channel === channel) &&
        (state === 'all' || statusGroup(a.status) === state),
    );
  }, [ads.data, search, channel, state]);

  const table = useTable<AdRow, AdSortKey>(filtered, { accessors: adSortAccessors, initialSort: { key: 'spend', direction: 'desc' }, pageSize: 10 });

  const setAd = (id: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('ad', id);
        else next.delete('ad');
        return next;
      },
      { replace: true },
    );

  const download = useMutation(() => adsService.downloadLeads(), {
    onSuccess: (r) => toast({ tone: isDemoMode ? 'demo' : 'success', title: t('Downloaded {file}', { file: r.filename }) }),
    onError: (e) => toast({ tone: 'error', title: t('Could not download'), description: e.message }),
  });

  const resetFilters = () => {
    setSearch('');
    setChannel('all');
    setState('all');
  };
  const noAdsYet = ads.status === 'empty' || (ads.status === 'success' && (ads.data?.length ?? 0) === 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Ads')}
        description={t('Facebook and Instagram ads: money spent, leads and how good they are.')}
        titleAddon={isDemoMode ? <DemoBadge /> : undefined}
        actions={
          can('ads:leads') ? (
            <Button icon="download" onClick={() => void download.mutate()} disabled={download.isPending || !(status.data?.leadCount ?? summary.data?.leads)}>
              {t('Download all leads')}
            </Button>
          ) : undefined
        }
      />
      <AdsTabs />
      <AdsStatusBanner />

      <QueryState query={summary} loading={<AdsKpisSkeleton />} error={(err, retry) => <ErrorState title={t('Could not load ad numbers')} error={err} onRetry={retry} />}>
        {(s) =>
          s.adCount === 0 ? null : (
            <>
              <AdsKpis summary={s} />
              <Card className="p-5 space-y-4">
                <CardHeader title={t('How good are the leads?')} subtitle={t('Click a box to see those leads.')} />
                <QualificationCountsBar counts={s.qualificationCounts} onSelect={(st) => navigate(`/ads/leads?status=${st}`)} />
              </Card>
            </>
          )
        }
      </QueryState>

      <section className="bg-surface-card border border-border-strong rounded-xl shadow-card overflow-hidden" aria-label={t('All ads')}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
          <h2 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('All ads')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search ads…')} containerClassName="w-56" aria-label={t('Search ads')} />
            <Select value={channel} onChange={(e) => setChannel(e.target.value as 'all' | AdChannel)} aria-label={t('Type')}>
              <option value="all">{t('All types')}</option>
              <option value="lead_form">{t('Lead form')}</option>
              <option value="website">{t('Website')}</option>
              <option value="other">{t('Other')}</option>
            </Select>
            <Select value={state} onChange={(e) => setState(e.target.value as StatusFilter)} aria-label={t('Status')}>
              <option value="all">{t('Any status')}</option>
              <option value="running">{t('Running')}</option>
              <option value="paused">{t('Paused')}</option>
              <option value="finished">{t('Finished')}</option>
            </Select>
          </div>
        </div>
        {noAdsYet ? (
          <EmptyState
            className="m-4"
            icon="ads_click"
            title={t('No ads yet')}
            description={
              status.data && !status.data.configured
                ? t('Connect Meta Ads: an admin adds META_ADS_ACCESS_TOKEN to backend/.env. Ads show up here after the first sync.')
                : t('Ads show up here after the first sync with Meta.')
            }
          />
        ) : (
          <QueryState
            query={ads}
            loading={
              <div className="p-4 space-y-2" role="status" aria-label={t('Loading…')}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            }
            error={(err, retry) => <ErrorState className="m-4" title={t('Could not load ads')} error={err} onRetry={retry} />}
          >
            {() =>
              table.total === 0 ? (
                <EmptyState
                  className="m-4"
                  icon="search_off"
                  title={t('No matching ads')}
                  description={t('Try a different search or filter.')}
                  action={
                    <Button variant="primary" onClick={resetFilters}>
                      {t('Clear filters')}
                    </Button>
                  }
                />
              ) : (
                <AdsTable table={table} onOpen={setAd} selectedId={selectedAd} />
              )
            }
          </QueryState>
        )}
      </section>

      <AdDrawer adId={selectedAd} onClose={() => setAd(null)} />
    </div>
  );
}
