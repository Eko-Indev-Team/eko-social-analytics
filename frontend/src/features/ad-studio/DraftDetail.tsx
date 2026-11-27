import { useRef, useState } from 'react';
import { useAuth } from '@/app/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, Select } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback, Notice } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Overlay';
import { ErrorState, QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { apiAssetUrl } from '@/features/ads-reports/reportFormat';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { formatDate } from '@/lib/format';
import { adStudioService } from '@/services/adStudio';
import type { Draft, StudioOptions } from '@/types/adStudio';
import { CopySourceBadge, DraftStatusBadges, inr } from './studioUi';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-1.5 border-b border-border-subtle last:border-b-0">
      <dt className="text-[0.75rem] text-text-tertiary sm:w-44 shrink-0">{label}</dt>
      <dd className="text-body-sm text-text-primary min-w-0 break-words">{children}</dd>
    </div>
  );
}

function PayloadSummary({ draft }: { draft: Draft }) {
  const t = useT();
  const [showJson, setShowJson] = useState(false);
  const p = draft.payload;
  const linkData = ((p.ad_creative.object_story_spec as Record<string, unknown> | undefined)?.link_data ?? {}) as Record<string, unknown>;
  const adSet = p.ad_set as Record<string, unknown>;
  return (
    <Card className="p-5 space-y-3">
      <CardHeader
        title={draft.mode === 'dry_run' ? t('What would be sent to Meta') : t('What was sent to Meta')}
        subtitle={t('Campaign → Ad set → Picture → Creative → Ad. Everything is created paused.')}
        actions={
          <Button size="xs" variant="ghost" icon="data_object" onClick={() => setShowJson((s) => !s)} aria-expanded={showJson}>
            {showJson ? t('Hide exact requests') : t('Show exact requests')}
          </Button>
        }
      />
      <dl>
        <Row label={t('Campaign')}>
          {String(p.campaign.name ?? '')} · {String(p.campaign.objective ?? '')} · <Badge tone="paused">{String(p.campaign.status ?? 'PAUSED')}</Badge>
        </Row>
        <Row label={t('Daily budget')}>{inr(draft.dailyBudget)}</Row>
        <Row label={t('Optimised for')}>{String(adSet.optimization_goal ?? '-')}</Row>
        <Row label={t('Where')}>
          {draft.targeting.districts.length ? draft.targeting.districts.join(', ') : t('All of India')}
          {` · ${t('{count} map points', { count: draft.targeting.anchors.length })} · ${t('{count} PIN codes', { count: draft.targeting.pincodes.length })}`}
        </Row>
        <Row label={t('Who')}>
          {draft.targeting.ageMin}-{draft.targeting.ageMax} · {draft.targeting.gender === 'all' ? t('Everyone') : draft.targeting.gender === 'male' ? t('Men') : t('Women')}
        </Row>
        <Row label={t('Headline')}>{String(linkData.name ?? draft.headline)}</Row>
        <Row label={t('Button')}>
          {draft.copy.ctaText} ({String((linkData.call_to_action as { type?: string } | undefined)?.type ?? draft.copy.cta)})
        </Row>
        <Row label={t('Link')}>{String(linkData.link ?? draft.destination.url)}</Row>
        <Row label={t('Picture')}>{p.ad_image?.upload ?? (draft.hasImage ? t('Uploaded') : t('None yet'))}</Row>
        {p.review.call_whatsapp_number && <Row label={t('Call / WhatsApp')}>{p.review.call_whatsapp_number}</Row>}
        {p.review.unresolved_districts.length > 0 && <Row label={t('Looked up on publish')}>{p.review.unresolved_districts.join(', ')}</Row>}
        <Row label={t('Run length')}>
          {t('{days} days', { days: p.review.schedule_days })} <span className="text-text-tertiary">· {p.review.schedule_note}</span>
        </Row>
      </dl>
      {showJson && (
        <pre className="text-[0.6875rem] leading-relaxed bg-slate-950 border border-border-strong rounded-lg p-3 overflow-auto max-h-96 custom-scrollbar text-slate-200">
          {JSON.stringify(p, null, 2)}
        </pre>
      )}
    </Card>
  );
}

