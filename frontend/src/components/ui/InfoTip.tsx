import { useId, useState } from 'react';
import { cn } from '@/lib/format';
import { Icon } from './Icon';

/** Small (i) icon that shows an explanation on hover or focus, so long helper text stays out of the page. */
export function InfoTip({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-label={text}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="text-text-tertiary hover:text-text-primary flex items-center"
      >
        <Icon name="info" className="text-[1rem]" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute z-50 top-full right-0 mt-1.5 w-64 rounded-lg border border-border-strong bg-surface-card shadow-flyout px-3 py-2 text-body-sm font-normal normal-case tracking-normal text-text-secondary text-left"
        >
          {text}
        </span>
      )}
    </span>
  );
}
