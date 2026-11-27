import { InfoTip } from '@/components/ui/InfoTip';
import { msg, useT } from '@/i18n/I18nContext';
import { modeText } from '@/lib/config';
import { cn } from '@/lib/format';
import type { AiCategory, AiSettings } from '@/types/settings';
import type { SectionProps } from './GeneralTab';
import { FieldError, inputCls, labelCls, SectionTitle, SettingsCard, Switch } from './settingsUi';

const categories: Array<{ id: AiCategory; label: string; detail: string }> = [
  { id: 'campaignDiagnostics', label: msg('Campaign check-ups'), detail: msg('Finds your best posts and the ones falling behind.') },
  { id: 'fatigueAlerts', label: msg('Tired content alerts'), detail: msg('Warns when people start losing interest in a post.') },
  { id: 'sentiment', label: msg('Comment mood'), detail: msg('Sorts comments into happy, neutral, questions and complaints.') },
  { id: 'leadAttribution', label: msg('Lead spotting'), detail: msg('Finds comments from people who may want to join.') },
];

export function AiTab({ s, update, errors }: SectionProps) {
  const t = useT();
  const ai = s.ai;
  return (
    <section className="flex flex-col gap-6">
      <SettingsCard>
        <SectionTitle
          title={
            <>
              {t('AI insights')}
              <InfoTip text={t('Anything made by AI is marked as AI. Check it before you act on it.')} />
            </>
          }
          subtitle={t('Choose what the AI looks at for you.')}
          actions={<Switch size="md" tone="ai" label={t('AI insights')} checked={ai.enabled} onChange={(v) => update((d) => void (d.ai.enabled = v))} />}
        />

        <div className={cn('transition-opacity', !ai.enabled && 'opacity-60')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {categories.map((c) => (
              <label key={c.id} className="flex items-start gap-3 p-3 rounded-xl border border-border-strong cursor-pointer hover:border-ai-border transition-colors">
                <input
                  type="checkbox"
                  disabled={!ai.enabled}
                  checked={ai.categories[c.id]}
                  onChange={(e) => update((d) => void (d.ai.categories[c.id] = e.target.checked))}
                  className="rounded text-purple-400 focus:ring-purple-500 mt-1 cursor-pointer"
                />
                <div>
                  <span className="text-label-md font-semibold text-text-primary">{t(c.label)}</span>
                  <p className="text-xs text-text-secondary mt-0.5">{t(c.detail)}</p>
                </div>
              </label>
            ))}
          </div>
          <FieldError message={errors['ai.categories']} />

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="ai-confidence" className={labelCls}>
                {t('How sure the AI must be')}
              </label>
              <select
                id="ai-confidence"
                disabled={!ai.enabled}
                className={inputCls}
                value={ai.confidenceThreshold}
                onChange={(e) => update((d) => void (d.ai.confidenceThreshold = Number(e.target.value) as AiSettings['confidenceThreshold']))}
              >
                <option value={90}>{t('90%: fewer, safer tips')}</option>
                <option value={80}>{t('80%: balanced')}</option>
                <option value={70}>{t('70%: more ideas')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="ai-sample" className={labelCls}>
                {t('Minimum data needed')}
              </label>
              <select
                id="ai-sample"
                disabled={!ai.enabled}
                className={inputCls}
                value={ai.minSampleSize}
                onChange={(e) => update((d) => void (d.ai.minSampleSize = Number(e.target.value) as AiSettings['minSampleSize']))}
              >
                <option value={500}>{t('{count} interactions (recommended)', { count: '500' })}</option>
                <option value={250}>{t('{count} interactions', { count: '250' })}</option>
                <option value={1000}>{t('{count} interactions', { count: '1,000' })}</option>
              </select>
            </div>
          </div>
        </div>

        <p className="text-body-sm text-text-tertiary mt-5">{modeText(t('AI text in this demo is sample content. No AI model is called.'), t('These choices are saved. They do not change the AI pages yet.'))}</p>
      </SettingsCard>
    </section>
  );
}
