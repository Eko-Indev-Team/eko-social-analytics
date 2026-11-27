import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, ErrorState, PageSkeleton, QueryState } from '@/components/ui/States';
import { PublicationList } from '@/features/instagram/PublicationList';
import { PublishComposer } from '@/features/instagram/PublishComposer';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { isDemoMode } from '@/lib/config';
import { instagramPublishingService } from '@/services/instagramPublishing';
import type { PublishingStatus } from '@/types/instagramPublishing';

function Notes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <ul className="space-y-1">
      {notes.map((n) => (
        <li key={n} className="text-[0.75rem] text-text-tertiary flex gap-1.5">
          <Icon name="info" className="text-[0.875rem] text-status-completed mt-0.5 shrink-0" />
          {n}
        </li>
      ))}
    </ul>
  );
}

function PublishBody({ status }: { status: PublishingStatus }) {
  const t = useT();
  const firstUsable = status.accounts.find((a) => a.canPublish) ?? status.accounts[0];
  const [accountId, setAccountId] = useState(firstUsable?.id ?? '');
  const usernames = useMemo(() => Object.fromEntries(status.accounts.map((a) => [a.id, a.username])), [status.accounts]);

  let blocker: JSX.Element | null = null;
  if (isDemoMode)
    blocker = (
      <EmptyState
        icon="send"
        title={t('Connect a real account to publish')}
        description={t('Sample mode has no real Instagram accounts. Run SocialBoard in API mode and connect an account to publish posts here.')}
      />
    );
  else if (!status.enabled)
    blocker = <EmptyState icon="settings" title={t('Instagram is not set up')} description={t('The server is missing its Instagram app settings. Ask an Owner to set them up.')} />;
  else if (status.accounts.length === 0)
    blocker = (
      <EmptyState
        icon="link"
        title={t('Connect an Instagram account first')}
        description={t('Connect an account with the content publishing permission, then come back here.')}
        action={
          <LinkButton to="/accounts" variant="primary" icon="add_link">
            {t('Go to accounts')}
          </LinkButton>
        }
      />
    );

  return (
    <div className="space-y-4">
      <Notes notes={status.notes} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="min-w-0">{blocker ?? <PublishComposer status={status} accountId={accountId} onAccountChange={setAccountId} />}</div>
        <div className="min-w-0">
          <PublicationList usernames={usernames} />
        </div>
      </div>
    </div>
  );
}

/** Instagram → Publish: post or schedule photos, carousels, reels and stories on a connected account (Owner/Admin). */
export default function PublishPage() {
  const t = useT();
  useDocumentTitle(t('Publish'));
  const status = useQuery('ig:publish:status', instagramPublishingService.status, { isEmpty: () => false });
  return (
    <div className="space-y-6">
      <PageHeader title={t('Publish')} description={t('Post or schedule photos, carousels, reels and stories on your Instagram accounts.')} />
      <QueryState query={status} loading={<PageSkeleton kpis={0} />} error={(err, retry) => <ErrorState title={t('Could not load publishing')} error={err} onRetry={retry} />}>
        {(s) => <PublishBody status={s} />}
      </QueryState>
    </div>
  );
}
