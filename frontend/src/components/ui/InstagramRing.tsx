import type { ReactNode } from 'react';
import { cn } from '@/lib/format';

/** Instagram story-style gradient ring around a profile picture (the `ig-gradient` colours live in index.css). */
export function InstagramRing({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('ig-gradient rounded-[9999px] p-[2px] inline-flex shrink-0', className)}>
      <span className="rounded-[9999px] bg-surface-card p-[1.5px] inline-flex">{children}</span>
    </span>
  );
}
