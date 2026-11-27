import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/app/AuthContext';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { isDemoMode } from '@/lib/config';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { useTable } from '@/hooks/useTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Controls';
import { ImageWithFallback } from '@/components/ui/Misc';
import { Drawer } from '@/components/ui/Overlay';
import { EmptyState, ErrorState, QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { adsService, resolveAdImageUrl } from '@/services/ads';
import type { AdBreakdownRow, AdDetail, AdLead } from '@/types/ads';
import { AdLeadsTable, adLeadSortAccessors, type AdLeadSortKey } from './AdLeadsTable';
import { adChannelLabel, adStatusLabel, adStatusTone, formatCount, formatDateTime, formatInr, formatInrPrecise } from './adsFormat';

/** Ad detail drawer: picture and text, numbers, targeting (incl. pincodes), breakdowns, leads and the Excel download. */
export function AdDrawer({ adId, onClose }: { adId: string | null; onClose: () => void }) {
  const t = useT();
  return (
    <Drawer open={!!adId} onClose={onClose} width="w-full sm:max-w-3xl" title={t('Ad details')}>
      {adId && <AdDetailBody key={adId} adId={adId} />}
    </Drawer>
  );
}

function AdDetailBody({ adId }: { adId: string }) {
  const t = useT();
  const detail = useQuery(`ads:detail:${adId}`, () => adsService.detail(adId));
  return (
    <QueryState
      query={detail}
      loading={
        <div className="space-y-3" role="status" aria-label={t('Loading…')}>
          <Skeleton className="h-40" />
          <Skeleton className="h-24" />
          <Skeleton className="h-48" />
        </div>
      }
      error={(err, retry) => <ErrorState title={t('Could not load this ad')} error={err} onRetry={retry} />}
    >
      {(ad) => <AdDetailView ad={ad} />}
    </QueryState>
  );
}

function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-heading text-[0.9375rem] font-semibold text-text-primary">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border-strong px-3 py-2">
      <p className="text-[0.75rem] text-text-tertiary">{label}</p>
      <p className="font-heading text-[1.0625rem] font-bold text-text-primary tnum">{value}</p>
    </div>
  );
}

