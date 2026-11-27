import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, CampaignStatusBadge, DemoBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { useT } from '@/i18n/I18nContext';
import { formatDate } from '@/lib/format';
import { downloadCsv } from '../csv';
import { contentTypeMeta, formatDuration, isVideo } from '../contentMeta';
import { metricsCsvRows, type AnalyticsPageData } from './model';

/** Breadcrumb, post title with status, one short info line and the page actions. */
export function ReelHeader({ data }: { data: AnalyticsPageData }) {
  const t = useT();
  const { item, campaign } = data;
  const toast = useToast();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: t('Link copied') });
    } catch {
      toast({ tone: 'warning', title: t('Could not copy the link'), description: window.location.href });
    }
  };

  const downloadMetrics = () => {
    downloadCsv(`${item.id}-metrics-demo.csv`, metricsCsvRows(data));
    toast({ tone: 'demo', title: t('CSV downloaded'), description: t('Made from sample data.') });
  };

  const formatLabel = isVideo(item)
    ? formatDuration(item.durationSec)
    : item.type === 'carousel'
      ? t('{count} slides', { count: item.slides ?? 0 })
      : t('Single photo');

  return (
    <PageHeader
      breadcrumbs={[{ label: t('Content'), to: '/content' }, { label: item.title }]}
      title={item.title}
      titleAddon={
        <>
          {campaign ? <CampaignStatusBadge status={campaign.status} /> : <Badge tone="neutral">{t('No campaign')}</Badge>}
          <DemoBadge />
        </>
      }
      description={
        <>
          {t(contentTypeMeta[item.type].label)} · {formatLabel} · {t('Posted {date}', { date: formatDate(item.publishedAt) })}
          {campaign && (
            <>
              {' · '}
              <Link to={`/campaigns/${campaign.id}`} className="text-text-secondary hover:text-text-primary hover:underline">
                {campaign.name}
              </Link>
            </>
          )}
        </>
      }
      actions={
        <>
          <Button
            variant="secondary"
            size="md"
            icon="open_in_new"
            onClick={() => toast({ tone: 'demo', title: t('Not linked to Instagram'), description: t('Sample posts have no Instagram link.') })}
          >
            {t('Open on Instagram')}
          </Button>
          <Dropdown
            label={t('More')}
            trigger={({ toggle, open }) => (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-label={t('More')}
                title={t('More')}
                className="h-9 w-9 flex items-center justify-center bg-surface-card hover:bg-surface-canvas text-text-secondary border border-border-strong rounded-lg transition-colors"
              >
                <Icon name="more_vert" />
              </button>
            )}
          >
            {(close) => (
              <>
                {campaign && (
                  <Link
                    to={`/campaigns/${campaign.id}`}
                    role="menuitem"
                    onClick={close}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-label-md text-left text-text-primary hover:bg-slate-800"
                  >
                    <Icon name="campaign" className="text-[1rem] text-text-secondary" />
                    {t('View campaign')}
                  </Link>
                )}
                <MenuItem
                  icon="link"
                  onClick={() => {
                    close();
                    void copyLink();
                  }}
                >
                  {t('Copy link')}
                </MenuItem>
                <MenuItem
                  icon="file_download"
                  onClick={() => {
                    close();
                    downloadMetrics();
                  }}
                >
                  {t('Download CSV')}
                </MenuItem>
              </>
            )}
          </Dropdown>
        </>
      }
    />
  );
}
