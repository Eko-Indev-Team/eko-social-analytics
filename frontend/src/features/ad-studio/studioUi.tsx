import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { msg, useT } from '@/i18n/I18nContext';
import type { CopySource, DraftMode, DraftStatus } from '@/types/adStudio';

const SOURCE: Record<CopySource, { label: string; tone: 'active' | 'ai' | 'amber' | 'neutral'; icon: string }> = {
  locked_caption: { label: msg('Approved caption'), tone: 'active', icon: 'verified' },
  ai: { label: msg('Written by AI – review'), tone: 'ai', icon: 'auto_awesome' },
  locked_caption_fallback: { label: msg('Approved caption (AI unavailable)'), tone: 'amber', icon: 'verified' },
  custom: { label: msg('Custom'), tone: 'neutral', icon: 'edit' },
};

/** Honest label for where the ad text came from. AI text is never shown as an approved caption, and vice versa. */
export function CopySourceBadge({ source }: { source: CopySource }) {
  const t = useT();
  const s = SOURCE[source] ?? SOURCE.custom;
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {t(s.label)}
    </Badge>
  );
}

const STATUS: Record<DraftStatus, { label: string; tone: 'draft' | 'completed' | 'active' | 'error' }> = {
  draft: { label: msg('Draft'), tone: 'draft' },
  built: { label: msg('Built'), tone: 'completed' },
  active: { label: msg('Running'), tone: 'active' },
  failed: { label: msg('Failed'), tone: 'error' },
};

export function DraftStatusBadges({ status, mode }: { status: DraftStatus; mode: DraftMode }) {
  const t = useT();
  const s = STATUS[status] ?? STATUS.draft;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={s.tone} dot>
        {t(s.label)}
      </Badge>
      {mode === 'dry_run' ? (
        <Badge tone="neutral" icon="science">
          {t('Dry run')}
        </Badge>
      ) : (
        <Badge tone="ai" icon="cloud_done">
          {t('On Meta')}
        </Badge>
      )}
    </span>
  );
}

/** Numbered step card used by the builder. */
export function StepCard({ step, title, subtitle, children }: { step: number; title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="w-7 h-7 rounded-full bg-primary-container text-on-primary-container font-bold text-sm flex items-center justify-center shrink-0">{step}</span>
        <div>
          <h3 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{title}</h3>
          {subtitle && <p className="text-body-sm text-text-tertiary mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

export const inr = (v: number | null | undefined) => (v === null || v === undefined ? '-' : `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(v)}`);
