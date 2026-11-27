import { Link } from 'react-router-dom';
import { TableShell } from '@/components/tables/DataTable';
import { Icon } from '@/components/ui/Icon';
import { msg, useT, type Translate } from '@/i18n/I18nContext';
import { formatCompact, formatNumber, formatPercent } from '@/lib/format';
import type { FollowerSplitRow } from '@/types/audience';
import { AudienceCard } from './AudienceCard';
import type { AudiencePageData } from './model';

/** Plain names for the metric rows (the data labels use jargon like "Unique Reach"). */
const metricLabel: Record<string, string> = {
  views: msg('Views'),
  reach: msg('People reached'),
  engagementRate: msg('Engagement'),
  leads: msg('Leads'),
};

function fmt(row: FollowerSplitRow, v: number, t: Translate) {
  if (row.metric === 'engagementRate') return formatPercent(v);
  if (row.metric === 'leads') return t('{count} leads', { count: v });
  if (row.metric === 'views') return formatCompact(v);
  return formatNumber(v);
}

/** Followers vs non-followers: one split bar, one short line and a 4-column table. */
export function FollowerSplitSection({ data }: { data: AudiencePageData }) {
  const t = useT();
  const { intel, summary, overview } = data;
  const nonPct = summary.nonFollowerReachPct;
  const folPct = 100 - nonPct;
  const reachRow = intel.followerSplit.find((r) => r.metric === 'reach');

  return (
    <AudienceCard
      title={t('Followers and new people')}
      subtitle={t('Who saw your posts in October.')}
      info={t('Leads here are the {count} of {total} leads that have audience details in the sample data.', {
        count: intel.attributedLeads,
        total: formatNumber(overview.leads.value),
      })}
      actions={
        <Link to="/content/sbi-csp-mitra-reel" className="text-label-md text-primary font-semibold hover:underline flex items-center gap-0.5">
          {t('See top reel')} <Icon name="chevron_right" className="text-[0.875rem]" />
        </Link>
      }
    >
      <div className="mb-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold mb-1.5">
          <span className="flex items-center gap-2 text-text-primary">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            {t('Followers {pct}% ({reach} reached)', { pct: folPct, reach: formatCompact(reachRow?.followers) })}
          </span>
          <span className="flex items-center gap-2 text-primary">
            {t('Non-followers {pct}% ({reach} reached)', { pct: nonPct, reach: formatCompact(reachRow?.nonFollowers) })}
            <span className="w-2.5 h-2.5 rounded-full bg-primary-container" />
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
          <div className="h-full bg-slate-700" style={{ width: `${folPct}%` }} />
          <div className="h-full bg-primary-container" style={{ width: `${nonPct}%` }} />
        </div>
      </div>
      <p className="text-body-sm text-text-secondary mb-4 flex items-center gap-2">
        <Icon name="tips_and_updates" className="text-primary text-[1.125rem] shrink-0" />
        {t('Non-followers are {reach}% of people reached and {inquiries}% of new questions.', {
          reach: nonPct,
          inquiries: intel.discoveryNote.nonFollowerInquiryPct,
        })}
      </p>
      <TableShell>
        <thead>
          <tr className="text-text-secondary text-label-sm font-semibold border-b border-border-strong">
            <th className="py-2 px-3 text-left">{t('Number')}</th>
            <th className="py-2 px-3 text-right">{t('Followers')}</th>
            <th className="py-2 px-3 text-right">{t('Non-followers')}</th>
            <th className="py-2 px-3 text-right">{t('Total')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle text-body-sm">
          {intel.followerSplit.map((r) => {
            const followersWin = r.followers > r.nonFollowers;
            return (
              <tr key={r.metric} className="hover:bg-surface-canvas" title={r.context}>
                <td className="py-2.5 px-3 font-medium text-text-primary">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <Icon name={r.icon} className="text-[1rem] text-text-tertiary" />
                    {t(metricLabel[r.metric] ?? r.label)}
                  </span>
                </td>
                <td className={`py-2.5 px-3 text-right tnum ${followersWin ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>{fmt(r, r.followers, t)}</td>
                <td className={`py-2.5 px-3 text-right tnum ${followersWin ? 'text-text-secondary' : 'font-semibold text-primary'}`}>{fmt(r, r.nonFollowers, t)}</td>
                <td className="py-2.5 px-3 text-right tnum font-semibold text-text-primary">{fmt(r, r.total, t)}</td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>
    </AudienceCard>
  );
}
