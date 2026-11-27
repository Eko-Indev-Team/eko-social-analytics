import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@/hooks/useMutation';
import { notificationTriggerMeta } from '@/data/settings';
import { interpolate, msg, useT, type Translate } from '@/i18n/I18nContext';
import { settingsService } from '@/services/settings';
import type { SettingsSection, WorkspaceSettings } from '@/types/settings';

export type SettingsErrors = Partial<Record<string, string>>;

/** English section names (translate with t()). */
export const sectionLabels: Record<SettingsSection, string> = {
  general: msg('General'),
  sync: msg('Data sync'),
  ai: msg('AI'),
  notifications: msg('Notifications'),
};

const english: Translate = (text, vars) => interpolate(text, vars);

export function validateSettings(s: WorkspaceSettings, t: Translate = english): SettingsErrors {
  const errors: SettingsErrors = {};
  const name = s.general.displayName.trim();
  if (!name) errors['general.displayName'] = t('Enter a workspace name.');
  else if (name.length < 3) errors['general.displayName'] = t('Use at least 3 characters.');
  else if (name.length > 120) errors['general.displayName'] = t('Keep the name under 120 characters.');

  if (s.sync.enabled && !Object.values(s.sync.streams).some(Boolean)) errors['sync.streams'] = t('Pick at least one kind of data, or turn auto sync off.');
  if (s.ai.enabled && !Object.values(s.ai.categories).some(Boolean)) errors['ai.categories'] = t('Pick at least one AI topic, or turn AI off.');

  notificationTriggerMeta.forEach((m) => {
    const trig = s.notifications.triggers[m.id];
    if (!Number.isFinite(trig.threshold) || trig.threshold < m.min || trig.threshold > m.max) {
      errors[`notifications.${m.id}.threshold`] = t('Enter a value between {min} and {max}.', { min: m.min, max: m.max });
    }
    if (trig.enabled && trig.channels.length === 0) errors[`notifications.${m.id}.channels`] = t('Choose at least one channel.');
  });
  return errors;
}

type Updater = (draft: WorkspaceSettings) => void;

/**
 * Controlled settings form state: draft vs last-saved snapshot, per-section dirty flags,
 * validation, save (in-memory store via settingsService) and discard.
 */
export function useSettingsDraft(saved: WorkspaceSettings | undefined, onSaved: (result: WorkspaceSettings, changedSections: SettingsSection[]) => void) {
  const t = useT();
  const [baseline, setBaseline] = useState<WorkspaceSettings | undefined>(saved);
  const [draft, setDraft] = useState<WorkspaceSettings | undefined>(saved);

  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;

  // Adopt the loaded snapshot (and later refetches); keep the user's pending edits if there are any.
  useEffect(() => {
    if (!saved) return;
    const prev = baselineRef.current;
    setDraft((d) => (!d || !prev || JSON.stringify(d) === JSON.stringify(prev) ? structuredClone(saved) : d));
    setBaseline(structuredClone(saved));
  }, [saved]);

  const dirtySections = useMemo<SettingsSection[]>(() => {
    if (!draft || !baseline) return [];
    return (['general', 'sync', 'ai', 'notifications'] as SettingsSection[]).filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(baseline[k]));
  }, [draft, baseline]);

  const errors = useMemo(() => (draft ? validateSettings(draft, t) : {}), [draft, t]);
  const hasErrors = Object.keys(errors).length > 0;

  const update = useCallback((fn: Updater) => {
    setDraft((d) => {
      if (!d) return d;
      const next = structuredClone(d);
      fn(next);
      return next;
    });
  }, []);

  const { mutate, isPending } = useMutation(settingsService.save, { invalidate: ['settings', 'activity'] });

  const save = async () => {
    if (!draft || hasErrors || dirtySections.length === 0) return;
    const changed = dirtySections;
    const result = await mutate(draft);
    if (result) {
      setBaseline(structuredClone(result));
      setDraft(structuredClone(result));
      onSaved(result, changed);
    }
  };

  const discard = () => baseline && setDraft(structuredClone(baseline));

  // Warn before a full page unload with unsaved edits.
  useEffect(() => {
    if (dirtySections.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirtySections.length]);

  return { draft, baseline, update, dirtySections, isDirty: dirtySections.length > 0, errors, hasErrors, save, discard, isSaving: isPending };
}

export type SettingsDraft = ReturnType<typeof useSettingsDraft>;
