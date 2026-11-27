import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { LanguageMenu } from '@/components/layout/LanguageMenu';
import { useT } from '@/i18n/I18nContext';

/** Centered card layout for the sign-in / invitation screens, with the language switcher top-right. */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const t = useT();
  return (
    <div className="relative min-h-screen bg-surface-canvas flex flex-col items-center justify-center px-4 py-10">
      <div className="absolute top-4 right-4">
        <LanguageMenu />
      </div>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <img src="/eko-wordmark.svg" alt="Eko" className="h-8 w-auto" />
          <span className="font-heading text-headline-sm text-text-primary font-bold tracking-tight">SocialBoard</span>
        </div>
        <div className="bg-surface-card border border-border-strong rounded-xl shadow-card p-6">
          <h1 className="font-heading text-2xl font-semibold text-text-primary">{title}</h1>
          {subtitle && <p className="text-body-sm text-text-secondary mt-1">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-body-sm text-text-secondary">{footer}</div>}
        <p className="mt-6 flex items-center justify-center gap-1.5 text-[0.6875rem] text-text-tertiary">
          <Icon name="lock" className="text-[0.875rem]" /> {t('Secure sign-in. We never ask for your Instagram password.')}
        </p>
      </div>
    </div>
  );
}

/** Only allow redirects back into the app (prevents open redirects via ?next=). */
export function safeNext(raw: string | null): string {
  // Only same-app paths: reject absolute/protocol-relative URLs, backslashes (browsers treat "/\x" as "//x") and control characters.
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || /[\\\x00-\x1f]/.test(raw)) return '/dashboard';
  if (raw.startsWith('/login') || raw.startsWith('/accept-invite')) return '/dashboard';
  return raw;
}
