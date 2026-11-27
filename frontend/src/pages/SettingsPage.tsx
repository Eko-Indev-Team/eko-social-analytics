import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { AiTab } from '@/features/settings/AiTab';
import { DataSyncTab } from '@/features/settings/DataSyncTab';
import { GeneralTab } from '@/features/settings/GeneralTab';
import { InstagramTab } from '@/features/settings/InstagramTab';
import { NotificationsTab } from '@/features/settings/NotificationsTab';
import { SecurityTab } from '@/features/settings/SecurityTab';
import { TeamTab } from '@/features/settings/TeamTab';
import { sectionLabels, useSettingsDraft } from '@/features/settings/useSettingsDraft';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { modeText } from '@/lib/config';
import { cn } from '@/lib/format';
import { accountService } from '@/services/accounts';
import { settingsService } from '@/services/settings';
import { workspaceService } from '@/services/workspace';
import type { SettingsSection, SettingsTab } from '@/types/settings';

const TAB_IDS: SettingsTab[] = ['general', 'workspace', 'instagram', 'data-sync', 'ai', 'notifications', 'security'];
const sectionForTab: Partial<Record<SettingsTab, SettingsSection>> = { general: 'general', 'data-sync': 'sync', ai: 'ai', notifications: 'notifications' };

function DirtyDot() {
  const t = useT();
  return <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-label={t('Unsaved changes')} />;
}

