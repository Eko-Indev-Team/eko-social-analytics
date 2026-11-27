import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { SegmentedControl, Tabs } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { TableShell, Td, Th, Tr } from '@/components/tables/DataTable';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { AdsChannel, AwardKey, PerformanceOut, PerfGroup, PerfRow, PerfSummary } from '@/types/adsReports';
import { count, money, pct } from './reportFormat';
import { ReportSection, StatusCountsInline } from './ReportUi';

const channelLabel = (c: AdsChannel) => (c === 'Lead Form' ? msg('Lead Form') : msg('Website'));

function ChannelBadge({ channel }: { channel: AdsChannel }) {
  const t = useT();
  return (
    <Badge tone={channel === 'Lead Form' ? 'completed' : 'ai'} icon={channel === 'Lead Form' ? 'assignment' : 'language'}>
      {t(channelLabel(channel))}
    </Badge>
  );
}

function adStatusTone(status: string) {
  const s = status.toUpperCase();
  if (s === 'ACTIVE') return 'active' as const;
  if (s === 'PAUSED') return 'paused' as const;
  if (s === 'COMPLETED') return 'completed' as const;
  return 'neutral' as const;
}

/* ---------------------------------- Awards ---------------------------------- */

const AWARDS: { key: Exclude<AwardKey, 'bestOverall'>; label: string; icon: string; value: (r: PerfRow) => string }[] = [
  { key: 'cheapestResult', label: msg('Cheapest result'), icon: 'savings', value: (r) => money(r.costPerResult) },
  { key: 'mostResults', label: msg('Most results'), icon: 'groups', value: (r) => count(r.results) },
  { key: 'mostQuality', label: msg('Most quality results'), icon: 'verified', value: (r) => count(r.quality) },
  { key: 'bestCtr', label: msg('Best click rate'), icon: 'ads_click', value: (r) => pct(r.ctr, 2) },
  { key: 'cheapestLpv', label: msg('Cheapest website visit'), icon: 'language', value: (r) => money(r.costPerLpv) },
];