function AdDetailView({ ad }: { ad: AdDetail }) {
  const t = useT();
  const { can } = useAuth();
  const leads = ad.leadCounts.total || ad.metrics.leads;
  return (
    <div className="space-y-6 text-body-sm">
      <div className="flex flex-col sm:flex-row gap-4">
        <ImageWithFallback
          src={resolveAdImageUrl(ad.creative.imageUrl) ?? undefined}
          alt={t('Ad picture: {name}', { name: ad.adName ?? '' })}
          className="w-full sm:w-48 h-48 rounded-lg border border-border-strong shrink-0 object-contain bg-surface-canvas"
          fallbackIcon="ads_click"
        />
        <div className="min-w-0 space-y-2">
          <h3 className="font-heading text-[1.125rem] font-bold text-text-primary break-words">{ad.adName ?? ad.id}</h3>
          <p className="text-text-tertiary">{ad.campaignName ?? '—'} · {ad.accountName ?? '—'}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={adStatusTone(ad.status)} dot>
              {t(adStatusLabel(ad.status))}
            </Badge>
            <Badge>{t(adChannelLabel(ad.channel))}</Badge>
            {ad.creative.imageType && <Badge tone="ai">{ad.creative.imageType}</Badge>}
          </div>
          {ad.creative.headline && <p className="font-semibold text-text-primary">{ad.creative.headline}</p>}
          {ad.creative.primaryText && <p className="text-text-secondary whitespace-pre-line">{ad.creative.primaryText}</p>}
          <p className="text-[0.75rem] text-text-tertiary">{t('First shown: {date}', { date: ad.firstImpressionDate ?? '—' })} · {t('Created: {date}', { date: formatDateTime(ad.createdTime) })}</p>
        </div>
      </div>

      {can('write') && ad.creative.imageHash && <CreativeLabelEditor imageHash={ad.creative.imageHash} value={ad.creative.imageType} />}

      <Section title={t('Numbers')}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label={t('Spent')} value={formatInr(ad.metrics.spend)} />
          <Stat label={t('Shown')} value={formatCount(ad.metrics.impressions)} />
          <Stat label={t('People reached')} value={formatCount(ad.metrics.reach)} />
          <Stat label={t('Clicks')} value={formatCount(ad.metrics.clicks)} />
          <Stat label={t('Click rate')} value={`${ad.metrics.ctr.toFixed(2)}%`} />
          <Stat label={t('Cost per click')} value={formatInrPrecise(ad.metrics.cpc)} />
          <Stat label={t('Leads')} value={formatCount(leads)} />
          <Stat label={t('Strongly qualified')} value={formatCount(ad.leadCounts.qualified)} />
        </div>
      </Section>

      <Section title={t('Who sees it')}>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
          <Row label={t('Places')}>{ad.targeting.locations.join(', ') || '—'}</Row>
          <Row label={t('Age')}>{ad.targeting.ageRange ?? '—'}</Row>
          <Row label={t('Gender')}>{ad.targeting.genders ?? '—'}</Row>
          <Row label={t('Shown on')}>{ad.targeting.placements.join(', ') || '—'}</Row>
          <Row label={t('Interests')}>{ad.targeting.interestsBehaviors ?? '—'}</Row>
          <Row label={t('Meta picks the audience')}>{ad.targeting.advantageAudience === null ? '—' : ad.targeting.advantageAudience ? t('Yes') : t('No')}</Row>
        </dl>
        {Object.entries(ad.targeting.categories ?? {}).map(([label, names]) => (
          <p key={label} className="text-text-secondary">
            <span className="text-text-tertiary">{label}:</span> {names.join(', ')}
          </p>
        ))}
        <PincodeList pincodes={ad.targeting.pincodes} checkOk={ad.targeting.pincodeCheckOk} restored={ad.targeting.restoredFromDb} />
      </Section>

      <Section title={t('Breakdowns')}>
        <div className="grid gap-4 lg:grid-cols-3">
          <BreakdownTable title={t('Age and gender')} rows={ad.breakdowns.ageGender} label={(r) => [r.age, r.gender].filter(Boolean).join(' · ')} />
          <BreakdownTable title={t('App and spot')} rows={ad.breakdowns.platform} label={(r) => [r.publisherPlatform, r.platformPosition].filter(Boolean).join(' · ')} />
          <BreakdownTable title={t('Region')} rows={ad.breakdowns.region} label={(r) => r.region ?? '—'} />
        </div>
      </Section>

      {ad.channel !== 'website' && <AdLeadsSection adId={ad.id} />}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2 min-w-0">
      <dt className="text-text-tertiary shrink-0">{label}</dt>
      <dd className="text-text-primary min-w-0 break-words">{children}</dd>
    </div>
  );
}

function PincodeList({ pincodes, checkOk, restored }: { pincodes: string[]; checkOk: boolean; restored: boolean }) {
  const t = useT();
  const [all, setAll] = useState(false);
  if (pincodes.length === 0)
    return <p className="text-text-tertiary">{checkOk ? t('No pincodes targeted.') : t('No pincode list for this ad, so lead pincodes cannot be checked.')}</p>;
  const shown = all ? pincodes : pincodes.slice(0, 24);
  return (
    <div className="space-y-1.5">
      <p className="text-text-secondary">
        {t('{count} pincodes targeted', { count: pincodes.length })}
        {restored && <span className="text-text-tertiary"> · {t('saved list (Meta no longer shows it)')}</span>}
      </p>
      <div className="flex flex-wrap gap-1">
        {shown.map((p) => (
          <span key={p} className="px-1.5 py-0.5 rounded border border-border-strong text-[0.75rem] tnum text-text-secondary">
            {p}
          </span>
        ))}
        {pincodes.length > shown.length && (
          <button type="button" className="text-[0.75rem] text-primary hover:underline px-1" onClick={() => setAll(true)}>
            {t('Show all')}
          </button>
        )}
      </div>
    </div>
  );
}

