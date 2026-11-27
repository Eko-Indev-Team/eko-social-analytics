import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { AccountTelemetry, ScopeDefinition, ScopeGrantStatus } from '@/types/accounts';

const grantMeta: Record<ScopeGrantStatus, { label: string; icon: string; cls: string }> = {
  approved: { label: msg('Given'), icon: 'check', cls: 'text-status-active bg-status-active-subtle' },
  missing: { label: msg('Missing'), icon: 'close', cls: 'text-status-paused bg-status-paused-subtle' },
  revoked: { label: msg('Taken back'), icon: 'block', cls: 'text-on-error-container bg-error-container/60' },
  not_requested: { label: msg('Not asked'), icon: 'remove', cls: 'text-text-secondary bg-surface-card-subtle' },
};

const footerTone = {
  active: { icon: 'verified', iconCls: 'text-status-completed' },
  warning: { icon: 'lock_clock', iconCls: 'text-status-paused' },
  error: { icon: 'gpp_bad', iconCls: 'text-error' },
} as const;

/** Permissions given to SocialBoard, plus the login health line. */
export function ScopesCard({ telemetry, catalog, handle }: { telemetry: AccountTelemetry; catalog: ScopeDefinition[]; handle: string }) {
  const t = useT();
  const toast = useToast();
  const tone = footerTone[telemetry.tokenFooter.tone];
  const describe = (scope: string) => catalog.find((c) => c.scope === scope)?.detailDescription ?? '';

  return (
    <section className="bg-surface-card border border-border-strong rounded-xl p-5 shadow-card" aria-labelledby="scopes-title">
      <div className="mb-4">
        <h2 id="scopes-title" className="font-heading text-[1.0625rem] font-semibold text-text-primary">
          {t('Permissions')}
        </h2>
        <p className="text-body-sm text-text-secondary mt-0.5">{t('What SocialBoard is allowed to read. Sample data.')}</p>
      </div>
      <ul className="divide-y divide-border-subtle">
        {telemetry.scopes.map((g) => {
          const m = grantMeta[g.status];
          return (
            <li key={g.scope} className="py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <code className="text-[0.75rem] text-text-primary font-semibold break-all">{g.scope}</code>
                <p className="text-[0.75rem] text-text-secondary">{describe(g.scope)}</p>
              </div>
              <span className={cn('inline-flex items-center gap-1 text-[0.6875rem] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', m.cls)}>
                <Icon name={m.icon} className="text-[0.75rem]" /> {t(m.label)}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 pt-4 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Icon name={tone.icon} className={cn('text-[1.375rem]', tone.iconCls)} />
          <div>
            <p className="text-label-md font-semibold text-text-primary">{telemetry.tokenFooter.title}</p>
            <p className="text-[0.75rem] text-text-secondary">{telemetry.tokenFooter.body}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            toast({
              tone: 'demo',
              title: t('Login check not available'),
              description: t('@{handle} is a sample account. There is no real login to check.', { handle }),
            })
          }
          className="px-3 py-1.5 bg-surface-card border border-border-strong text-label-sm font-semibold rounded-lg hover:bg-surface-canvas transition-colors whitespace-nowrap text-text-secondary"
        >
          {t('Check login')}
        </button>
      </div>
    </section>
  );
}