export function AwardsSection({ data }: { data: PerformanceOut }) {
  const t = useT();
  const best = data.awards.bestOverall;
  const lf = best?.channel === 'Lead Form';
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Card className="p-5 border-status-active/40">
        <div className="flex items-center gap-2 text-status-active font-semibold text-label-md">
          <Icon name="emoji_events" filled className="text-[1.25rem]" />
          {t('Best ad so far')}
        </div>
        {best ? (
          <>
            <h3 className="font-heading text-[1.375rem] font-bold text-text-primary mt-2">{best.adName}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <ChannelBadge channel={best.channel} />
              <Badge tone={adStatusTone(best.status)} dot>
                {best.status}
              </Badge>
              <span className="text-body-sm text-text-tertiary">
                {best.nPincodes ? t('{count} pincodes', { count: best.nPincodes }) : best.geoBucket}
                {best.targetStates.length > 0 && ` · ${best.targetStates.join(', ')}`} · {t('age {age}', { age: best.ageSetting })} · {best.genderSetting}
              </span>
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <Stat label={lf ? t('Per lead in a targeted pincode') : t('Per strong-qualify signup')} value={money(best.costPerQuality)} strong />
              <Stat label={lf ? t('Leads in a targeted pincode') : t('Strong-qualify signups')} value={`${count(best.quality)} (${pct(best.qualityRate, 0)})`} />
              <Stat label={lf ? t('Per lead') : t('Per signup')} value={money(best.costPerResult)} />
              <Stat label={t('Spent')} value={money(best.spend)} />
            </dl>
            <p className="text-[0.75rem] text-text-tertiary mt-3">
              {t('Lowest cost per quality result among ads with at least {results} results and {quality} quality results. A cheap lead outside your area is not worth much.', {
                results: data.minResults,
                quality: data.minQuality,
              })}
            </p>
          </>
        ) : (
          <p className="text-body-sm text-text-secondary mt-2">
            {t('No ad has enough results yet (at least {results} results and {quality} quality results).', { results: data.minResults, quality: data.minQuality })}
          </p>
        )}
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {AWARDS.map((a) => {
          const row = data.awards[a.key];
          return (
            <Card key={a.key} className="p-4">
              <div className="flex items-center gap-2 text-text-secondary text-body-sm font-medium">
                <Icon name={a.icon} className="text-[1.125rem] text-primary" />
                {t(a.label)}
              </div>
              {row ? (
                <>
                  <p className="font-heading text-[1.25rem] font-bold text-text-primary tnum mt-1">{a.value(row)}</p>
                  <p className="text-[0.75rem] text-text-tertiary truncate" title={row.adName}>
                    {row.adName} · {t(channelLabel(row.channel))}
                  </p>
                </>
              ) : (
                <p className="text-body-sm text-text-tertiary mt-1">{t('Not enough data yet')}</p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-[0.75rem] text-text-tertiary">{label}</dt>
      <dd className={cn('font-heading font-bold tnum text-text-primary', strong ? 'text-[1.25rem] text-status-active' : 'text-[1.0625rem]')}>{value}</dd>
    </div>
  );
}

/* ------------------------------ Channel compare ----------------------------- */

export function ChannelCompare({ data }: { data: PerformanceOut }) {
  const t = useT();
  const f = data.channels.leadForm;
  const w = data.channels.website;
  const rows: [string, (s: PerfSummary) => string][] = [
    [t('Ads that spent money'), (s) => count(s.ads)],
    [t('Spend'), (s) => money(s.spend)],
    [t('Impressions'), (s) => count(s.impressions)],
    [t('Link click rate'), (s) => pct(s.ctr, 2)],
    [t('Results (leads / matched signups)'), (s) => count(s.results)],
    [t('Cost per result'), (s) => money(s.costPerResult)],
    [t('Quality results (in a targeted pincode / strong qualify)'), (s) => count(s.quality)],
    [t('Cost per quality result'), (s) => money(s.costPerQuality)],
    [t('Strongly qualified'), (s) => count(s.fullyQualified)],
  ];
  return (
    <ReportSection
      icon="compare_arrows"
      title={t('Lead Form vs. Website')}
      subtitle={t('Website results only count signups that carried a campaign ID. {missing} of {total} signups had none, so website numbers are a minimum.', {
        missing: data.unattributedSignups,
        total: data.totalSignups,
      })}
    >
      <TableShell className="rounded-lg border border-border-strong">
        <thead>
          <tr>
            <Th>{t('Measure')}</Th>
            <Th align="right">{t('Lead Form')}</Th>
            <Th align="right">{t('Website')}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, get]) => (
            <Tr key={label}>
              <Td>{label}</Td>
              <Td align="right">{get(f)}</Td>
              <Td align="right">{get(w)}</Td>
            </Tr>
          ))}
        </tbody>
      </TableShell>
      <p className="text-[0.75rem] text-text-tertiary">{t('Never add the two channels together: they measure different things.')}</p>
    </ReportSection>
  );
}

/* --------------------------------- Verdicts --------------------------------- */

export function VerdictsSection({ data }: { data: PerformanceOut }) {
  const t = useT();
  if (data.verdicts.length === 0) return null;
  const metric = (v: (typeof data.verdicts)[number], e: (typeof data.verdicts)[number]['winner']) =>
    v.basis.includes('quality') ? money(e.costPerQuality) : money(e.costPerResult);
  return (
    <ReportSection
      icon="tune"
      title={t('What worked best, setting by setting')}
      subtitle={t('For each choice made when building the ads, the cheapest option and the most expensive one. "Who saw it" rows use Meta\'s own split.')}
    >
      <TableShell className="rounded-lg border border-border-strong">
        <thead>
          <tr>
            <Th>{t('Channel')}</Th>
            <Th>{t('Setting')}</Th>
            <Th>{t('Best choice')}</Th>
            <Th align="right">{t('Best')}</Th>
            <Th>{t('Worst choice')}</Th>
            <Th align="right">{t('Worst')}</Th>
            <Th>{t('Judged on')}</Th>
          </tr>
        </thead>
        <tbody>
          {data.verdicts.map((v, i) => (
            <Tr key={`${v.channel}-${v.dimension}-${i}`}>
              <Td>
                <ChannelBadge channel={v.channel} />
              </Td>
              <Td className="font-medium">
                {v.dimension}
                {v.delivery && <span className="text-text-tertiary font-normal"> ({t('who saw it')})</span>}
              </Td>
              <Td className="text-status-active font-semibold">{v.winner.group}</Td>
              <Td align="right">{metric(v, v.winner)}</Td>
              <Td className="text-text-secondary">{v.worst?.group ?? '-'}</Td>
              <Td align="right">{v.worst ? metric(v, v.worst) : '-'}</Td>
              <Td className="text-text-tertiary">
                {v.basis} · {t('{count} compared', { count: v.compared })}
              </Td>
            </Tr>
          ))}
        </tbody>
      </TableShell>
    </ReportSection>
  );
}

/* -------------------------------- Ranked ads -------------------------------- */

export function RankedAdsTable({ rows }: { rows: PerfRow[] }) {
  const t = useT();
  const [channel, setChannel] = useState<'all' | AdsChannel>('all');
  const shown = rows.filter((r) => channel === 'all' || r.channel === channel);
  return (
    <ReportSection
      icon="format_list_numbered"
      title={t('Every ad, ranked')}
      subtitle={t('Only ads that spent money. Ranked by cost per quality result, then by results.')}
      actions={
        <SegmentedControl
          size="xs"
          ariaLabel={t('Channel')}
          value={channel}
          onChange={setChannel}
          options={[
            { value: 'all', label: t('All'), count: rows.length },
            { value: 'Lead Form', label: t('Lead Form'), count: rows.filter((r) => r.channel === 'Lead Form').length },
            { value: 'Website', label: t('Website'), count: rows.filter((r) => r.channel === 'Website').length },
          ]}
        />
      }
    >
      <TableShell className="rounded-lg border border-border-strong">
        <thead>
          <tr>
            <Th align="right">#</Th>
            <Th>{t('Ad')}</Th>
            <Th>{t('Channel')}</Th>
            <Th align="right">{t('Spend')}</Th>
            <Th align="right">{t('Click rate')}</Th>
            <Th align="right">{t('Results')}</Th>
            <Th align="right">{t('Cost / result')}</Th>
            <Th align="right">{t('Quality')}</Th>
            <Th align="right">{t('Cost / quality')}</Th>
            <Th>{t('Lead status')}</Th>
            <Th>{t('Targeting')}</Th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <Tr key={r.adId}>
              <Td align="right" className="text-text-tertiary">
                {i + 1}
              </Td>
              <Td>
                <div className="font-semibold">{r.adName}</div>
                <div className="text-[0.6875rem] text-text-tertiary flex items-center gap-1.5">
                  <Badge tone={adStatusTone(r.status)} dot className="!px-1.5 !py-0 !text-[0.625rem]">
                    {r.status}
                  </Badge>
                  {r.account}
                  {r.built && ` · ${r.built}`}
                </div>
              </Td>
              <Td>
                <ChannelBadge channel={r.channel} />
              </Td>
              <Td align="right">{money(r.spend)}</Td>
              <Td align="right">{pct(r.ctr, 2)}</Td>
              <Td align="right">{count(r.results)}</Td>
              <Td align="right">{money(r.costPerResult)}</Td>
              <Td align="right">
                {count(r.quality)} <span className="text-text-tertiary text-[0.6875rem]">{pct(r.qualityRate, 0)}</span>
              </Td>
              <Td align="right" className="font-semibold">
                {money(r.costPerQuality)}
              </Td>
              <Td>{r.channel === 'Lead Form' ? <StatusCountsInline counts={r.statusCounts} /> : <span className="text-text-tertiary">-</span>}</Td>
              <Td className="text-[0.75rem] text-text-secondary max-w-[18rem] whitespace-normal">
                {r.nPincodes ? t('{count} pincodes', { count: r.nPincodes }) : r.geoBucket} · {r.audienceType}
                {r.deliveredGender && <div className="text-text-tertiary">{r.deliveredGender}</div>}
              </Td>
            </Tr>
          ))}
        </tbody>
      </TableShell>
    </ReportSection>
  );
}

