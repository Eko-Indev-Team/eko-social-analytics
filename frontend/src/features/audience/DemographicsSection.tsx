import { msg, useT } from '@/i18n/I18nContext';
import { cn, formatCompact } from '@/lib/format';
import { AudienceCard } from './AudienceCard';
import { signedPct, type AudiencePageData } from './model';

/** Gender split (5 cols) + age groups (7 cols). */
export function DemographicsSection({ data, compare }: { data: AudiencePageData; compare: boolean }) {
  const t = useT();
  const { summary, overview } = data;
  const g = summary.gender;
  const reach = overview.reach.value;
  const coreShare = Math.max(...summary.age.map((a) => a.share));
  const genders = [
    { label: msg('Men'), share: g.male, dot: 'bg-sky-600' },
    { label: msg('Women'), share: g.female, dot: 'bg-gold' },
    { label: msg('Unknown'), share: g.unknown, dot: 'bg-slate-600' },
  ];

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <AudienceCard
        className="lg:col-span-5"
        title={t('Gender')}
        subtitle={t('Share of people reached')}
        info={t('On a live account this comes from Instagram profile data, grouped for privacy. Profiles without a gender count as Unknown.')}
      >
        <div
          className="h-2.5 w-full rounded-full overflow-hidden flex bg-slate-800 mb-5"
          role="img"
          aria-label={t('Men {men}%, Women {women}%, Unknown {unknown}%', { men: g.male, women: g.female, unknown: g.unknown })}
        >
          <div className="bg-sky-600 h-full" style={{ width: `${g.male}%` }} />
          <div className="bg-gold h-full" style={{ width: `${g.female}%` }} />
          <div className="bg-slate-600 h-full" style={{ width: `${g.unknown}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {genders.map((x) => (
            <div key={x.label}>
              <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
                <span className={cn('w-2 h-2 rounded-full', x.dot)} />
                {t(x.label)}
              </div>
              <div className="font-heading text-[1.375rem] text-text-primary font-bold mt-1 tnum">{x.share}%</div>
              <div className="text-[0.75rem] text-text-tertiary tnum">
                {t('{count} people', { count: formatCompact((reach * x.share) / 100, { fullBelow: 1000 }) })}
              </div>
            </div>
          ))}
        </div>
      </AudienceCard>

      <AudienceCard className="lg:col-span-7" title={t('Age')} subtitle={compare ? t('Share of people reached, and change vs last month') : t('Share of people reached')}>
        <div className="flex flex-col gap-3 text-body-sm">
          {summary.age.map((a) => {
            const isCore = a.share === coreShare;
            return (
              <div key={a.label} className="flex items-center gap-3" title={a.note}>
                <span className={cn('w-12 text-xs tnum', isCore ? 'font-semibold text-text-primary' : 'text-text-secondary')}>{a.label}</span>
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', isCore ? 'bg-primary-container' : 'bg-slate-600')} style={{ width: `${a.share}%` }} />
                </div>
                <span className="w-10 text-right text-xs font-semibold tnum text-text-primary">{a.share}%</span>
                <span className="w-14 sm:w-16 text-right text-xs tnum text-text-tertiary">{formatCompact(a.audience, { fullBelow: 1000 })}</span>
                {compare && (
                  <span className={cn('w-12 text-right text-xs font-semibold tnum', a.deltaPct >= 0 ? 'text-status-active' : 'text-error')}>{signedPct(a.deltaPct)}</span>
                )}
              </div>
            );
          })}
        </div>
      </AudienceCard>
    </section>
  );
}