function PictureCard({ draft, options }: { draft: Draft; options: StudioOptions }) {
  const t = useT();
  const { can } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const caps = options.capabilities;
  const live = draft.mode === 'live';
  const upload = useMutation(adStudioService.uploadImage, { invalidate: ['ads:studio:'] });
  const remove = useMutation(adStudioService.removeImage, { invalidate: ['ads:studio:'] });
  const generate = useMutation(adStudioService.generateImage, { invalidate: ['ads:studio:'] });
  const [localError, setLocalError] = useState<string | null>(null);
  const canEdit = can('write') && !live;

  const onFile = (file: File | undefined) => {
    setLocalError(null);
    if (!file) return;
    if (!caps.acceptedImageTypes.includes(file.type)) return setLocalError(t('Use a JPEG, PNG or WebP picture.'));
    if (file.size > caps.maxImageBytes) return setLocalError(t('The picture is too large (max {mb} MB).', { mb: Math.round(caps.maxImageBytes / 1048576) }));
    void upload.mutate(draft.id, file);
  };

  const src = draft.imageUrl ? (draft.imageUrl.startsWith('blob:') ? draft.imageUrl : apiAssetUrl(draft.imageUrl)) : null;
  return (
    <Card className="p-5 space-y-3">
      <CardHeader title={t('Picture')} subtitle={t('Used as-is: no text is drawn onto it.')} />
      {draft.hasImage && src ? (
        <ImageWithFallback src={src} alt={t('Ad picture')} className="w-full max-h-72 rounded-lg object-contain bg-surface-card-subtle" />
      ) : (
        <div className="h-40 rounded-lg border border-dashed border-border-strong flex flex-col items-center justify-center text-text-tertiary gap-1">
          <Icon name="add_photo_alternate" className="text-[2rem]" />
          <span className="text-body-sm">{t('No picture yet')}</span>
        </div>
      )}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept={caps.acceptedImageTypes.join(',')} className="sr-only" aria-label={t('Choose a picture')} onChange={(e) => onFile(e.target.files?.[0])} />
          <Button size="xs" icon="upload" loading={upload.isPending} disabled={!caps.imageUpload} onClick={() => input.current?.click()}>
            {draft.hasImage ? t('Replace picture') : t('Upload picture')}
          </Button>
          {caps.imageGeneration && (
            <Button size="xs" variant="ai" icon="auto_awesome" loading={generate.isPending} onClick={() => void generate.mutate(draft.id)}>
              {t('Make one ({provider})', { provider: caps.imageProvider })}
            </Button>
          )}
          {draft.hasImage && (
            <Button size="xs" variant="ghost" icon="delete" loading={remove.isPending} onClick={() => void remove.mutate(draft.id)}>
              {t('Remove')}
            </Button>
          )}
        </div>
      )}
      {generate.isPending && <p className="text-[0.75rem] text-text-tertiary">{t('Making a picture can take up to a minute.')}</p>}
      {localError && (
        <p className="text-[0.75rem] text-error" role="alert">
          {localError}
        </p>
      )}
      <p className="text-[0.6875rem] text-text-tertiary">{t('JPEG, PNG or WebP, up to {mb} MB.', { mb: Math.round(caps.maxImageBytes / 1048576) })}</p>
    </Card>
  );
}

