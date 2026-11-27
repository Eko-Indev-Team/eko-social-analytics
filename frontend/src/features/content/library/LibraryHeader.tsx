import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Overlay';
import { msg, useT } from '@/i18n/I18nContext';

const guideItems: Array<{ icon: string; term: string; body: string }> = [
  { icon: 'visibility', term: msg('Views'), body: msg('How many times your post was shown. One person can view it more than once.') },
  { icon: 'group', term: msg('Reach'), body: msg('How many different people saw it. Always the same as or lower than views.') },
  { icon: 'percent', term: msg('Engagement'), body: msg('Likes, comments, shares and saves as a share of people reached.') },
  { icon: 'schedule', term: msg('Watch time'), body: msg('Total hours people spent watching your videos. Photos have no watch time.') },
  { icon: 'timeline', term: msg('Watched to the end'), body: msg('How many viewers were still watching at the last second of a Reel.') },
  { icon: 'badge', term: msg('Leads'), body: msg('People who asked about joining in comments, DMs or the bio link of this post.') },
];

/** Short page title with the "Guide" and "Add content" buttons (both open simple, honest dialogs). */
export function LibraryHeader() {
  const t = useT();
  const [guideOpen, setGuideOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <PageHeader
        title={t('Content')}
        description={t('See how each post and Reel is doing.')}
        actions={
          <>
            <Button variant="secondary" size="md" icon="help_outline" onClick={() => setGuideOpen(true)}>
              {t('Guide')}
            </Button>
            <Button variant="primary" size="md" icon="add" onClick={() => setAddOpen(true)}>
              {t('Add content')}
            </Button>
          </>
        }
      />

      <Modal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title={t('What the numbers mean')}
        icon="help_outline"
        size="lg"
        footer={
          <Button variant="primary" onClick={() => setGuideOpen(false)}>
            {t('Got it')}
          </Button>
        }
      >
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {guideItems.map((g) => (
            <div key={g.term} className="p-3 rounded-xl bg-surface-canvas">
              <dt className="flex items-center gap-1.5 text-label-md font-semibold text-text-primary">
                <Icon name={g.icon} className="text-[1rem] text-text-secondary" />
                {t(g.term)}
              </dt>
              <dd className="text-body-sm text-text-secondary mt-1">{t(g.body)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-body-sm text-text-tertiary flex items-center gap-1.5">
          <Icon name="science" className="text-[1rem]" />
          {t('Sample data for October 2024.')}
        </p>
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('Add content')}
        icon="add_box"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              {t('Close')}
            </Button>
            <LinkButton to="/accounts/connect" variant="primary" icon="link">
              {t('Connect Instagram')}
            </LinkButton>
          </>
        }
      >
        <div className="space-y-3 text-body-sm text-text-secondary">
          <p>{t('Once your Instagram account is connected, your posts and Reels are added here by themselves.')}</p>
          <Notice tone="demo" title={t('Not available in this preview')}>
            {t('Nothing will be uploaded or posted.')}
          </Notice>
          <Link to="/accounts" className="inline-flex text-primary font-semibold hover:underline">
            {t('Go to Instagram accounts')} →
          </Link>
        </div>
      </Modal>
    </>
  );
}
