import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { Icon } from './Icon';

export type ToastTone = 'success' | 'info' | 'warning' | 'error' | 'demo';

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

type ToastFn = (t: { title: string; description?: string; tone?: ToastTone; durationMs?: number }) => void;

const ToastContext = createContext<ToastFn>(() => {});

const toneStyles: Record<ToastTone, { icon: string; className: string }> = {
  success: { icon: 'check_circle', className: 'text-status-active' },
  info: { icon: 'info', className: 'text-status-completed' },
  warning: { icon: 'warning', className: 'text-status-paused' },
  error: { icon: 'error', className: 'text-error' },
  demo: { icon: 'science', className: 'text-ai-accent' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const tr = useT();
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);

  const toast = useCallback<ToastFn>(
    ({ title, description, tone = 'success', durationMs = 4500 }) => {
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-3), { id, title, description, tone }]);
      window.setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss],
  );

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[calc(100%-2rem)] sm:w-96" role="region" aria-live="polite" aria-label={tr('Notifications')}>
        {items.map((t) => {
          const s = toneStyles[t.tone];
          return (
            <div key={t.id} className="bg-surface-card border border-border-input text-text-primary rounded-xl shadow-flyout px-4 py-3 flex items-start gap-3 animate-toast-in" role="status">
              <Icon name={s.icon} className={cn('text-[1.25rem] mt-px', s.className)} filled />
              <div className="flex-1 min-w-0">
                <p className="text-label-md font-semibold">{t.title}</p>
                {t.description && <p className="text-body-sm text-slate-300 mt-0.5">{t.description}</p>}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-white" aria-label={tr('Close')}>
                <Icon name="close" className="text-[1rem]" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
