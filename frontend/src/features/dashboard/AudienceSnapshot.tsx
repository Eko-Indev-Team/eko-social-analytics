import { Link } from 'react-router-dom';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { audienceService } from '@/services/audience';

/** Audience Snapshot card: gender split, top age brackets, top geographies (canonical audience summary). */
export function AudienceSnapshot() {
  const t = useT();
  const audience = useQuery('audience:summary', audienceService.summary);

  return (
    <section className="bg-surface-card border border-border-strong rounded-xl shadow-card p-5" aria-labelledby="dash-audience-title">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 id="dash-audience-title" className="font-heading text-[1.0625rem] font-semibold text-text-primary">
            {t('Your audience')}
          </h3>
          <p className="text-body-sm text-text-secondary">{t('Who watches your posts')}</p>
        </div>
        <Link to="/audience" className="text-xs font-semibold text-text-primary hover:text-primary-container">
          {t('See all')} →
        </Link>
      </div>
      <QueryState
        query={audience}
        loading={
          <div className="space-y-4">
            <Skeleton className="h-8" />
            <Skeleton className="h-20" />
            <Skeleton className="h-12" />
          </div>
        }
        empty={<p className="text-body-sm text-text-secondary py-6 text-center">{t('No audience data yet.')}</p>}
      >
        {(a) => {
          const ages = [...a.age].sort((x, y) => y.share - x.share).slice(0, 3);
          const topShare = ages[0]?.share || 100;
          const geos = a.topStates.filter((s) => !s.label.startsWith('Other')).slice(0, 4);
          return (
            <>
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-text-primary tnum">{t('Men')} {a.gender.male}%</span>
                  <span className="font-semibold text-text-secondary tnum">{t('Women')} {a.gender.female}%</span>
                </div>
                <div
                  className="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex"
                  role="img"
                  aria-label={`${t('Men')} ${a.gender.male}%, ${t('Women')} ${a.gender.female}%`}
                >
                  <div className="bg-text-subtle h-full" style={{ width: `${a.gender.male}%` }} />
                  <div className="bg-primary-container h-full" style={{ width: `${a.gender.female}%` }} />
                </div>
              </div>
              <div className="mb-4">
                <span className="text-[0.75rem] font-semibold text-text-secondary block mb-2">{t('Age')}</span>
                <div className="space-y-2">
                  {ages.map((age, i) => (
                    <div key={age.label} className="flex items-center gap-2 text-xs">
                      <span className={cn('w-14 shrink-0 tnum', i === 0 ? 'font-semibold text-text-primary' : 'text-text-secondary')}>{age.label}</span>
                      <span className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                        <span className={cn('block h-full rounded-full', i === 0 ? 'bg-primary-container' : 'bg-text-subtle')} style={{ width: `${(age.share / topShare) * 100}%` }} />
                      </span>
                      <span className="w-9 text-right tnum font-semibold text-text-primary">{age.share}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[0.75rem] font-semibold text-text-secondary block mb-2">{t('Top places')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {geos.map((g) => (
                    <span key={g.label} className="px-2.5 py-1 rounded-full bg-surface-canvas border border-border-strong text-xs font-medium text-text-primary tnum">
                      {g.label} ({g.share}%)
                    </span>
                  ))}
                </div>
              </div>
            </>
          );
        }}
      </QueryState>
    </section>
  );
}
