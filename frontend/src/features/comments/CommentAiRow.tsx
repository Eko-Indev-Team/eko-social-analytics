import { AiJobProgress } from '@/features/ai/AiWidgets';
import { useAiJob } from '@/features/ai/useAiJob';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { useT } from '@/i18n/I18nContext';
import { aiService } from '@/services/ai';

/** Compact row (api mode) that queues AI labels for comments without one and follows the job. Same action as the AI toolbar. */
export function CommentAiRow() {
  const t = useT();
  const job = useAiJob({ invalidate: ['ai:cls'] });
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="flex items-center gap-1.5 text-label-md text-text-secondary">
        <Icon name="auto_awesome" className="text-ai-accent text-[1rem]" />
        {t('AI can label comments for you')}
        <InfoTip text={t('AI suggests sentiment, topic and lead chance for you to check. Nothing is posted or changed automatically.')} />
      </span>
      <Button icon="auto_awesome" variant="ai" onClick={() => void job.start(() => aiService.classifyComments())} loading={job.starting} disabled={!!job.active}>
        {job.active ? t('Labelling…') : t('Label new comments')}
      </Button>
      {job.active && (
        <div className="w-full max-w-md">
          <AiJobProgress job={job.active} />
        </div>
      )}
    </div>
  );
}
