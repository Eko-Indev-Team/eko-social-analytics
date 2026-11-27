import { LeadAiSummaryPanel } from '@/features/ai/LeadAiPanels';
import { isDemoMode } from '@/lib/config';
import { modeText } from '@/lib/config';
import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AiBadge, LeadStatusBadge, leadStatusLabel } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { InfoTip } from '@/components/ui/InfoTip';
import { Avatar } from '@/components/ui/Misc';
import { Drawer } from '@/components/ui/Overlay';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useMutation';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { leadService } from '@/services/leads';
import type { LeadStatus } from '@/types/domain';
import { LeadQualification } from './LeadQualification';
import { leadSourceLabel, leadStatuses, suggestedReply, type LeadRow } from './leadUtils';

const quickStatuses: Array<{ status: LeadStatus; className: string }> = [
  { status: 'contacted', className: 'bg-surface-canvas hover:bg-slate-800 border-border-strong font-semibold' },
  { status: 'qualified', className: 'bg-surface-canvas hover:bg-slate-800 border-border-strong font-semibold text-status-active' },
  { status: 'converted', className: 'bg-amber-900/40 hover:bg-amber-900/40 border-amber-800 font-bold text-amber-300' },
];

/** Lead Detail drawer (leadDrawer in the export). */
export function LeadDrawer({ open, leadId, lead, loading, onClose }: { open: boolean; leadId: string | null; lead: LeadRow | undefined; loading: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="w-full sm:max-w-md"
      title={
        <span className="flex items-center gap-2">
          <Icon name="contact_page" className="text-primary-container" />
          {t('Lead')}
        </span>
      }
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-28" />
          <Skeleton className="h-24" />
        </div>
      ) : lead ? (
        <LeadDetail key={lead.id} lead={lead} onClose={onClose} />
      ) : (
        <EmptyState icon="person_search" title={t('Lead not found')} description={t('No lead with id "{id}" was found.', { id: leadId ?? '' })} />
      )}
    </Drawer>
  );
}

