import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n/I18nContext';
import type { RetentionPolicyRow } from '@/types/accounts';

/** Permissions, limits and data-keeping rules, folded away by default. Worded as planned behaviour. */
export function ScopesPolicySection({ scopes, rateLimitNotes, retention }: { scopes: string[]; rateLimitNotes: string[]; retention: RetentionPolicyRow[] }) {
  const t = useT();
  return (
    <details className="group bg-surface-card border border-border-strong rounded-xl shadow-card p-5">
      <summary className="flex items-center gap-2 cursor-pointer select-none list-none">
        <Icon name="policy" className="text-primary text-[1.25rem]" />
        <h2 id="scopes-policy-title" className="font-heading text-[1.0625rem] font-semibold text-text-primary">
          {t('Permissions and data rules')}
        </h2>
        <Icon name="expand_more" className="ml-auto text-text-tertiary transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6 text-body-sm text-text-secondary">
        <div className="space-y-2">
          <h3 className="text-label-md font-semibold text-text-primary">{t('Permissions')}</h3>
          <p>{t('SocialBoard only asks to read data. Permissions held by the sample accounts:')}</p>
          <ul className="flex flex-wrap gap-1.5">
            {scopes.map((s) => (
              <li key={s} className="px-2 py-0.5 rounded-full bg-surface-canvas border border-border-subtle font-mono text-[0.6875rem] text-text-primary">
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className="text-label-md font-semibold text-text-primary">{t('Limits')}</h3>
          <p>{t('Instagram limits how often we can ask for data. Planned approach:')}</p>
          <ul className="space-y-1 list-disc list-inside">
            {rateLimitNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className="text-label-md font-semibold text-text-primary">{t('How long data is kept (planned)')}</h3>
          <div className="space-y-1">
            {retention.map((r) => (
              <div key={r.label} className="flex justify-between gap-2">
                <span>{r.label}</span>
                <span className="font-semibold text-text-primary text-right">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}
