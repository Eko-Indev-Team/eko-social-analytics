import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Dropdown, MenuItem, SearchInput, SegmentedControl, Select } from '@/components/ui/Controls';
import { EmptyState, QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { modeText } from '@/lib/config';
import { notificationService } from '@/services/notifications';
import { reportService } from '@/services/reports';
import { NotificationCard } from '@/features/notifications/NotificationCard';
import { NotificationDetailModal } from '@/features/notifications/NotificationDetailModal';
import { categoryLabels, categoryOrder, groupLabels, groupOrder, priorityLabels } from '@/features/notifications/notificationMeta';
import { PreferencesDrawer } from '@/features/notifications/PreferencesDrawer';
import { downloadReportCsv } from '@/features/reports/reportCsv';
import type { NotificationAction, NotificationCategory, NotificationItem, NotificationPriority } from '@/types/notifications';

type ReadFilter = 'all' | 'unread';

function AllCaughtUp({ onReset, onRules }: { onReset: () => void; onRules: () => void }) {
  const t = useT();
  return (
    <EmptyState
      icon="notifications_off"
      title={t('All caught up')}
      description={t('No notifications match these filters.')}
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="primary" size="md" onClick={onReset}>
            {t('Clear filters')}
          </Button>
          <Button onClick={onRules} className="h-9">
            {t('Alert settings')}
          </Button>
        </div>
      }
    />
  );
}