function LeadDetail({ lead, onClose }: { lead: LeadRow; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const notesId = useId();
  const savedNotes = lead.notes ?? '';
  const [notes, setNotes] = useState(savedNotes);
  const [pending, setPending] = useState<LeadStatus | null>(null);
  const reply = suggestedReply(lead);

  const update = useMutation((status: LeadStatus) => leadService.updateStatus(lead.id, status), {
    invalidate: ['leads'],
    onSuccess: (l) =>
      toast({
        title: t('Status changed to {status}', { status: t(leadStatusLabel(l.status)) }),
        description: modeText(t('Saved for this browser session (sample data).'), t('Saved.')),
      }),
    onError: (e) => toast({ tone: 'error', title: t('Could not change status'), description: e.message }),
  });

  const setStatus = async (status: LeadStatus) => {
    if (status === lead.status) return;
    setPending(status);
    await update.mutate(status);
    setPending(null);
  };

  const copyReply = async () => {
    try {
      await navigator.clipboard.writeText(reply);
      toast({ title: t('Reply copied'), description: t('Paste it into Instagram to send it. SocialBoard sends nothing.') });
    } catch {
      toast({ tone: 'error', title: t('Could not copy'), description: t('Select the reply and copy it by hand.') });
    }
  };

  const saveNotes = useMutation((text: string) => leadService.updateDetails(lead.id, { notes: text }), {
    invalidate: ['leads'],
    onError: (e) => toast({ tone: 'error', title: t('Notes were not saved'), description: e.message }),
  });

  /** Saves notes (if changed) and closes only after the save succeeded; on error the drawer stays open with the text intact. */
  const saveAndClose = async () => {
    if (notes.trim() === savedNotes.trim()) return onClose();
    const saved = await saveNotes.mutate(notes);
    if (!saved) return;
    toast({
      title: t('Notes saved'),
      description: modeText(t('Kept for this browser session (sample data).'), t('Saved in SocialBoard.')),
    });
    onClose();
  };

  return (
    <div className="flex flex-col gap-4 text-xs min-h-full">
      <div className="flex items-center gap-3">
        <Avatar name={lead.name} size="lg" />
        <div className="min-w-0">
          <h3 className="font-bold text-text-primary text-base">{lead.name}</h3>
          <span className="text-text-secondary">
            @{lead.handle} • {lead.location}
          </span>
          {lead.phoneMasked && <span className="block text-text-tertiary tnum">{lead.phoneMasked}</span>}
        </div>
      </div>

      <dl className="p-3 rounded bg-surface-canvas border border-border-strong space-y-2">
        <Row label={t('Status')}>
          <LeadStatusBadge status={lead.status} />
        </Row>
        <Row label={t('Campaign')}>
          <Link to={`/campaigns/${lead.campaignId}`} className="font-bold text-text-primary hover:underline text-right">
            {lead.campaignName}
          </Link>
        </Row>
        <Row label={t('Post')}>
          {lead.contentId && lead.contentLabel ? (
            <Link to={`/content/${lead.contentId}`} className="font-medium text-text-primary hover:underline text-right">
              {lead.contentLabel}
            </Link>
          ) : (
            <span className="font-medium text-text-primary">—</span>
          )}
        </Row>
        <Row label={t('Came from')}>
          <span className="font-medium text-text-primary">{t(leadSourceLabel(lead.source))}</span>
        </Row>
        <Row label={t('Score')}>
          <span className="flex items-center gap-1.5">
            <span className="font-bold text-primary tnum">{lead.score}/100</span>
            <AiBadge label={msg('AI')} />
          </span>
        </Row>
        <Row label={t('Last contact')}>
          <span className="font-medium text-text-primary">{lead.lastContact}</span>
        </Row>
      </dl>

      <LeadQualification lead={lead} />

      <div>
        <h4 className="font-bold text-text-primary mb-2">{t('First message')}</h4>
        <p className="p-3 rounded bg-surface-canvas border border-border-strong text-text-primary font-medium italic">“{lead.firstMessage}”</p>
        {!isDemoMode && <div className="mt-3"><LeadAiSummaryPanel leadId={lead.id} /></div>}
      </div>

      <div className="p-3 rounded bg-ai-subtle border border-ai-border">
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-ai-accent text-[0.6875rem] flex items-center gap-1">
            <Icon name="auto_awesome" className="text-[0.875rem]" /> {t('Suggested reply')}
            <InfoTip text={t('SocialBoard never sends messages. Copy the reply and send it from Instagram yourself.')} />
          </span>
          <button type="button" className="text-xs text-ai-accent hover:underline font-bold" onClick={copyReply}>
            {t('Copy')}
          </button>
        </div>
        <p className="text-text-primary text-xs bg-surface-card p-2.5 rounded border border-purple-800">{reply}</p>
      </div>

      <div>
        <label htmlFor={notesId} className="font-bold text-text-primary mb-2 block">
          {t('Notes')}
        </label>
        <textarea
          id={notesId}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={5000}
          disabled={saveNotes.isPending}
          className="w-full h-24 p-2.5 bg-slate-950 border border-slate-700 rounded text-xs text-text-primary focus:outline-none focus:border-border-focused"
                    placeholder={t('For example: called on WhatsApp, shared the document list')}
        />
      </div>

      <div>
        <h4 className="font-bold text-text-primary mb-2">{t('Change status')}</h4>
        <div className="grid grid-cols-3 gap-2">
          {quickStatuses.map((q) => {
            const current = lead.status === q.status;
            return (
              <button
                key={q.status}
                type="button"
                aria-pressed={current}
                disabled={update.isPending}
                onClick={() => setStatus(q.status)}
                className={cn('p-2 rounded border text-center disabled:opacity-60 flex items-center justify-center gap-1', q.className, current && 'ring-2 ring-primary-container')}
              >
                {pending === q.status && <Icon name="progress_activity" className="text-[0.875rem] animate-spin" />}
                {current && pending !== q.status && <Icon name="check" className="text-[0.875rem]" />}
                {t(leadStatusLabel(q.status))}
              </button>
            );
          })}
        </div>
        <label className="flex items-center justify-between gap-2 mt-2 text-text-secondary">
          <span>{t('Or pick any status')}</span>
          <Select aria-label={t('Status')} value={lead.status} disabled={update.isPending} onChange={(e) => setStatus(e.target.value as LeadStatus)} className="h-8 text-xs">
            {leadStatuses.map((s) => (
              <option key={s} value={s}>
                {t(leadStatusLabel(s))}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="mt-auto pt-4 border-t border-border-strong">
        <Button variant="dark" size="md" className="w-full" onClick={saveAndClose} loading={saveNotes.isPending} disabled={update.isPending}>
          {saveNotes.isPending ? t('Saving…') : t('Save and close')}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-3">
      <dt className="text-text-secondary shrink-0">{label}</dt>
      <dd className="min-w-0 flex justify-end">{children}</dd>
    </div>
  );
}
