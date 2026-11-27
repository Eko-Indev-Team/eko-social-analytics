import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { useToast } from '@/components/ui/Toast';
import { useT } from '@/i18n/I18nContext';
import { cn, formatNumber } from '@/lib/format';
import type { CampaignCommentSnapshot, CommentIntentTone } from '@/types/campaigns';
import type { Campaign } from '@/types/domain';
import { SectionCard, UnavailableNote } from './SectionCard';

const intentTone: Record<CommentIntentTone, string> = {
  emerald: 'bg-status-active-subtle text-status-active',
  amber: 'bg-amber-400/15 text-amber-400',
  neutral: 'bg-surface-card-subtle text-text-secondary',
};

const noteTone = { primary: 'text-primary font-semibold', secondary: 'text-text-secondary font-medium', tertiary: 'text-text-tertiary' } as const;

/** Comment totals, mood split and a few sample comments with what they want. Totals come from campaign metrics. */
export function CommentsSnapshot({ campaign, snapshot }: { campaign: Campaign; snapshot: CampaignCommentSnapshot | undefined }) {
  const t = useT();
  const toast = useToast();
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const m = campaign.metrics;
  const items = snapshot?.items.filter((i) => !archived.has(i.id)) ?? [];

  const archive = (id: string, handle: string) => {
    setArchived((prev) => new Set(prev).add(id));
    toast({ tone: 'demo', title: t('Comment from @{handle} hidden', { handle }), description: t('Hidden here only. Nothing changed on Instagram.') });
  };

  return (
    <SectionCard
      icon="chat_bubble"
      iconClassName="bg-status-active-subtle text-status-active"
      title={t('Comments')}
      subtitle={m ? t('Total: {count}', { count: formatNumber(m.comments) }) : undefined}
      link={{ to: '/comments', label: t('See all') }}
    >
      {!m ? (
        <UnavailableNote icon="chat_bubble">{t('Numbers show up after it starts.')}</UnavailableNote>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {snapshot && (
              <>
                <span className="px-2.5 py-1 rounded-full bg-status-active-subtle text-status-active text-label-md font-semibold tnum">
                  {t('Happy: {pct}%', { pct: snapshot.sentiment.positive })}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-surface-card-subtle text-text-secondary text-label-md font-semibold tnum">
                  {t('Neutral: {pct}%', { pct: snapshot.sentiment.neutral })}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-rose-900/40 text-rose-300 text-label-md font-semibold tnum">{t('Unhappy: {pct}%', { pct: snapshot.sentiment.negative })}</span>
              </>
            )}
            <span className="px-2.5 py-1 rounded-full bg-amber-400/15 text-amber-400 text-label-md font-semibold tnum">{t('Possible leads: {count}', { count: m.leads })}</span>
            {snapshot && <InfoTip text={t('Mood and intent are guessed by AI from sample data.')} />}
          </div>
          {!snapshot ? (
            <UnavailableNote>{t('No mood breakdown for this campaign in the sample data.')}</UnavailableNote>
          ) : items.length === 0 ? (
            <UnavailableNote icon="inventory_2">{t('All sample comments are hidden.')}</UnavailableNote>
          ) : (
            <div className="pt-4 flex flex-col gap-3">
              {items.map((c) => (
                <article key={c.id} className="p-3.5 bg-surface-canvas rounded-lg flex flex-col gap-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-label-md font-semibold text-text-primary">@{c.handle}</span>
                      <span className="text-[0.75rem] text-text-tertiary">
                        {c.ago} ·{' '}
                        {c.contentId ? (
                          <Link to={`/content/${c.contentId}`} className="hover:text-text-primary hover:underline">
                            {c.contentRef}
                          </Link>
                        ) : (
                          c.contentRef
                        )}
                      </span>
                    </div>
                    <span className={cn('px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold flex items-center gap-1', intentTone[c.intentTone])}>
                      {c.aiInferred && <Icon name="auto_awesome" className="text-[0.6875rem]" label={t('AI guess')} />}
                      {c.intentLabel}
                    </span>
                  </div>
                  <p className="text-body-md text-text-primary">&ldquo;{c.text}&rdquo;</p>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className={noteTone[c.noteTone]}>{c.note}</span>
                    {c.action === 'reply' ? (
                      <Link to="/comments" className="text-label-md text-text-primary hover:text-primary-container font-semibold shrink-0">
                        {t('Reply')} →
                      </Link>
                    ) : (
                      <button type="button" onClick={() => archive(c.id, c.handle)} className="text-label-md text-text-secondary hover:text-text-primary font-semibold shrink-0">
                        {t('Hide')}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
