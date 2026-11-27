import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Misc';
import { ErrorState, PageSkeleton, QueryState } from '@/components/ui/States';
import { AdsTabs } from '@/features/ads/AdsTabs';
import { DraftDetail } from '@/features/ad-studio/DraftDetail';
import { DraftsList } from '@/features/ad-studio/DraftsList';
import { StudioBuilder } from '@/features/ad-studio/StudioBuilder';
import { DemoTitleBadge } from '@/features/ads-reports/ReportUi';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { adStudioService } from '@/services/adStudio';
import type { StudioOptions } from '@/types/adStudio';

function DraftView({ id, options, onBack }: { id: string; options: StudioOptions; onBack: () => void }) {
  const t = useT();
  const q = useQuery(`ads:studio:draft:${id}`, () => adStudioService.draft(id));
  return (
    <QueryState query={q} loading={<PageSkeleton kpis={3} />} error={(err, retry) => <ErrorState title={t('Could not load this draft')} error={err} onRetry={retry} />}>
      {(draft) => <DraftDetail draft={draft} options={options} onDeleted={onBack} />}
    </QueryState>
  );
}

/** Ads → Ad Studio: build an ad step by step (dry run), add a picture, then publish paused and start it (Admin/Owner). */
export default function AdStudioPage() {
  const t = useT();
  useDocumentTitle(t('Ad Studio'));
  const [params, setParams] = useSearchParams();
  const draftId = params.get('draft');
  const options = useQuery('ads:studio:options', adStudioService.options);

  const openDraft = (id: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('draft', id);
        else next.delete('draft');
        return next;
      },
      { replace: false },
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Ad Studio')}
        titleAddon={<DemoTitleBadge />}
        description={t('Build a recruitment ad step by step. Building is always a dry run: you see exactly what would go to Meta before anything is sent.')}
        actions={
          draftId && (
            <Button icon="add" onClick={() => openDraft(null)}>
              {t('New ad')}
            </Button>
          )
        }
      />
      <AdsTabs />
      <QueryState query={options} error={(err, retry) => <ErrorState title={t('Could not load Ad Studio')} error={err} onRetry={retry} />}>
        {(opts) => (
          <div className="space-y-4">
            {opts.notes.length > 0 && (
              <Notice tone="info" title={t('Good to know')}>
                <ul className="list-disc pl-4 space-y-0.5">
                  {opts.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </Notice>
            )}
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="min-w-0">
                {draftId ? (
                  <>
                    <Button size="xs" variant="ghost" icon="arrow_back" className="mb-3" onClick={() => openDraft(null)}>
                      {t('Back to the builder')}
                    </Button>
                    <DraftView id={draftId} options={opts} onBack={() => openDraft(null)} />
                  </>
                ) : (
                  <StudioBuilder options={opts} onBuilt={(d) => openDraft(d.id)} />
                )}
              </div>
              <div className="xl:sticky xl:top-4 self-start">
                <DraftsList selectedId={draftId} onOpen={openDraft} />
              </div>
            </div>
          </div>
        )}
      </QueryState>
    </div>
  );
}