function PublishCard({ draft, options }: { draft: Draft; options: StudioOptions }) {
  const t = useT();
  const toast = useToast();
  const { can } = useAuth();
  const [confirm, setConfirm] = useState<'publish' | 'activate' | null>(null);
  const caps = options.capabilities;
  const manage = can('ads:manage');
  const serverAvailable = caps.livePublishMissing.length === 0;
  const igAccounts = caps.instagramPublishAccounts ?? [];
  const [publishWith, setPublishWith] = useState<string>(serverAvailable ? 'server' : igAccounts[0]?.id ?? '');
  const withAccount = igAccounts.find((a) => a.id === publishWith);
  const hasChoice = serverAvailable || igAccounts.length > 0;
  const publish = useMutation(adStudioService.publish, {
    invalidate: ['ads:studio:'],
    onSuccess: (d) => {
      setConfirm(null);
      toast(d.status === 'failed' ? { tone: 'error', title: t('Publishing failed'), description: d.error ?? undefined } : { tone: 'success', title: t('Created on Meta, paused') });
    },
    onError: (e) => {
      setConfirm(null);
      toast({ tone: 'error', title: t('Could not publish'), description: e.message });
    },
  });
  const activate = useMutation(adStudioService.activate, {
    invalidate: ['ads:studio:'],
    onSuccess: () => {
      setConfirm(null);
      toast({ tone: 'success', title: t('The ad is running') });
    },
    onError: (e) => {
      setConfirm(null);
      toast({ tone: 'error', title: t('Could not start the ad'), description: e.message });
    },
  });

  let reason: string | null = null;
  if (!caps.livePublish) reason = t('Live publishing is not set up. Missing in backend/.env: {missing}.', { missing: caps.livePublishMissing.join(', ') || '-' });
  else if (!manage) reason = t('Only an Admin or Owner can publish ads.');
  else if (draft.mode === 'dry_run' && !draft.hasImage) reason = t('Add a picture first.');

  return (
    <Card className="p-5 space-y-3">
      <CardHeader title={t('Publish to Meta')} subtitle={t('Two steps: create everything paused, then start it when you are ready.')} />
      {draft.error && (
        <Notice tone="warning" title={t('Last attempt failed')}>
          {draft.error}
        </Notice>
      )}
      {draft.mode === 'live' && (
        <dl className="text-[0.75rem] grid grid-cols-2 gap-1">
          {Object.entries(draft.metaIds).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-text-tertiary">{k}</dt>
              <dd className="font-mono-code text-text-primary truncate">{v ?? '-'}</dd>
            </div>
          ))}
        </dl>
      )}
      {draft.mode === 'live' && draft.publishedWith && (
        <p className="text-body-sm text-text-secondary">
          {draft.publishedWith === 'server' ? t('Published with the server token') : t('Published with {account}', { account: draft.publishedWith })}
        </p>
      )}
      {draft.mode === 'dry_run' && hasChoice && (
        <Field label={t('Publish with')} htmlFor={`publish-with-${draft.id}`} hint={igAccounts.length > 0 ? t('Ads published with an Instagram account run on Instagram only.') : undefined}>
          <Select id={`publish-with-${draft.id}`} value={publishWith} onChange={(e) => setPublishWith(e.target.value)} className="w-full sm:w-auto" disabled={!manage}>
            {serverAvailable && <option value="server">{t('Server Meta token')}</option>}
            {igAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {t('@{username} (Instagram only)', { username: a.username })}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {draft.status === 'active' ? (
        <Notice tone="info" icon="play_circle" title={t('Running')}>
          {t('Started {date}. Pause it in Meta Ads Manager when you are done.', { date: formatDate(draft.activatedAt) })}
        </Notice>
      ) : (
        <div className="flex flex-wrap gap-2">
          {draft.mode === 'dry_run' && (
            <Button variant="primary" icon="cloud_upload" disabled={!draft.canPublish || !caps.livePublish || !manage || !hasChoice || !publishWith} onClick={() => setConfirm('publish')}>
              {t('Publish (paused)')}
            </Button>
          )}
          {draft.mode === 'live' && (
            <Button variant="primary" icon="play_arrow" disabled={!draft.canActivate || !manage} onClick={() => setConfirm('activate')}>
              {t('Start the ad')}
            </Button>
          )}
        </div>
      )}
      {reason && draft.mode === 'dry_run' && <p className="text-body-sm text-text-secondary">{reason}</p>}

      <Modal
        open={confirm === 'publish'}
        onClose={() => setConfirm(null)}
        icon="cloud_upload"
        title={t('Create this ad on Meta?')}
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>{t('Cancel')}</Button>
            <Button variant="primary" loading={publish.isPending} onClick={() => void publish.mutate(draft.id, withAccount?.id)} data-autofocus>
              {t('Create paused')}
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-body-sm text-text-secondary">
          <p>{t('This creates a campaign, ad set, picture, creative and ad in your Meta ad account. Everything is created PAUSED: nothing is spent until you start it.')}</p>
          {withAccount && <p>{t('It is published with @{username}: the ad runs on Instagram only, in the ad account chosen when that account was connected.', { username: withAccount.username })}</p>}
          <p>{t('Live publishing has only been tested against a simulated Meta. Check the result in Meta Ads Manager.')}</p>
        </div>
      </Modal>
      <Modal
        open={confirm === 'activate'}
        onClose={() => setConfirm(null)}
        icon="play_arrow"
        title={t('Start spending money?')}
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>{t('Cancel')}</Button>
            <Button variant="danger" loading={activate.isPending} onClick={() => void activate.mutate(draft.id, draft.dailyBudget)}>
              {t('Yes, spend up to {amount}/day', { amount: inr(draft.dailyBudget) })}
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-text-secondary">
          {t('This will start the ad on Meta and spend up to {amount} per day until you pause it. There is no end date.', { amount: inr(draft.dailyBudget) })}
        </p>
      </Modal>
    </Card>
  );
}

function InsightsCard({ draft }: { draft: Draft }) {
  const t = useT();
  const q = useQuery(`ads:studio:insights:${draft.id}:${draft.status}`, () => adStudioService.insights(draft.id), { isEmpty: () => false });
  return (
    <Card className="p-5 space-y-3">
      <CardHeader title={t('Results')} />
      <QueryState query={q} loading={<Skeleton className="h-20" />} error={(err, retry) => <ErrorState error={err} onRetry={retry} />}>
        {(ins) =>
          !ins.metrics ? (
            <div className="text-center py-6 space-y-1">
              <Icon name="query_stats" className="text-[2rem] text-text-tertiary" />
              <p className="text-body-sm text-text-secondary">{t('No results yet')}</p>
              <p className="text-[0.75rem] text-text-tertiary max-w-md mx-auto">{ins.note}</p>
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {(
                  [
                    [t('Spend'), inr(ins.metrics.spend)],
                    [t('Reach'), ins.metrics.reach.toLocaleString('en-IN')],
                    [t('Clicks'), ins.metrics.clicks.toLocaleString('en-IN')],
                    [t('Leads'), ins.metrics.leads.toLocaleString('en-IN')],
                    [t('Cost per lead'), inr(ins.metrics.cpa)],
                  ] as const
                ).map(([l, v]) => (
                  <div key={l}>
                    <dt className="text-[0.75rem] text-text-tertiary">{l}</dt>
                    <dd className="font-heading text-[1.125rem] font-bold tnum text-text-primary">{v}</dd>
                  </div>
                ))}
              </dl>
              {ins.advice.map((a, i) => (
                <Notice key={i} tone={a.tone === 'good' ? 'info' : 'warning'}>
                  {a.text}
                </Notice>
              ))}
              <p className="text-[0.75rem] text-text-tertiary">{ins.note}</p>
            </>
          )
        }
      </QueryState>
    </Card>
  );
}

/** One draft: status, notes, picture, copy, payload summary, publish/activate and results. */
export function DraftDetail({ draft, options, onDeleted }: { draft: Draft; options: StudioOptions; onDeleted: () => void }) {
  const t = useT();
  const { can } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const del = useMutation(adStudioService.deleteDraft, { invalidate: ['ads:studio:drafts'], onSuccess: onDeleted });
  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading text-[1.25rem] font-bold text-text-primary">{draft.headline || t('Untitled ad')}</h2>
            <p className="text-[0.75rem] text-text-tertiary mt-0.5">
              {draft.id} · {formatDate(draft.createdAt)}
              {draft.createdByName && ` · ${draft.createdByName}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DraftStatusBadges status={draft.status} mode={draft.mode} />
            <CopySourceBadge source={draft.copySource} />
            {can('write') && draft.mode === 'dry_run' && (
              <Button size="xs" variant="ghost" icon="delete" onClick={() => setConfirmDelete(true)}>
                {t('Delete')}
              </Button>
            )}
          </div>
        </div>
        {draft.notes.length > 0 && (
          <ul className="space-y-1">
            {draft.notes.map((n) => (
              <li key={n} className="text-body-sm text-text-secondary flex gap-2">
                <Icon name="info" className="text-[1rem] text-status-completed mt-0.5 shrink-0" />
                {n}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          <PictureCard draft={draft} options={options} />
          <Card className="p-5 space-y-2">
            <CardHeader title={t('The words')} />
            <p className="text-label-md font-semibold text-text-primary">{draft.copy.headline}</p>
            <p className="text-body-sm text-text-secondary">{draft.copy.primaryText}</p>
            {draft.copy.bullets.length > 0 && (
              <ul className="list-disc pl-5 text-body-sm text-text-secondary">
                {draft.copy.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            <Badge tone="completed">{draft.copy.ctaText}</Badge>
          </Card>
        </div>
        <div className="space-y-4">
          <PayloadSummary draft={draft} />
          <PublishCard draft={draft} options={options} />
          <InsightsCard draft={draft} />
        </div>
      </div>
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        icon="delete"
        title={t('Delete this draft?')}
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>{t('Cancel')}</Button>
            <Button variant="danger" loading={del.isPending} onClick={() => void del.mutate(draft.id)}>
              {t('Delete')}
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-text-secondary">{t('The draft and its picture are removed. Nothing on Meta changes.')}</p>
      </Modal>
    </div>
  );
}
