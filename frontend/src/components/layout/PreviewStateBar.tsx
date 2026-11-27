import { usePreviewState, type PreviewState } from '@/app/PreviewStateContext';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { Icon } from '@/components/ui/Icon';

const OPTIONS: Array<{ value: PreviewState; label: string }> = [
  { value: 'normal', label: msg('Normal') },
  { value: 'loading', label: msg('Loading') },
  { value: 'empty', label: msg('Empty') },
  { value: 'error', label: msg('Error') },
];

/** Review control that forces the page into its loading / empty / error look. Hidden until turned on in the profile menu. */
export function PreviewStateBar() {
  const t = useT();
  const { state, setState, barVisible, setBarVisible } = usePreviewState();
  if (!barVisible) return null;
  return (
    <div className="mb-4 bg-surface-card border border-border-strong rounded-lg px-2.5 py-2 flex flex-wrap items-center justify-between gap-2 text-label-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-text-primary flex items-center gap-1">
          <Icon name="toggle_on" className="text-[1rem] text-primary-container" />
          {t('Page states')}:
        </span>
        <div className="flex items-center gap-1 flex-wrap" role="radiogroup" aria-label={t('Page states')}>
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={state === o.value}
              onClick={() => setState(o.value)}
              className={cn(
                'px-2.5 py-0.5 rounded text-xs border',
                state === o.value ? 'font-semibold bg-surface-container-low text-text-primary border-primary-container' : 'font-medium text-text-secondary hover:bg-surface-canvas border-transparent',
              )}
            >
              {t(o.label)}
            </button>
          ))}
        </div>
      </div>
      <button type="button" onClick={() => setBarVisible(false)} className="p-1 text-text-secondary hover:text-text-primary" aria-label={t('Hide')} title={t('Hide')}>
        <Icon name="close" className="text-[1rem]" />
      </button>
    </div>
  );
}
