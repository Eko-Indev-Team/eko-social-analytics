import { Skeleton } from '@/components/ui/States';
import type { QueryResult } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { AudienceSummary } from '@/types/audience';
import { SectionCard, UnavailableNote } from './SectionCard';

/** Who is watching: gender split, ages and top states from `audienceService.summary()`. */
export function AudienceSnapshot({ query, accountLevelNote, hasMetrics }: { query: QueryResult<AudienceSummary>; accountLevelNote?: boolean; hasMetrics: boolean }) {
  const t = useT();
  return (
    <SectionCard
      icon="group"
      iconClassName="bg-ai-subtle text-ai-accent"
      title={t('Audience')}
      subtitle={accountLevelNote ? t('Whole account (sample data)') : undefined}
      link={{ to: '/audience', label: t('See more') }}
    >
      {!hasMetrics ? (
        <UnavailableNote icon="group">{t('Numbers show up after it starts.')}</UnavailableNote>
      ) : query.status === 'loading' ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-6" />
          <Skeleton className="h-24" />
          <Skeleton className="h-10" />
        </div>
      ) : query.status !== 'success' || !query.data ? (
        <UnavailableNote icon="warning">
          {query.status === 'error' ? `${t('Could not load the audience.')} ${query.error?.message ?? ''}` : t('No audience data yet.')}
        </UnavailableNote>
      ) : (
        <AudienceBody data={query.data} />
      )}
    </SectionCard>
  );
}

function AudienceBody({ data }: { data: AudienceSummary }) {
  const t = useT();
  const { gender } = data;
  const maxAge = Math.max(...data.age.map((a) => a.share));
  const geos = data.topStates.filter((s) => !s.label.startsWith('Other')).slice(0, 5);
  const split = t('Women {female}% · Men {male}% · Other {other}%', { female: gender.female, male: gender.male, other: gender.unknown });
  return (
    <div className="mt-4 flex flex-col gap-5">
      <div>
        <div className="flex flex-wrap justify-between gap-1 text-body-sm mb-1.5">
          <span className="text-text-secondary">{t('Gender')}</span>
          <span className="text-text-primary font-semibold tnum">{split}</span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex" role="img" aria-label={split}>
          <div className="h-full bg-amber-400" style={{ width: `${gender.female}%` }} />
          <div className="h-full bg-slate-600" style={{ width: `${gender.male}%` }} />
          <div className="h-full bg-slate-700" style={{ width: `${gender.unknown}%` }} />
        </div>
      </div>
      <div>
        <span className="text-body-sm text-text-secondary mb-2 block">{t('Age')}</span>
        <div className="space-y-1.5">
          {data.age.map((a) => {
            const top = a.share === maxAge;
            return (
              <div key={a.label} className="flex items-center gap-2 text-xs">
                <span className={cn('w-12', top ? 'text-text-primary font-bold' : 'text-text-secondary font-medium')}>{a.label}</span>
                <div className="flex-1 h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className={cn('h-full rounded-full', top ? 'bg-gold' : a.share >= 15 ? 'bg-primary-container' : 'bg-slate-700')} style={{ width: `${a.share}%` }} />
                </div>
                <span className="w-8 text-right font-bold text-text-primary tnum">{a.share}%</span>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <span className="text-body-sm text-text-secondary mb-2 block">{t('Top states')}</span>
        <div className="flex flex-wrap gap-1.5">
          {geos.map((g, i) => (
            <span
              key={g.label}
              className={cn(
                'px-2.5 py-1 rounded-full bg-surface-canvas text-label-md',
                i === 0 ? 'text-text-primary font-semibold' : 'text-text-secondary',
              )}
            >
              {g.label} <span className={cn('tnum', i === 0 && 'text-primary font-bold')}>{g.share}%</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
