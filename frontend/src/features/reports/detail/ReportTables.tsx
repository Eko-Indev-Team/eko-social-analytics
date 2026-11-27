import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { TableShell, Td, Th, Tr } from '@/components/tables/DataTable';
import { CampaignStatusBadge, HealthBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback } from '@/components/ui/Misc';
import { msg, useT } from '@/i18n/I18nContext';
import { formatDate, formatNumber } from '@/lib/format';
import type { ReportDetail } from '@/types/reports';

function TableCard({ title, subtitle, section, children }: { title: string; subtitle: string; section: string; children: ReactNode }) {
  return (
    <section className="bg-surface-card rounded-xl border border-border-strong shadow-card overflow-hidden" data-print-section={section}>
      <div className="px-5 py-4">
        <h3 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{title}</h3>
        <p className="text-body-sm text-text-secondary">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export function CampaignBreakdownTable({ detail }: { detail: ReportDetail }) {
  const t = useT();
  const navigate = useNavigate();
  const { computed } = detail;
  return (
    <TableCard
      section="campaigns"
      title={t('Campaigns')}
      subtitle={
        detail.report.scope === 'account'
          ? t('How each campaign added to the account total ({count})', { count: computed.campaignRows.length })
          : t('Numbers for each campaign in this period ({count})', { count: computed.campaignRows.length })
      }
    >
      <TableShell>
        <thead>
          <tr>
            <Th>{t('Campaign')}</Th>
            <Th>{t('Status')}</Th>
            <Th align="right">{t('Views')}</Th>
            <Th align="right">{t('Leads')}</Th>
            <Th align="right">{t('Cost per lead')}</Th>
            <Th align="center">{t('Health')}</Th>
          </tr>
        </thead>
        <tbody>
          {computed.campaignRows.map((row) => (
            <Tr key={row.campaign.id} onClick={() => navigate(`/campaigns/${row.campaign.id}`)} label={t('Open {name}', { name: row.campaign.name })}>
              <Td className="font-semibold">
                <span title={row.campaign.code}>{row.campaign.name}</span>
                <div className="text-body-sm text-text-tertiary font-normal tnum">
                  {t('{reach} reached · {rate}% engagement', { reach: formatNumber(row.reach), rate: row.engagementRate.toFixed(2) })}
                </div>
              </Td>
              <Td>
                <CampaignStatusBadge status={row.campaign.status} />
              </Td>
              <Td align="right" className="font-semibold">
                {formatNumber(row.views)}
              </Td>
              <Td align="right" className="font-bold text-primary">
                {formatNumber(row.leads)}
              </Td>
              <Td align="right" className="font-semibold">
                {row.cpl !== null ? `₹${Math.round(row.cpl)}` : '—'}
              </Td>
              <Td align="center">
                <HealthBadge value={row.campaign.health} />
              </Td>
            </Tr>
          ))}
        </tbody>
      </TableShell>
      {computed.campaignsWithoutData.length > 0 && (
        <p className="px-5 py-3 text-body-sm text-text-tertiary">
          {t('Left out (no data in this period): {names}', { names: computed.campaignsWithoutData.map((c) => c.name).join(', ') })}
        </p>
      )}
    </TableCard>
  );
}

const typeIcon = { reel: 'movie', carousel: 'view_carousel', post: 'image', story: 'amp_stories' } as const;
const typeLabel = { reel: msg('Reel'), carousel: msg('Carousel'), post: msg('Post'), story: msg('Story') } as const;

export function CreativesTable({ detail }: { detail: ReportDetail }) {
  const t = useT();
  const navigate = useNavigate();
  const { creatives } = detail.computed;
  return (
    <TableCard
      section="creatives"
      title={t('Top posts')}
      subtitle={detail.computed.periodShare === 1 ? t('Sorted by leads') : t('Sorted by leads · all-time totals for these posts')}
    >
      <TableShell>
        <thead>
          <tr>
            <Th>{t('Post')}</Th>
            <Th>{t('Type')}</Th>
            <Th align="right">{t('Views')}</Th>
            <Th align="right">{t('Average watch')}</Th>
            <Th align="right">{t('Engagement')}</Th>
            <Th align="right">{t('Leads')}</Th>
          </tr>
        </thead>
        <tbody>
          {creatives.map(({ content: c, avgWatchSec }, i) => {
            const length = c.durationSec ? `${c.durationSec}s` : c.slides ? `${c.slides}p` : null;
            return (
              <Tr key={c.id} onClick={() => navigate(`/content/${c.id}`)} label={t('Open {name}', { name: c.title })}>
                <Td>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-11 rounded bg-slate-800 shrink-0 overflow-hidden relative">
                      <ImageWithFallback src={c.thumbnailUrl} alt={c.thumbnailAlt} className="w-full h-full" />
                      {length && <span className="absolute bottom-0.5 right-0.5 bg-navy/70 text-white text-[0.5rem] font-bold px-0.5 rounded">{length}</span>}
                    </div>
                    <div>
                      <div className="font-semibold text-text-primary text-[0.8125rem] hover:underline">{c.title}</div>
                      <div className="text-[0.75rem] text-text-tertiary tnum">{formatDate(c.publishedAt)}</div>
                    </div>
                  </div>
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-1 font-semibold text-text-primary">
                    <Icon name={typeIcon[c.type]} className={`text-[0.875rem] ${c.type === 'reel' ? 'text-primary-container' : 'text-tertiary'}`} />
                    {t(typeLabel[c.type])}
                  </span>
                </Td>
                <Td align="right" className="font-semibold">
                  {formatNumber(c.metrics.views)}
                </Td>
                <Td align="right" className="font-semibold">
                  {avgWatchSec !== null ? `${avgWatchSec.toFixed(1)}s (${c.metrics.retention}%)` : '—'}
                </Td>
                <Td align="right" className="font-semibold">
                  {c.metrics.engagementRate.toFixed(2)}%
                </Td>
                <Td align="right">
                  <span className={`px-2 py-0.5 rounded-full font-bold tnum text-[0.75rem] ${i === 0 ? 'bg-amber-900/40 text-amber-300' : 'bg-surface-card-subtle text-text-primary'}`}>
                    {formatNumber(c.metrics.leads)}
                  </span>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </TableShell>
      {creatives.length === 0 && <p className="px-5 py-4 text-body-sm text-text-secondary">{t('No posts in this report.')}</p>}
    </TableCard>
  );
}
