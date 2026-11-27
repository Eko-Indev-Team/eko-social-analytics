import { DemoBadge } from '@/components/ui/Badge';
import { msg, useT } from '@/i18n/I18nContext';
import { cn, formatCompact, formatNumber } from '@/lib/format';
import type { AnalyticsPageData } from './model';
import { SectionCard, UnavailableSection } from './SectionCard';

const trafficBar = ['bg-primary-container', 'bg-amber-400', 'bg-slate-600', 'bg-slate-700'];
const stateBar = ['bg-primary-container', 'bg-primary-container/85', 'bg-primary-container/70', 'bg-primary-container/55', 'bg-primary-container/40'];

/** Followers vs new people, where they saw it, and the interaction counts. */
export function DiscoveryCard({ data }: { data: AnalyticsPageData }) {
  const t = useT();
  const { item, analytics } = data;
  const d = analytics?.discovery;
  if (!d) return <UnavailableSection title={t('How people found it')} />;
  const m = item.metrics;
  const followers = Math.round((m.reach * d.followerSharePct) / 100);
  const nonFollowers = m.reach - followers;
  const nonPct = 100 - d.followerSharePct;
  const matrix = [
    { label: msg('Likes'), value: formatNumber(m.likes) },
    { label: msg('Comments'), value: formatNumber(m.comments) },
    { label: msg('Shares'), value: formatNumber(m.shares) },
    { label: msg('Saves'), value: formatNumber(m.saves) },
    { label: msg('Profile visits'), value: formatNumber(d.profileVisits) },
    { label: msg('New followers'), value: `+${formatNumber(d.newFollows)}`, positive: true },
  ];

  return (
    <SectionCard
      title={t('How people found it')}
      subtitle={nonPct >= 50 ? t('Mostly people who do not follow you yet') : t('Mostly your followers')}
      right={<span className="text-label-sm text-text-secondary tnum">{t('{count} people reached', { count: formatNumber(m.reach) })}</span>}
    >
      <div className="mb-5">
        <div className="h-3 w-full bg-surface-canvas rounded-full flex overflow-hidden">
          <div className="bg-slate-600 h-full" style={{ width: `${d.followerSharePct}%` }} title={`${t('Followers')}: ${d.followerSharePct}%`} />
          <div className="bg-primary-container h-full" style={{ width: `${nonPct}%` }} title={`${t('New people')}: ${nonPct}%`} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-1 mt-2 text-label-sm">
          <span className="flex items-center gap-1.5 text-text-secondary">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
            {t('Followers')}: <strong className="text-text-primary tnum">{formatNumber(followers)} ({d.followerSharePct}%)</strong>
          </span>
          <span className="flex items-center gap-1.5 text-text-secondary">
            <span className="w-2.5 h-2.5 rounded-full bg-primary-container" />
            {t('New people')}: <strong className="text-text-primary tnum">{formatNumber(nonFollowers)} ({nonPct}%)</strong>
          </span>
        </div>
      </div>

      <div className="mb-5">
        <div className="text-label-md font-semibold text-text-primary mb-2">{t('Where they saw it')}</div>
        <div className="space-y-2.5">
          {d.traffic.map((s, i) => (
            <div key={s.label}>
              <div className="flex justify-between gap-2 text-label-sm mb-1">
                <span className="text-text-secondary">{s.label}</span>
                <span className="font-semibold text-text-primary tnum whitespace-nowrap">
                  {s.share}% ({formatCompact((m.reach * s.share) / 100, { fullBelow: 1000 })})
                </span>
              </div>
              <div className="w-full bg-surface-canvas h-2 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', trafficBar[i] ?? 'bg-slate-700')} style={{ width: `${s.share}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-label-md font-semibold text-text-primary mb-2">{t('Interactions')}</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
          {matrix.map((x) => (
            <div key={x.label} className="p-2 bg-surface-canvas rounded-xl">
              <div className="text-[0.75rem] text-text-secondary">{t(x.label)}</div>
              <div className={cn('text-label-md font-bold tnum', x.positive ? 'text-emerald-300' : 'text-text-primary')}>{x.value}</div>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

/** Gender, age and top states of the people who saw this post. */
export function AudienceSnapshotCard({ data }: { data: AnalyticsPageData }) {
  const t = useT();
  const a = data.analytics?.audience;
  if (!a) return <UnavailableSection title={t('Who saw it')} reason={t('Only one sample Reel has this detail. See the Audience page for your whole account.')} />;
  const topAge = Math.max(...a.age.map((x) => x.share));
  const genders = [
    { label: msg('Men'), value: a.gender.male, bar: 'bg-slate-600' },
    { label: msg('Women'), value: a.gender.female, bar: 'bg-primary-container' },
  ];

  return (
    <SectionCard
      title={t('Who saw it')}
      subtitle={t('Matches your target audience: {pct}%', { pct: a.alignmentPct })}
      right={<DemoBadge />}
      className="flex flex-col"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div className="p-3 bg-surface-canvas rounded-xl">
          <div className="text-label-md font-semibold text-text-primary mb-2">{t('Gender')}</div>
          <div className="space-y-2">
            {genders.map((g) => (
              <div key={g.label}>
                <div className="flex justify-between text-label-sm mb-1">
                  <span className="text-text-secondary">{t(g.label)}</span>
                  <span className="font-bold text-text-primary tnum">{g.value}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', g.bar)} style={{ width: `${g.value}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[0.75rem] text-text-tertiary">{t('Other or not given: {pct}%', { pct: a.gender.unknown })}</div>
        </div>
        <div className="p-3 bg-surface-canvas rounded-xl">
          <div className="text-label-md font-semibold text-text-primary mb-2">{t('Age')}</div>
          <div className="space-y-1 text-label-sm">
            {a.age.map((x) => (
              <div key={x.label} className="flex justify-between items-center">
                <span className="text-text-secondary">
                  {x.label}
                  {x.note && ` (${x.note})`}
                </span>
                <span className={cn('tnum', x.share === topAge ? 'font-bold text-primary' : x.share >= 20 ? 'font-semibold text-text-primary' : 'font-medium text-text-secondary')}>
                  {x.share}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1 text-label-sm mb-2">
        <span className="text-label-md font-semibold text-text-primary">{t('Top states')}</span>
        <span className="text-text-secondary">{a.ruralShareLabel}</span>
      </div>
      <div className="space-y-2">
        {a.states.map((s, i) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-24 text-label-sm font-medium text-text-secondary truncate">{s.label}</span>
            <div className="flex-1 bg-surface-canvas h-2.5 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full', stateBar[i] ?? 'bg-primary-container/30')} style={{ width: `${s.share}%` }} />
            </div>
            <span className="w-12 text-right text-label-sm font-bold text-text-primary tnum">{s.share}%</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
