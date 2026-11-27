import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/Toast';
import { I18nProvider } from '@/i18n/I18nContext';
import { sessionWorkspace } from '@/services/workspace';
import { AppUiProvider } from './AppUiContext';
import { AuthProvider } from './AuthContext';
import { PreviewStateProvider } from './PreviewStateContext';

/** Providers that need router context (PreviewState resets on navigation). */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <ToastProvider>
        <AuthProvider>
          <PreviewStateProvider>
            <AppUiProvider initialSyncLabel={sessionWorkspace.lastSyncedLabel}>{children}</AppUiProvider>
          </PreviewStateProvider>
        </AuthProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
