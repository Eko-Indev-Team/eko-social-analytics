import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n/I18nContext';
import { brandClass } from '@/lib/brandClass';
import { cn } from '@/lib/format';
import { AudienceCard } from './AudienceCard';
import type { AudiencePageData } from './model';

/** AI notes about the audience (6 cols) + AI-guessed audience types (6 cols). */
export function AiAudienceSection({ data }: { data: AudiencePageData }) {
  const t = useT();
  const { aiAnalysis, personas } = data.intel;
  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <AudienceCard
        className="lg:col-span-6"
        title={
          <span className="flex items-center gap-2">
            <Icon name="auto_awesome" className="text-ai-accent text-[1.125rem]" />
            {t('AI notes')}
          </span>
        }
        subtitle={t('What stands out about your audience')}
        info={t('Written by AI from sample data. Check before you act on it.')}
      >
        <div className="flex flex-col gap-3 text-body-sm">
          {aiAnalysis.map((a) => (
            <div key={a.title} className={cn('flex items-start gap-2.5', a.recommendation && 'p-3 rounded-lg bg-ai-subtle')}>
              <Icon name={a.icon} className={cn('text-[1.125rem] flex-shrink-0 mt-0.5', brandClass(a.iconClassName))} />
              <div>
                <strong className={cn('font-semibold block mb-0.5', a.recommendation ? 'text-ai-accent' : 'text-text-primary')}>{a.title}</strong>
                <p className="text-text-secondary">{a.body}</p>
              </div>
            </div>
          ))}
        </div>
      </AudienceCard>

      <AudienceCard
        className="lg:col-span-6"
        title={t('Audience types')}
        subtitle={t('Groups guessed by AI from likes, comments and views')}
        info={t('AI estimate from how people interact. Not profile data from Instagram.')}
      >
        <div className="flex flex-col gap-2 text-body-sm">
          {personas.map((p, i) => (
            <div key={p.name} className="p-3 bg-surface-canvas rounded-lg">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <strong className="font-semibold text-text-primary truncate">{p.name}</strong>
                  {p.score !== undefined && (
                    <span
                      className={cn(
                        'text-[0.6875rem] px-2 py-0.5 rounded-full font-semibold shrink-0',
                        i === 0 ? 'bg-amber-400/15 text-amber-400' : 'bg-slate-800 text-text-secondary',
                      )}
                    >
                      {t('Score {score}', { score: p.score })}
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-text-primary tnum shrink-0">{t('{pct}% of audience', { pct: p.sharePct })}</span>
              </div>
              <div className="text-xs text-text-secondary flex flex-wrap items-center justify-between gap-1">
                <span>{p.potential}</span>
                <span>{t('Likes: {interest}', { interest: p.interest })}</span>
              </div>
            </div>
          ))}
        </div>
      </AudienceCard>
    </section>
  );
}