function FeedSkeleton() {
  const t = useT();
  return (
    <div className="flex flex-col gap-2.5" role="status" aria-label={t('Loading notifications')}>
      <Skeleton className="h-4 w-48" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}

/** Notifications: short header, All / Unread, type + search, and the feed grouped by day. */
export default function NotificationsPage() {
  const t = useT();
  useDocumentTitle(t('Notifications'));
  const navigate = useNavigate();
  const toast = useToast();
  const query = useQuery('notifications:list', notificationService.list);
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [category, setCategory] = useState<'all' | NotificationCategory>('all');
  const [priority, setPriority] = useState<'all' | NotificationPriority>('all');
  const [search, setSearch] = useState('');
  const [inspect, setInspect] = useState<NotificationItem | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);

  const items = useMemo(() => query.data ?? [], [query.data]);
  const unread = items.filter((n) => !n.read).length;
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (n) =>
        (readFilter === 'all' || !n.read) &&
        (category === 'all' || n.category === category) &&
        (priority === 'all' || n.priority === priority) &&
        (!q || [n.title, n.body, categoryLabels[n.category], t(categoryLabels[n.category]), ...n.tags.map((tag) => tag.label)].some((s) => s.toLowerCase().includes(q))),
    );
  }, [items, readFilter, category, priority, search, t]);

  const setRead = useMutation(notificationService.setRead, { invalidate: ['notifications'] });
  const markAll = useMutation(notificationService.markAllRead, { invalidate: ['notifications'], onSuccess: () => toast({ title: t('All marked as read') }) });
  const dismiss = useMutation(notificationService.dismiss, { invalidate: ['notifications'], onSuccess: () => toast({ title: t('Notification dismissed') }) });

  const resetFilters = () => {
    setReadFilter('all');
    setCategory('all');
    setPriority('all');
    setSearch('');
  };

  const open = (n: NotificationItem, href = n.href) => {
    if (!n.read) void setRead.mutate(n.id, true);
    setInspect(null);
    if (href) navigate(href);
  };

  const runAction = async (n: NotificationItem, a: NotificationAction) => {
    if (a.kind === 'dismiss') {
      setInspect(null);
      void dismiss.mutate(n.id);
    } else if (a.kind === 'details') {
      setInspect(n);
    } else if (a.kind === 'download-report' && n.reportId) {
      if (!n.read) void setRead.mutate(n.id, true);
      downloadReportCsv(await reportService.get(n.reportId));
      toast({
        tone: 'demo',
        title: t('Downloaded {file}', { file: `${n.reportId}-demo.csv` }),
        description: t(modeText(msg('CSV made in your browser from sample data.'), msg('CSV made in your browser.'))),
      });
    } else {
      open(n, a.href ?? n.href);
    }
  };

  const toggleRead = async (n: NotificationItem) => {
    await setRead.mutate(n.id, !n.read);
    toast({ title: n.read ? t('Marked as unread') : t('Marked as read') });
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <PageHeader
        title={t('Notifications')}
        titleAddon={
          <span className="h-6 px-2.5 rounded-full bg-status-active-subtle text-status-active text-label-sm font-semibold flex items-center gap-1.5" aria-live="polite">
            <span className="w-1.5 h-1.5 rounded-full bg-status-active" />
            <span className="tnum">{t('{count} unread', { count: unread })}</span>
          </span>
        }
        description={t('Updates on campaigns, leads and your accounts.')}
        actions={
          <>
            <Button icon="done_all" className="h-9" onClick={() => markAll.mutate()} disabled={unread === 0 || markAll.isPending}>
              {t('Mark all as read')}
            </Button>
            <Button icon="settings" className="h-9" onClick={() => setPrefsOpen(true)}>
              {t('Settings')}
            </Button>
          </>
        }
      />

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <SegmentedControl<ReadFilter>
          ariaLabel={t('Show')}
          value={readFilter}
          onChange={setReadFilter}
          options={[
            { value: 'all', label: t('All'), count: items.length },
            { value: 'unread', label: t('Unread'), count: unread },
          ]}
        />
        <Select aria-label={t('Type')} value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
          <option value="all">{t('All types')}</option>
          {categoryOrder.map((c) => (
            <option key={c} value={c}>
              {t(categoryLabels[c])}
            </option>
          ))}
        </Select>
        <Dropdown
          label={t('Priority')}
          trigger={({ toggle, open: isOpen }) => (
            <Button icon="tune" className="h-9" onClick={toggle} aria-expanded={isOpen}>
              {priority === 'all' ? t('Filters') : t('Filters (1)')}
            </Button>
          )}
        >
          {(close) => (
            <>
              <p className="px-3 pt-1 pb-1.5 text-[0.6875rem] font-semibold text-text-tertiary">{t('Priority')}</p>
              <MenuItem active={priority === 'all'} onClick={() => (close(), setPriority('all'))}>
                {t('Any priority')}
              </MenuItem>
              {(Object.keys(priorityLabels) as NotificationPriority[]).map((p) => (
                <MenuItem key={p} active={priority === p} onClick={() => (close(), setPriority(p))}>
                  {t(priorityLabels[p])}
                </MenuItem>
              ))}
            </>
          )}
        </Dropdown>
        <SearchInput
          containerClassName="flex-1 md:max-w-xs md:ml-auto"
          aria-label={t('Search notifications')}
          placeholder={t('Search notifications')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <QueryState query={query} loading={<FeedSkeleton />} empty={<AllCaughtUp onReset={resetFilters} onRules={() => setPrefsOpen(true)} />}>
        {() =>
          visible.length === 0 ? (
            <AllCaughtUp onReset={resetFilters} onRules={() => setPrefsOpen(true)} />
          ) : (
            <div className="flex flex-col gap-6">
              {groupOrder.map((g) => {
                const groupItems = visible.filter((n) => n.group === g);
                if (groupItems.length === 0) return null;
                return (
                  <section key={g} className="flex flex-col gap-2.5" aria-label={t(groupLabels[g])}>
                    <div className="flex items-center justify-between px-1">
                      <h2 className="text-label-md font-semibold text-text-secondary">{t(groupLabels[g])}</h2>
                      <span className="text-body-sm text-text-tertiary tnum">{t('Updates: {count}', { count: groupItems.length })}</span>
                    </div>
                    {groupItems.map((n) => (
                      <NotificationCard
                        key={n.id}
                        item={n}
                        onOpen={() => open(n)}
                        onInspect={() => setInspect(n)}
                        onToggleRead={() => toggleRead(n)}
                        onAction={(a) => runAction(n, a)}
                      />
                    ))}
                  </section>
                );
              })}
            </div>
          )
        }
      </QueryState>

      <NotificationDetailModal item={inspect} onClose={() => setInspect(null)} onAction={(a) => inspect && runAction(inspect, a)} />
      <PreferencesDrawer open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </div>
  );
}
