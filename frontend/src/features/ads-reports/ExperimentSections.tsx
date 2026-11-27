import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback } from '@/components/ui/Misc';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { CreativeAnalysis, Experiment, ExperimentsOut, IdeaGroup } from '@/types/adsReports';
import { apiAssetUrl, asOfDate, count, money, pct, PRIORITY_LABEL } from './reportFormat';
import { ConfidenceBadge, KindTable, ReportSection, VerdictBadge } from './ReportUi';

/** One experiment: question, what we did, results table, what it showed, verdict + confidence, don't-repeat. */
export function ExperimentCard({ experiment: e, index }: { experiment: Experiment; index: number }) {
  const t = useT();
  return (
    <Card className="p-5 space-y-4" data-testid={`experiment-${e.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-heading text-[1.0625rem] font-semibold text-text-primary">
          {index + 1}. {e.title}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <VerdictBadge verdict={e.verdict} label={e.verdictLabel} />
          <ConfidenceBadge confidence={e.confidence} why={e.confidenceWhy} />
        </div>
      </div>
      <dl className="grid gap-3 md:grid-cols-2">
        <div>
          <dt className="text-[0.75rem] font-semibold text-text-tertiary">{t('The question')}</dt>
          <dd className="text-body-sm text-text-primary mt-0.5">{e.question}</dd>
        </div>
        <div>
          <dt className="text-[0.75rem] font-semibold text-text-tertiary">{t('What we did')}</dt>
          <dd className="text-body-sm text-text-primary mt-0.5">{e.did}</dd>
        </div>
      </dl>
      {e.rows.length > 0 ? (
        <KindTable columns={e.columns} rows={e.rows} bestRow={e.bestRow} caption={e.title} />
      ) : (
        <p className="text-body-sm text-text-tertiary">{t('No results to show yet.')}</p>
      )}
      {e.learning.length > 0 && (
        <div>
          <h4 className="text-[0.75rem] font-semibold text-text-tertiary">{t('What it showed')}</h4>
          <ul className="mt-1 space-y-1">
            {e.learning.map((l, i) => (
              <li key={i} className="text-body-sm text-text-primary flex gap-2">
                <Icon name="lightbulb" className="text-[1rem] text-gold mt-0.5 shrink-0" />
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {e.dontRepeat && (
        <p className="text-body-sm rounded-lg bg-error-container/50 border border-error/20 px-3 py-2 flex gap-2">
          <Icon name="block" className="text-[1rem] text-error mt-0.5 shrink-0" />
          <span>
            <b className="text-text-primary">{t("Don't repeat:")}</b> <span className="text-text-secondary">{e.dontRepeat}</span>
          </span>
        </p>
      )}
      {e.note && <p className="text-[0.75rem] text-text-tertiary">{e.note}</p>}
    </Card>
  );
}

export function VerdictSummary({ data }: { data: ExperimentsOut }) {
  const t = useT();
  const entries = Object.entries(data.verdictCounts).filter(([, n]) => n > 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-body-sm text-text-secondary">{t('{count} experiments:', { count: data.experiments.length })}</span>
      {entries.map(([code, n]) => (
        <span key={code} className="inline-flex items-center gap-1">
          <VerdictBadge verdict={code as Experiment['verdict']} label={data.verdictNames[code]} />
          <b className="text-body-sm tnum text-text-primary">{n}</b>
        </span>
      ))}
    </div>
  );
}

export function MistakesSection({ data }: { data: ExperimentsOut }) {
  const t = useT();
  if (data.mistakes.length === 0) return null;
  return (
    <ReportSection icon="report" title={t('Mistakes to avoid')} subtitle={t('Pulled from the experiments below.')}>
      <ul className="space-y-2">
        {data.mistakes.map((m) => (
          <li key={m.experimentId} className="text-body-sm flex gap-2">
            <Icon name="block" className="text-[1rem] text-error mt-0.5 shrink-0" />
            <span>
              <span className="text-text-primary">{m.text}</span> <span className="text-text-tertiary">({m.fromExperiment})</span>
            </span>
          </li>
        ))}
      </ul>
    </ReportSection>
  );
}

export function CreativeSection({ creative }: { creative: CreativeAnalysis }) {
  const t = useT();
  return (
    <ReportSection
      icon="imagesmode"
      title={t('Pictures and captions')}
      subtitle={t('Which pictures and captions were used, and how they did.')}
      actions={
        !creative.pending && (
          <>
            <VerdictBadge verdict={creative.verdict} label={creative.verdictLabel} />
            <ConfidenceBadge confidence={creative.confidence} why={creative.confidenceWhy} />
          </>
        )
      }
    >
      {creative.pending ? (
        <p className="text-body-sm text-text-secondary">{t('No pictures or captions saved yet. They appear after the next sync or import.')}</p>
      ) : (
        <>
          <p className="text-body-sm text-text-secondary">{t('{covered} of {total} ads have a saved picture and caption.', { covered: creative.nCovered, total: creative.nAds })}</p>
          {creative.learning.length > 0 && (
            <ul className="space-y-1">
              {creative.learning.map((l, i) => (
                <li key={i} className="text-body-sm text-text-primary flex gap-2">
                  <Icon name="lightbulb" className="text-[1rem] text-gold mt-0.5 shrink-0" />
                  {l}
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {creative.groups.map((g) => (
              <div key={`${g.channel}-${g.adId}`} className="rounded-lg border border-border-strong bg-surface-card-subtle overflow-hidden flex flex-col">
                <ImageWithFallback src={apiAssetUrl(g.imageUrl) ?? undefined} alt={g.headline || t('Ad picture')} className="h-36 w-full" />
                <div className="p-3 space-y-1.5 flex-1">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={g.channel === 'Lead Form' ? 'completed' : 'ai'}>{g.channel === 'Lead Form' ? t('Lead Form') : t('Website')}</Badge>
                    {g.imageType && <Badge>{g.imageType}</Badge>}
                    {g.cta && <Badge tone="neutral">{g.cta}</Badge>}
                  </div>
                  {g.headline && <p className="text-label-md font-semibold text-text-primary">{g.headline}</p>}
                  <p className="text-[0.75rem] text-text-secondary line-clamp-3">{g.primaryText}</p>
                  <dl className="grid grid-cols-3 gap-1 pt-1 text-[0.6875rem]">
                    <div>
                      <dt className="text-text-tertiary">{t('Spend')}</dt>
                      <dd className="font-semibold tnum">{money(g.spend)}</dd>
                    </div>
                    <div>
                      <dt className="text-text-tertiary">{t('Results')}</dt>
                      <dd className="font-semibold tnum">{count(g.results)}</dd>
                    </div>
                    <div>
                      <dt className="text-text-tertiary">{t('Cost / quality')}</dt>
                      <dd className="font-semibold tnum">{money(g.costPerQuality)}</dd>
                    </div>
                  </dl>
                  <p className="text-[0.6875rem] text-text-tertiary">
                    {t('Quality')} {count(g.quality)} ({pct(g.qualityRate, 0)}) · {g.built}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {creative.traitTables.map((tt) => (
            <div key={tt.title} className="space-y-2">
              <h4 className="text-label-md font-semibold text-text-primary">{tt.title}</h4>
              <KindTable columns={tt.columns} rows={tt.rows} caption={tt.title} />
            </div>
          ))}
        </>
      )}
    </ReportSection>
  );
}

function IdeaGroupCard({ group }: { group: IdeaGroup }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const items = open ? group.items : group.items.slice(0, 3);
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-label-md font-semibold text-text-primary flex items-center gap-2 flex-wrap">
          {group.name}
          {group.asOf && <Badge tone="neutral" icon="event">{t('as of {date}', { date: asOfDate(group.asOf) })}</Badge>}
        </h4>
        {group.intro && <p className="text-body-sm text-text-tertiary mt-0.5">{group.intro}</p>}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((idea, i) => (
          <div key={`${idea.title}-${i}`} className="rounded-lg border border-border-strong p-3 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={idea.priority === 'High' ? 'active' : idea.priority === 'Medium' ? 'amber' : 'neutral'}>{t(PRIORITY_LABEL[idea.priority] ?? idea.priority)}</Badge>
              <Badge tone="neutral">{idea.basis}</Badge>
              {idea.effort && <span className="text-[0.6875rem] text-text-tertiary">{t('Effort: {effort}', { effort: idea.effort })}</span>}
              {idea.asOf && <span className="text-[0.6875rem] text-text-tertiary">{t('as of {date}', { date: asOfDate(idea.asOf) })}</span>}
            </div>
            <p className="text-label-md font-semibold text-text-primary">{idea.title}</p>
            <p className="text-[0.8125rem] text-text-secondary">
              <b>{t('Why:')}</b> {idea.why}
            </p>
            <p className="text-[0.8125rem] text-text-secondary">
              <b>{t('How:')}</b> {idea.how}
            </p>
            <p className="text-[0.8125rem] text-text-secondary">
              <b>{t('Measure:')}</b> {idea.measure}
            </p>
          </div>
        ))}
      </div>
      {group.items.length > 3 && (
        <Button size="xs" variant="ghost" icon={open ? 'expand_less' : 'expand_more'} onClick={() => setOpen((o) => !o)}>
          {open ? t('Show fewer') : t('Show all {count}', { count: group.items.length })}
        </Button>
      )}
    </div>
  );
}

export function IdeasSection({ data }: { data: ExperimentsOut }) {
  const t = useT();
  if (data.ideaGroups.length === 0) return null;
  return (
    <ReportSection icon="tips_and_updates" title={t('What to try next ({count} ideas)', { count: data.nIdeas })}>
      <div className="space-y-6">
        {data.ideaGroups.map((g) => (
          <IdeaGroupCard key={g.name} group={g} />
        ))}
      </div>
    </ReportSection>
  );
}

export function CompetitorsSection({ data }: { data: ExperimentsOut }) {
  const t = useT();
  if (data.competitors.length === 0) return null;
  return (
    <ReportSection
      icon="storefront"
      title={t('What competitors and the market do')}
      actions={<Badge tone="amber" icon="event">{t('as of {date}', { date: asOfDate(data.competitorsAsOf) })}</Badge>}
    >
      {data.competitorsAsOfNote && <p className="text-body-sm text-text-tertiary">{data.competitorsAsOfNote}</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {data.competitors.map((c, i) => (
          <div key={`${c.who}-${i}`} className="rounded-lg border border-border-strong p-3 space-y-1">
            <p className="text-label-md font-semibold text-text-primary">{c.who}</p>
            <p className="text-[0.8125rem] text-text-secondary">
              <b>{t('What they do:')}</b> {c.does}
            </p>
            <p className="text-[0.8125rem] text-text-secondary">
              <b>{t('What it means for us:')}</b> {c.means}
            </p>
            {c.url && /^https?:\/\//.test(c.url) && (
              <a href={c.url} target="_blank" rel="noopener noreferrer" className={cn('inline-flex items-center gap-1 text-[0.75rem] text-primary hover:underline')}>
                <Icon name="open_in_new" className="text-[0.875rem]" />
                {c.label || t('Source')}
              </a>
            )}
          </div>
        ))}
      </div>
      {data.competitorCaveats.length > 0 && (
        <ul className="text-[0.75rem] text-text-tertiary list-disc pl-5 space-y-0.5">
          {data.competitorCaveats.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      )}
    </ReportSection>
  );
}
