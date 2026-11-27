import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { msg, useT } from '@/i18n/I18nContext';
import { modeText } from '@/lib/config';
import { formatDelta } from '@/lib/format';
import type { ReportContext } from '@/types/reports';

/** One-line AI suggestion; the observation comes from the account overview. */
export function ReportsAiBanner({ ctx, onDraft }: { ctx: ReportContext; onDraft: () => void }) {
  const t = useT();
  const watchDelta = ctx.overview.watchTimeHours.delta ?? 0;
  return (
    <section className="bg-ai-subtle border border-ai-border rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-surface-card text-ai-accent flex items-center justify-center shrink-0">
          <Icon name="auto_awesome" className="text-[1.125rem]" />
        </span>
        <p className="text-body-md text-text-primary">
          {t('Reel watch time is up {delta} vs last month. Make a short summary of Hindi campaign results?', { delta: formatDelta(watchDelta) })}
        </p>
        <InfoTip text={t(modeText(msg('Suggested by AI from sample data. Check before you act on it.'), msg('Suggested by AI. Check before you act on it.')))} />
      </div>
      <Button variant="ai" icon="auto_awesome" onClick={onDraft}>
        {t('Draft AI summary')}
      </Button>
    </section>
  );
}
