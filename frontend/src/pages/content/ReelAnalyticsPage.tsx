import { useParams } from 'react-router-dom';
import { LinkButton } from '@/components/ui/Button';
import { EmptyState, ErrorState, QueryState, Skeleton } from '@/components/ui/States';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { NotFoundError } from '@/lib/api/source';
import { PerformanceAuditCard, ReelFooterNav } from '@/features/content/analytics/AuditAndFooter';
import { CommentStreamCard, LeadAttributionCard } from '@/features/content/analytics/CommentsLeadsCards';
import { AudienceSnapshotCard, DiscoveryCard } from '@/features/content/analytics/DiscoveryAudienceCards';
import { loadAnalyticsPage, type AnalyticsPageData } from '@/features/content/analytics/model';
import { ReelHeader } from '@/features/content/analytics/ReelHeader';
import { AiVerdictBanner, ReelKpiGrid } from '@/features/content/analytics/ReelKpiGrid';
import { ReelPreviewCard } from '@/features/content/analytics/ReelPreviewCard';
import { WatchRetentionSection } from '@/features/content/analytics/WatchRetentionSection';

function AnalyticsSkeleton() {
  const t = useT();
  return (
    <div className="space-y-5" role="status" aria-label={t('Loading post details')}>
      <Skeleton className="h-20" />
      <div className="grid grid-cols-12 gap-5">
        <Skeleton className="col-span-12 lg:col-span-4 h-[520px]" />
        <div className="col-span-12 lg:col-span-8 grid grid-cols-2 gap-4 content-start">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

function AnalyticsView({ data }: { data: AnalyticsPageData }) {
  return (
    <div className="space-y-6">
      <ReelHeader data={data} />
      <section className="grid grid-cols-12 gap-5">
        <ReelPreviewCard data={data} />
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
          <ReelKpiGrid data={data} />
          <AiVerdictBanner data={data} />
        </div>
      </section>
      <div>
        <WatchRetentionSection data={data} />
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <DiscoveryCard data={data} />
          <AudienceSnapshotCard data={data} />
        </section>
        <section className="grid grid-cols-12 gap-5 mb-6">
          <CommentStreamCard data={data} />
          <LeadAttributionCard data={data} />
        </section>
        <PerformanceAuditCard data={data} />
        <ReelFooterNav data={data} />
      </div>
    </div>
  );
}

export default function ReelAnalyticsPage() {
  const t = useT();
  const { contentId = '' } = useParams();
  const query = useQuery(`content:analytics-page:${contentId}`, () => loadAnalyticsPage(contentId));
  useDocumentTitle(query.data ? t('{title} – details', { title: query.data.item.title }) : t('Post details'));

  return (
    <QueryState
      query={query}
      loading={<AnalyticsSkeleton />}
      empty={
        <EmptyState
          icon="movie_off"
          title={t('No numbers for this post yet')}
          description={t('They show up after the first sync.')}
          action={
            <LinkButton to="/content" icon="arrow_back">
              {t('Back to Content')}
            </LinkButton>
          }
        />
      }
      error={(err, retry) =>
        err instanceof NotFoundError ? (
          <EmptyState
            icon="search_off"
            title={t('Post not found')}
            description={t('This post is not in your workspace.')}
            action={
              <LinkButton to="/content" variant="primary" icon="arrow_back">
                {t('Back to Content')}
              </LinkButton>
            }
          />
        ) : (
          <ErrorState title={t('Could not load this post')} error={err} onRetry={retry} />
        )
      }
    >
      {(data) => <AnalyticsView data={data} />}
    </QueryState>
  );
}