/* ------------------------------- Group tables ------------------------------- */

type GroupKey = 'byAudience' | 'byGeo' | 'byAge' | 'byGender' | 'byPlacement' | 'byInterest';
const GROUP_TABS: { value: GroupKey; label: string; column: string; note: string }[] = [
  { value: 'byAudience', label: msg('Audience'), column: msg('Audience type'), note: msg('Advantage+ (Meta picks the people) vs. hand-picked interests and job titles.') },
  { value: 'byGeo', label: msg('Geography'), column: msg('Pincodes targeted'), note: msg('How many pincodes each ad targeted.') },
  { value: 'byAge', label: msg('Age'), column: msg('Age range set'), note: msg('The age range set on the ad. With Advantage+ on, Meta may show the ad a little outside it.') },
  { value: 'byGender', label: msg('Gender'), column: msg('Gender set'), note: msg('With Advantage+ on, gender is only a suggestion to Meta.') },
  { value: 'byPlacement', label: msg('Placement'), column: msg('Placements'), note: msg('"Automatic" means Meta chose where to show the ad.') },
  { value: 'byInterest', label: msg('Interest'), column: msg('Interest / behaviour / job title'), note: msg('An ad with several interests counts toward each one, so rows overlap. Do not add them up.') },
];

export function GroupTables({ data }: { data: PerformanceOut }) {
  const t = useT();
  const [tab, setTab] = useState<GroupKey>('byAudience');
  const meta = GROUP_TABS.find((g) => g.value === tab)!;
  const groups: PerfGroup[] = data[tab];
  return (
    <ReportSection icon="category" title={t('Results by setting')} subtitle={t('The combined results of the ads that used each option.')}>
      <Tabs ariaLabel={t('Setting')} value={tab} onChange={setTab} tabs={GROUP_TABS.map((g) => ({ value: g.value, label: t(g.label), count: data[g.value].length }))} />
      <p className="text-body-sm text-text-tertiary">{t(meta.note)}</p>
      {groups.length === 0 ? (
        <p className="text-body-sm text-text-secondary py-4">{t('No ads used this setting yet.')}</p>
      ) : (
        <TableShell className="rounded-lg border border-border-strong">
          <thead>
            <tr>
              <Th>{t('Channel')}</Th>
              <Th>{t(meta.column)}</Th>
              <Th align="right">{t('Ads')}</Th>
              <Th align="right">{t('Spend')}</Th>
              <Th align="right">{t('Click rate')}</Th>
              <Th align="right">{t('Results')}</Th>
              <Th align="right">{t('Cost / result')}</Th>
              <Th align="right">{t('Quality')}</Th>
              <Th align="right">{t('Quality %')}</Th>
              <Th align="right">{t('Cost / quality')}</Th>
              <Th>{t('Lead status')}</Th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, i) => (
              <Tr key={`${g.channel}-${g.group}-${i}`}>
                <Td>
                  <ChannelBadge channel={g.channel} />
                </Td>
                <Td className="font-medium">{g.group}</Td>
                <Td align="right">{count(g.ads)}</Td>
                <Td align="right">{money(g.spend)}</Td>
                <Td align="right">{pct(g.ctr, 2)}</Td>
                <Td align="right">{count(g.results)}</Td>
                <Td align="right">{money(g.costPerResult)}</Td>
                <Td align="right">{count(g.quality)}</Td>
                <Td align="right">{pct(g.qualityRate)}</Td>
                <Td align="right" className="font-semibold">
                  {money(g.costPerQuality)}
                </Td>
                <Td>{g.channel === 'Lead Form' ? <StatusCountsInline counts={g.statusCounts} /> : <span className="text-text-tertiary">-</span>}</Td>
              </Tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </ReportSection>
  );
}

/* --------------------------- Who actually saw it ---------------------------- */

const DELIVERY_DIMS = [
  { value: 'age', label: msg('Age') },
  { value: 'gender', label: msg('Gender') },
  { value: 'platform', label: msg('Platform') },
  { value: 'position', label: msg('Placement position') },
] as const;

export function DeliverySection({ data }: { data: PerformanceOut }) {
  const t = useT();
  const [dim, setDim] = useState<(typeof DELIVERY_DIMS)[number]['value']>('age');
  const tables = data.delivered.filter((d) => d.dimension === dim);
  return (
    <ReportSection
      icon="visibility"
      title={t('Who actually saw the ads')}
      subtitle={t("Meta's own split of spend and results, whatever the ad was set to. Website results here are landing-page visits.")}
      actions={<SegmentedControl size="xs" ariaLabel={t('Split by')} value={dim} onChange={setDim} options={DELIVERY_DIMS.map((d) => ({ value: d.value, label: t(d.label) }))} />}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {tables.map((d) => (
          <div key={d.channel} className="space-y-2">
            <ChannelBadge channel={d.channel} />
            {d.rows.length === 0 ? (
              <p className="text-body-sm text-text-tertiary">{t('No data')}</p>
            ) : (
              <TableShell className="rounded-lg border border-border-strong">
                <thead>
                  <tr>
                    <Th>{t('Group')}</Th>
                    <Th align="right">{t('Spend')}</Th>
                    <Th align="right">{t('Share of spend')}</Th>
                    <Th align="right">{t('Results')}</Th>
                    <Th align="right">{t('Cost / result')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {d.rows.map((r) => (
                    <Tr key={r.group}>
                      <Td className="font-medium">{r.group}</Td>
                      <Td align="right">{money(r.spend)}</Td>
                      <Td align="right">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-1.5 w-12 rounded-full bg-surface-card-subtle overflow-hidden">
                            <span className="block h-full bg-primary-container" style={{ width: `${Math.min(100, r.shareOfSpend)}%` }} />
                          </span>
                          {pct(r.shareOfSpend, 0)}
                        </span>
                      </Td>
                      <Td align="right">{count(r.results)}</Td>
                      <Td align="right">{money(r.costPerResult)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </div>
        ))}
      </div>
    </ReportSection>
  );
}

/* ------------------------------ States & pincodes --------------------------- */

export function StatesSection({ data }: { data: PerformanceOut }) {
  const t = useT();
  return (
    <ReportSection icon="map" title={t('By state')} subtitle={t('Lead Form ads: where Meta spent the money, and the leads whose own pincode is in that state.')}>
      {data.states.length === 0 ? (
        <p className="text-body-sm text-text-secondary">{t('No state data yet.')}</p>
      ) : (
        <TableShell className="rounded-lg border border-border-strong">
          <thead>
            <tr>
              <Th>{t('State')}</Th>
              <Th align="right">{t('Spend')}</Th>
              <Th align="right">{t('Click rate')}</Th>
              <Th align="right">{t('Leads')}</Th>
              <Th align="right">{t('Cost / lead')}</Th>
              <Th align="right">{t('In a targeted pincode')}</Th>
              <Th align="right">{t('Strongly qualified')}</Th>
              <Th>{t('Lead status')}</Th>
            </tr>
          </thead>
          <tbody>
            {data.states.map((s) => (
              <Tr key={s.state}>
                <Td className="font-medium">{s.state}</Td>
                <Td align="right">{money(s.spend)}</Td>
                <Td align="right">{pct(s.ctr, 2)}</Td>
                <Td align="right">{count(s.leads)}</Td>
                <Td align="right">{money(s.costPerLead)}</Td>
                <Td align="right">{count(s.matched)}</Td>
                <Td align="right">{count(s.qualified)}</Td>
                <Td>
                  <StatusCountsInline counts={s.statusCounts} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </TableShell>
      )}
      {data.leadsOutsideDelivery.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-label-md font-semibold text-text-primary">{t('Leads from states Meta did not report spend in')}</h4>
          <div className="flex flex-wrap gap-2">
            {data.leadsOutsideDelivery.map((s) => (
              <span key={s.state} className="rounded-lg border border-border-strong bg-surface-card-subtle px-3 py-1.5 text-body-sm">
                <b>{s.state}</b> · {t('{count} leads', { count: s.leads })} · {t('{count} strongly qualified', { count: s.qualified })}
              </span>
            ))}
          </div>
        </div>
      )}
      {data.websiteStates.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-label-md font-semibold text-text-primary">{t('Website ads: delivery by state')}</h4>
          <TableShell className="rounded-lg border border-border-strong">
            <thead>
              <tr>
                <Th>{t('State')}</Th>
                <Th align="right">{t('Spend')}</Th>
                <Th align="right">{t('Impressions')}</Th>
                <Th align="right">{t('Click rate')}</Th>
              </tr>
            </thead>
            <tbody>
              {data.websiteStates.map((s) => (
                <Tr key={s.state}>
                  <Td className="font-medium">{s.state}</Td>
                  <Td align="right">{money(s.spend)}</Td>
                  <Td align="right">{count(s.impressions)}</Td>
                  <Td align="right">{pct(s.ctr, 2)}</Td>
                </Tr>
              ))}
            </tbody>
          </TableShell>
        </div>
      )}
    </ReportSection>
  );
}

export function PincodesSection({ data }: { data: PerformanceOut }) {
  const t = useT();
  const [view, setView] = useState<'top' | 'dead'>('top');
  const list = view === 'top' ? data.topPincodes : data.deadPincodes;
  return (
    <ReportSection
      icon="pin_drop"
      title={t('By pincode')}
      subtitle={t('{count} pincodes targeted. Spend per pincode is an estimate (the ad\'s spend split evenly over its pincodes).', { count: data.pincodesTargeted })}
      actions={
        <SegmentedControl
          size="xs"
          ariaLabel={t('Pincodes')}
          value={view}
          onChange={setView}
          options={[
            { value: 'top', label: t('Producing leads'), count: data.topPincodes.length },
            { value: 'dead', label: t('No leads yet'), count: data.deadPincodes.length },
          ]}
        />
      }
    >
      {list.length === 0 ? (
        <p className="text-body-sm text-text-secondary">{t('Nothing here yet.')}</p>
      ) : (
        <TableShell className="rounded-lg border border-border-strong max-h-[28rem]">
          <thead>
            <tr>
              <Th>{t('Pincode')}</Th>
              <Th>{t('State')}</Th>
              <Th align="right">{t('Ads')}</Th>
              <Th align="right">{t('Est. spend')}</Th>
              <Th align="right">{t('Leads in this pincode')}</Th>
              <Th align="right">{t('Strongly qualified')}</Th>
              <Th align="right">{t('Est. cost / lead')}</Th>
              {view === 'top' && <Th>{t('Lead status')}</Th>}
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <Tr key={p.pincode}>
                <Td className="font-mono-code">{p.pincode}</Td>
                <Td>{p.state ?? '-'}</Td>
                <Td align="right">{count(p.ads)}</Td>
                <Td align="right">{money(p.estSpend)}</Td>
                <Td align="right">{count(p.matched)}</Td>
                <Td align="right">{count(p.qualified)}</Td>
                <Td align="right">{money(p.estCostPerMatch)}</Td>
                {view === 'top' && (
                  <Td>
                    <StatusCountsInline counts={p.statusCounts} />
                  </Td>
                )}
              </Tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </ReportSection>
  );
}
