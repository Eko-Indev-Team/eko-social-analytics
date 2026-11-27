import { useLocation } from 'react-router-dom';
import { LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/i18n/I18nContext';

export default function NotFoundPage() {
  const t = useT();
  const { pathname } = useLocation();
  useDocumentTitle(t('Page not found'));
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6 bg-surface-card border border-border-strong rounded-xl shadow-card">
      <div className="w-14 h-14 rounded-full bg-primary-container/15 flex items-center justify-center mb-4">
        <Icon name="explore_off" className="text-[1.875rem] text-primary" />
      </div>
      <h1 className="font-heading text-[1.75rem] leading-9 font-bold text-text-primary">{t('Page not found')}</h1>
      <p className="text-body-md text-text-secondary mt-2 max-w-md">
        {t('We could not find this page. The link may be wrong or the page has moved.')}
      </p>
      <code className="mt-3 px-2 py-0.5 rounded-full bg-surface-card-subtle text-text-tertiary text-[0.8125rem]">{pathname}</code>
      <div className="flex gap-2 mt-6">
        <LinkButton to="/dashboard" variant="primary" icon="dashboard">
          {t('Go to dashboard')}
        </LinkButton>
        <LinkButton to="/campaigns" icon="campaign">
          {t('Campaigns')}
        </LinkButton>
      </div>
    </div>
  );
}