function SettingsSkeleton() {
  const t = useT();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" role="status" aria-label={t('Loading settings')}>
      <div className="lg:col-span-2 space-y-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export default function SettingsPage() {
  const t = useT();
  useDocumentTitle(t('Settings'));
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab') as SettingsTab | null;
  const tab: SettingsTab = rawTab && TAB_IDS.includes(rawTab) ? rawTab : 'general';

  const settingsQ = useQuery('settings:workspace', settingsService.get);
  const envQ = useQuery('settings:environment', settingsService.environment);
  const sessionQ = useQuery('settings:session', settingsService.session);
  const accountsQ = useQuery('accounts:list', accountService.list);
  const teamQ = useQuery('workspace:team', workspaceService.team);

  const sectionNames = (list: SettingsSection[]) => list.map((c) => t(sectionLabels[c])).join(', ');

  const form = useSettingsDraft(settingsQ.data, (_result, changed) =>
    toast({
      title: t('Settings saved'),
      description: modeText(
        t('Saved for this demo session only: {sections}.', { sections: sectionNames(changed) }),
        t('Saved: {sections}.', { sections: sectionNames(changed) }),
      ),
    }),
  );

  const setTab = (next: SettingsTab) => {
    const p = new URLSearchParams(params);
    p.set('tab', next);
    setParams(p, { replace: true });
  };

  const dirty = (id: SettingsTab) => {
    const s = sectionForTab[id];
    return !!s && form.dirtySections.includes(s);
  };
  const canManageSettings = useAuth().can('settings:manage');
  const canSave = canManageSettings && form.isDirty && !form.hasErrors && !form.isSaving;
  const accounts = accountsQ.data ?? [];
  const primary = accounts.find((a) => a.isPrimary) ?? accounts[0];
  const connectedOk = accounts.some((a) => a.status === 'connected');

  const tabs = [
    { value: 'general' as const, icon: 'tune', label: <>{t('General')}{dirty('general') && <DirtyDot />}</> },
    { value: 'workspace' as const, icon: 'groups', label: t('Team'), count: teamQ.data?.length },
    {
      value: 'instagram' as const,
      icon: 'hub',
      label: (
        <>
          {t('Instagram')}
          <span className={cn('w-2 h-2 rounded-full', connectedOk ? 'bg-status-active' : 'bg-status-paused')} aria-hidden />
        </>
      ),
    },
    { value: 'data-sync' as const, icon: 'sync', label: <>{t('Data sync')}{dirty('data-sync') && <DirtyDot />}</> },
    { value: 'ai' as const, icon: 'auto_awesome', iconClassName: 'text-ai-accent', label: <>{t('AI')}{dirty('ai') && <DirtyDot />}</> },
    { value: 'notifications' as const, icon: 'notifications', label: <>{t('Notifications')}{dirty('notifications') && <DirtyDot />}</> },
    { value: 'security' as const, icon: 'lock', label: t('Security') },
  ];

  return (
    <div className="pb-4">
      <PageHeader
        title={t('Settings')}
        description={t('Your workspace, team and account.')}
        className="mb-6"
        actions={
          <>
            <span className={cn('flex items-center gap-1.5 text-body-sm', form.isDirty ? 'text-amber-300' : 'text-text-tertiary')}>
              <span className={cn('w-2 h-2 rounded-full', form.isDirty ? 'bg-amber-500' : 'bg-status-active')} />
              {form.isDirty ? t('Unsaved changes') : t('All changes saved')}
            </span>
            <Button variant="primary" size="md" icon="check" onClick={form.save} disabled={!canSave} loading={form.isSaving}>
              {form.isSaving ? t('Saving…') : t('Save changes')}
            </Button>
          </>
        }
      />

      {!canManageSettings && tab !== 'security' && (
        <p className="mb-4 flex items-center gap-1.5 text-body-sm text-text-secondary">
          <Icon name="visibility" className="text-[1rem] text-text-tertiary" />
          {t('You can view these settings. Ask an owner or admin to change them.')}
        </p>
      )}

      <Tabs tabs={tabs} value={tab} onChange={setTab} ariaLabel={t('Settings sections')} className="mb-6" />

      <div role="tabpanel" aria-label={tab}>
        <QueryState query={settingsQ} loading={<SettingsSkeleton />}>
          {() =>
            !form.draft ? (
              <SettingsSkeleton />
            ) : (
              <>
                {tab === 'general' && (
                  <GeneralTab
                    s={form.draft}
                    update={form.update}
                    errors={form.errors}
                    accounts={accounts}
                    environment={envQ.data}
                    presentationDirty={dirty('general')}
                    onSave={form.save}
                    saving={form.isSaving}
                    canSave={canSave}
                  />
                )}
                {tab === 'workspace' && <TeamTab />}
                {tab === 'instagram' && <InstagramTab />}
                {tab === 'data-sync' && <DataSyncTab s={form.draft} update={form.update} errors={form.errors} primary={primary} />}
                {tab === 'ai' && <AiTab s={form.draft} update={form.update} errors={form.errors} />}
                {tab === 'notifications' && <NotificationsTab s={form.draft} update={form.update} errors={form.errors} />}
                {tab === 'security' && <SecurityTab session={sessionQ.data} retentionDays={form.draft.sync.retentionDays} />}
                {form.baseline && (
                  <p className="mt-4 text-[0.6875rem] text-text-tertiary">
                    {t('Last saved {date} by {name}.', { date: form.baseline.updatedAt, name: form.baseline.updatedBy })}
                  </p>
                )}
              </>
            )
          }
        </QueryState>
      </div>

      {/* Sticky unsaved-changes bar */}
      {form.isDirty && (
        <div className="sticky bottom-4 z-20 mt-6" role="region" aria-label={t('Unsaved changes')}>
          <div className="bg-surface-card border border-border-input text-text-primary rounded-xl shadow-flyout px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <Icon name="edit_note" className="text-[1.25rem] text-primary-container mt-px" />
              <div className="min-w-0">
                <p className="text-label-md font-semibold">{t('Unsaved changes: {sections}', { sections: sectionNames(form.dirtySections) })}</p>
                {form.hasErrors && <p className="text-body-sm text-error">{t('Fix the marked fields before saving.')}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" onClick={form.discard} disabled={form.isSaving}>
                {t('Discard')}
              </Button>
              <Button variant="primary" icon="check" onClick={form.save} disabled={!canSave} loading={form.isSaving}>
                {t('Save changes')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
