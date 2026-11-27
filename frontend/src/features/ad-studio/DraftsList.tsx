import { Card, CardHeader } from '@/components/ui/Card';
import { ImageWithFallback } from '@/components/ui/Misc';
import { QueryState, Skeleton } from '@/components/ui/States';
import { apiAssetUrl } from '@/features/ads-reports/reportFormat';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { cn, formatDate } from '@/lib/format';
import { adStudioService } from '@/services/adStudio';
import { DraftStatusBadges, inr } from './studioUi';

/** Recent Ad Studio drafts (newest first). */
export function DraftsList({ selectedId, onOpen }: { selectedId?: string | null; onOpen: (id: string) => void }) {
  const t = useT();
  const q = useQuery('ads:studio:drafts', adStudioService.drafts);
  return (
    <Card className="p-5 space-y-3">
      <CardHeader title={t('Your drafts')} subtitle={t('Every build is saved here.')} />
      <QueryState
        query={q}
        loading={<Skeleton className="h-32" />}
        empty={<p className="text-body-sm text-text-tertiary py-4 text-center">{t('No drafts yet. Build one with the steps.')}</p>}
      >
        {(drafts) => (
          <ul className="divide-y divide-border-subtle">
            {drafts.map((d) => {
              const src = d.imageUrl?.startsWith('blob:') ? d.imageUrl : apiAssetUrl(d.imageUrl);
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(d.id)}
                    className={cn('w-full text-left flex gap-3 py-2.5 px-2 rounded-lg hover:bg-surface-canvas', selectedId === d.id && 'bg-surface-canvas')}
                  >
                    <ImageWithFallback src={d.hasImage && src ? src : undefined} alt={d.headline} className="w-12 h-12 rounded-md shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-label-md font-semibold text-text-primary truncate">{d.headline || t('Untitled ad')}</span>
                      <span className="block text-[0.6875rem] text-text-tertiary truncate">
                        {formatDate(d.createdAt)} · {d.districts.length ? d.districts.join(', ') : t('All of India')} · {inr(d.dailyBudget)}
                        {t('/day')}
                      </span>
                      <span className="block mt-1">
                        <DraftStatusBadges status={d.status} mode={d.mode} />
                      </span>
                      {d.error && <span className="block text-[0.6875rem] text-error truncate">{d.error}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>
    </Card>
  );
}
