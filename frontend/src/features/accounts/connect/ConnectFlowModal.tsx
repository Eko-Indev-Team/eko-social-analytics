import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Overlay';
import { ErrorState, QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { accountDetailService } from '@/services/accountDetails';
import { META_DOCS_URL } from '../AccountsOverview';
import { connectSteps, initialConnectState, type ConnectFormState, type ConnectStep } from './connectState';
import { StepAuthorization, StepRequirements } from './ConnectStepsEarly';
import { ConnectDone, isSelectableCandidate, StepConfirm, StepScopes } from './ConnectStepsLate';

function Stepper({ current, done }: { current: ConnectStep; done: boolean }) {
  const t = useT();
  const ref = useRef<HTMLOListElement>(null);
  // The modal body is the scroll container: return to the top whenever the step changes.
  useEffect(() => {
    if (ref.current?.parentElement) ref.current.parentElement.scrollTop = 0;
  }, [current, done]);
  return (
    <ol ref={ref} className="sticky -top-4 z-10 -mx-5 -mt-4 mb-5 px-5 md:px-8 py-3 bg-surface-canvas border-b border-border-strong flex items-center justify-between gap-2" aria-label={t('Progress')}>
      {connectSteps.map(({ step, label }, i) => {
        const complete = done || step < current;
        const active = !done && step === current;
        return (
          <li key={step} className={cn('flex items-center', i < connectSteps.length - 1 && 'flex-1')} aria-current={active ? 'step' : undefined}>
            <div className={cn('flex items-center gap-2.5', !complete && !active && 'opacity-60')}>
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                  complete && 'bg-status-active-solid text-white shadow-sm',
                  active && 'bg-primary-container text-on-primary-container ring-2 ring-primary-container/40 ring-offset-2',
                  !complete && !active && 'bg-surface-container border border-border-strong text-text-secondary',
                )}
              >
                {complete ? <Icon name="check" className="text-base font-bold" /> : step}
              </div>
              <div className={cn(active ? 'block' : 'hidden lg:block')}>
                <p className={cn('text-label-sm leading-tight whitespace-nowrap', active || complete ? 'font-bold text-text-primary' : 'font-medium text-text-secondary')}>
                  {t(label)}
                </p>
              </div>
            </div>
            {i < connectSteps.length - 1 && <div className={cn('flex-1 h-0.5 mx-3 min-w-[12px]', complete ? 'bg-status-active' : 'bg-border-strong')} />}
          </li>
        );
      })}
    </ol>
  );
}

const nextLabel: Record<ConnectStep, string> = {
  1: msg('Continue'),
  2: msg('Continue'),
  3: msg('Continue'),
  4: msg('Finish'),
};

/**
 * Multi-step "Connect Instagram Professional Account" flow. Meta OAuth is NOT performed:
 * the authorization step explains that and offers a clearly-labelled demo walkthrough instead.
 */
export function ConnectFlowModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const reference = useQuery('accounts:connect-reference', accountDetailService.connectReference);
  const [step, setStep] = useState<ConnectStep>(1);
  const [done, setDone] = useState(false);
  const [state, setState] = useState<ConnectFormState>(initialConnectState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const patch = (p: Partial<ConnectFormState>) => {
    setState((s) => ({ ...s, ...p }));
    setErrors({});
  };

  const ref = reference.data;
  const candidate = ref?.candidates.find((c) => c.id === state.candidateId);

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!ref) return e;
    if (step === 1) {
      if (!state.accountType) e.accountType = t('Choose Business or Creator.');
      if (state.prerequisites.length < ref.prerequisites.length) e.prerequisites = t('Tick all three boxes to continue.');
    }
    if (step === 2 && !state.demoMode) {
      e.auth = state.authAttempted
        ? t('Real login is not available here. Choose "Use a demo account" to see the next steps.')
        : t('Start the login first.');
    }
    if (step === 3) {
      if (!state.candidateId) e.candidate = t('Pick a sample account to continue.');
      else if (!isSelectableCandidate(candidate)) e.candidate = t('This account cannot be connected. Pick another one.');
      if (!state.scopesAcknowledged) e.ack = t('Please tick the box to agree to the permissions.');
    }
    return e;
  };

  const next = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    if (step < 4) {
      setStep((s) => (s + 1) as ConnectStep);
      return;
    }
    setDone(true);
    toast({ tone: 'demo', title: t('Demo finished'), description: t('No Instagram account was connected. This was only a walkthrough.') });
  };

  const restart = () => {
    setState(initialConnectState);
    setErrors({});
    setStep(1);
    setDone(false);
  };

  const footer = (
    <>
      <p className="text-label-sm font-label-sm text-text-secondary mr-auto max-w-md hidden sm:block">
        {done ? t('Demo only. Nothing was connected.') : t('You can disconnect at any time.')}
      </p>
      {done ? (
        <>
          <Button size="md" icon="restart_alt" onClick={restart}>
            {t('Start again')}
          </Button>
          <a href={META_DOCS_URL} target="_blank" rel="noopener noreferrer" className="hidden md:inline-flex items-center gap-1 h-9 px-3 text-label-md font-semibold text-ai-accent hover:underline">
            {t('Instagram API docs')} <Icon name="arrow_outward" className="text-[0.875rem]" />
          </a>
          <Button size="md" variant="primary" icon="arrow_back" onClick={onClose}>
            {t('Back to accounts')}
          </Button>
        </>
      ) : (
        <>
          <Button size="md" onClick={step === 1 ? onClose : () => (setErrors({}), setStep((s) => (s - 1) as ConnectStep))}>
            {step === 1 ? t('Cancel') : t('Back')}
          </Button>
          <Button size="md" variant="primary" iconRight="arrow_forward" onClick={next} disabled={!ref}>
            {t(nextLabel[step])}
          </Button>
        </>
      )}
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      className="max-w-4xl"
      icon="photo_camera"
      title={t('Connect Instagram account')}
      subtitle={t('Demo walkthrough. No real account is connected.')}
      footer={footer}
    >
      <Stepper current={step} done={done} />
      <QueryState
        query={reference}
        loading={
          <div className="space-y-4" role="status" aria-label={t('Loading')}>
            <Skeleton className="h-14" />
            <Skeleton className="h-32" />
            <Skeleton className="h-40" />
          </div>
        }
        error={(err, retry) => <ErrorState title={t('Could not load this step')} error={err} onRetry={retry} />}
        empty={<ErrorState title={t('This step is not available')} />}
      >
        {(data) =>
          done ? (
            <ConnectDone state={state} candidate={candidate} />
          ) : step === 1 ? (
            <StepRequirements state={state} patch={patch} prerequisites={data.prerequisites} errors={errors} />
          ) : step === 2 ? (
            <StepAuthorization state={state} patch={patch} prerequisites={data.prerequisites} scopes={data.scopes} error={errors.auth} />
          ) : step === 3 ? (
            <StepScopes state={state} patch={patch} candidates={data.candidates} scopes={data.scopes} errors={errors} />
          ) : (
            <StepConfirm state={state} patch={patch} candidate={candidate} scopes={data.scopes} />
          )
        }
      </QueryState>
    </Modal>
  );
}