function BreakdownTable({ title, rows, label }: { title: string; rows: AdBreakdownRow[]; label: (r: AdBreakdownRow) => string }) {
  const t = useT();
  return (
    <div className="rounded-lg border border-border-strong overflow-hidden">
      <p className="px-3 py-2 text-[0.75rem] font-semibold text-text-secondary bg-surface-canvas border-b border-border-strong">{title}</p>
      {rows.length === 0 ? (
        <p className="px-3 py-3 text-[0.75rem] text-text-tertiary">{t('No data yet.')}</p>
      ) : (
        <table className="w-full text-[0.75rem]">
          <thead>
            <tr className="text-text-tertiary">
              <th className="text-left font-medium px-3 py-1.5" />
              <th className="text-right font-medium px-2 py-1.5">{t('Spent')}</th>
              <th className="text-right font-medium px-3 py-1.5">{t('Leads')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border-subtle">
                <td className="px-3 py-1.5 text-text-primary">{label(r) || '—'}</td>
                <td className="px-2 py-1.5 text-right tnum">{formatInr(r.spend)}</td>
                <td className="px-3 py-1.5 text-right tnum">{formatCount(r.leads)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CreativeLabelEditor({ imageHash, value }: { imageHash: string; value: string | null }) {
  const t = useT();
  const toast = useToast();
  const [text, setText] = useState(value ?? '');
  useEffect(() => setText(value ?? ''), [value]);
  const save = useMutation((label: string) => adsService.setCreativeLabel(imageHash, label || null), {
    invalidate: ['ads:'],
    onSuccess: () => toast({ tone: isDemoMode ? 'demo' : 'success', title: t('Picture label saved') }),
    onError: (e) => toast({ tone: 'error', title: t('Could not save the label'), description: e.message }),
  });
  const changed = text.trim() !== (value ?? '');
  return (
    <form
      className="flex items-end gap-2 flex-wrap"
      onSubmit={(e) => {
        e.preventDefault();
        if (changed) void save.mutate(text.trim());
      }}
    >
      <label className="flex-1 min-w-[12rem]">
        <span className="block text-[0.75rem] text-text-secondary mb-1">{t('Picture label (what the picture shows)')}</span>
        <TextInput value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder={t('For example: Shop owner photo')} />
      </label>
      <Button type="submit" disabled={!changed || save.isPending} loading={save.isPending}>
        {t('Save label')}
      </Button>
    </form>
  );
}

function AdLeadsSection({ adId }: { adId: string }) {
  const t = useT();
  const toast = useToast();
  const { can } = useAuth();
  const leads = useQuery(`ads:leads:ad:${adId}`, () => adsService.adLeads(adId));
  const table = useTable<AdLead, AdLeadSortKey>(leads.data ?? [], { accessors: adLeadSortAccessors, initialSort: { key: 'created', direction: 'desc' }, pageSize: 5 });
  const download = useMutation(() => adsService.downloadLeads({ adId }), {
    onSuccess: (r) => toast({ tone: isDemoMode ? 'demo' : 'success', title: t('Downloaded {file}', { file: r.filename }) }),
    onError: (e) => toast({ tone: 'error', title: t('Could not download'), description: e.message }),
  });
  return (
    <Section
      title={t('Leads from this ad')}
      actions={
        can('ads:leads') ? (
          <Button icon="download" size="xs" onClick={() => void download.mutate()} disabled={download.isPending || !leads.data?.length}>
            {t('Download Excel')}
          </Button>
        ) : null
      }
    >
      <QueryState
        query={leads}
        loading={<Skeleton className="h-32" />}
        error={(err, retry) => <ErrorState title={t('Could not load leads')} error={err} onRetry={retry} />}
        empty={<EmptyState icon="group_off" title={t('No leads from this ad yet')} />}
      >
        {() => (
          <div className={cn('rounded-lg border border-border-strong overflow-hidden')}>
            <AdLeadsTable table={table} showAd={false} />
          </div>
        )}
      </QueryState>
    </Section>
  );
}
