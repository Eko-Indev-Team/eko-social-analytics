import { useId, useRef, useState } from 'react';
import { useAuth } from '@/app/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, SegmentedControl, Select, TextInput } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback, Notice } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/Toast';
import { apiAssetUrl } from '@/features/ads-reports/reportFormat';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/format';
import { instagramPublishingService } from '@/services/instagramPublishing';
import type { PublicationCreateInput, PublicationItemType, PublicationKind, PublishingStatus } from '@/types/instagramPublishing';

const textareaCls =
  'w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder:text-text-subtle focus:outline-none focus:ring-0 focus:border-border-focused';

export const KIND_LABEL: Record<PublicationKind, string> = {
  image: msg('Photo'),
  carousel: msg('Carousel'),
  reel: msg('Reel'),
  story: msg('Story'),
};

const ALLOWED: Record<PublicationKind, PublicationItemType[]> = {
  image: ['image'],
  carousel: ['image', 'video'],
  reel: ['video'],
  story: ['image', 'video'],
};

interface DraftItem {
  key: string;
  type: PublicationItemType;
  /** Link items carry `url`; uploaded pictures carry `assetId` + `previewUrl`. */
  url: string;
  assetId?: string;
  previewUrl?: string;
}

const HASHTAG = /(?<![\p{L}\p{N}_])#[\p{L}\p{N}_]/gu;
const MENTION = /(?<![\p{L}\p{N}_])@[\p{L}\p{N}_.]+/gu;
export const countHashtags = (s: string) => (s.match(HASHTAG) ?? []).length;
const countMentions = (s: string) => (s.match(MENTION) ?? []).length;

const pad = (n: number) => String(n).padStart(2, '0');
/** Date → value for <input type="datetime-local"> (local time, minutes). */
function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** "2026-12-01T10:30" (local) → "2026-12-01T10:30:00+05:30" with the browser's offset at that moment. */
export function localToIsoWithOffset(local: string): string {
  const d = new Date(local);
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  const withSeconds = local.length === 16 ? `${local}:00` : local;
  return `${withSeconds}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

let nextKey = 0;
const newKey = () => `it${++nextKey}`;

/** Composer: account, post type, pictures / videos, caption, options and when. Owner/Admin only (instagram:publish). */
export function PublishComposer({ status, accountId, onAccountChange }: { status: PublishingStatus; accountId: string; onAccountChange: (id: string) => void }) {
  const t = useT();
  const toast = useToast();
  const { can } = useAuth();
  const ids = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const L = status.limits;

  const [kind, setKind] = useState<PublicationKind>('image');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [caption, setCaption] = useState('');
  const [shareToFeed, setShareToFeed] = useState(true);
  const [coverUrl, setCoverUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [when, setWhen] = useState<'now' | 'schedule'>('now');
  const [scheduledLocal, setScheduledLocal] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const account = status.accounts.find((a) => a.id === accountId);
  const anyPublishable = status.accounts.some((a) => a.canPublish);
  const enabled = status.enabled && status.canPublish && can('instagram:publish') && anyPublishable;
  const maxItems = kind === 'carousel' ? L.carouselMax : 1;
  const allowed = ALLOWED[kind];
  const canAddMore = items.length < maxItems;

  const limit = useQuery(`ig:publish:limit:${accountId}`, () => instagramPublishingService.limit(accountId), { enabled: !!accountId && enabled, isEmpty: () => false });

  const changeKind = (k: PublicationKind) => {
    setKind(k);
    const max = k === 'carousel' ? L.carouselMax : 1;
    setItems((prev) => prev.filter((i) => ALLOWED[k].includes(i.type)).slice(0, max));
    setErrors([]);
    setServerError(null);
  };

  const addLink = (type: PublicationItemType) => setItems((prev) => [...prev, { key: newKey(), type, url: '' }]);
  const patchItem = (key: string, url: string) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, url } : i)));
  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));
  const move = (index: number, delta: number) =>
    setItems((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const onFile = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    setServerError(null);
    if (file.type !== 'image/jpeg') return setServerError(t('Upload a JPEG picture.'));
    if (file.size > L.imageMaxBytes) return setServerError(t('The picture is too large (max {mb} MB).', { mb: Math.round(L.imageMaxBytes / 1048576) }));
    setUploading(true);
    try {
      const asset = await instagramPublishingService.uploadAsset(file);
      setItems((prev) => [...prev, { key: newKey(), type: 'image', url: '', assetId: asset.id, previewUrl: asset.previewUrl }]);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const hashtags = countHashtags(caption);

  const validate = (): string[] => {
    const out: string[] = [];
    if (!account) out.push(t('Choose an account.'));
    else if (!account.canPublish) out.push(account.reason ?? t('This account cannot publish.'));
    if (kind === 'carousel' && (items.length < L.carouselMin || items.length > L.carouselMax))
      out.push(t('A carousel needs {min} to {max} pictures or videos.', { min: L.carouselMin, max: L.carouselMax }));
    if (kind === 'image' && items.length !== 1) out.push(t('A photo post needs one picture.'));
    if (kind === 'reel' && items.length !== 1) out.push(t('A reel needs one video.'));
    if (kind === 'story' && items.length !== 1) out.push(t('A story needs one picture or video.'));
    if (items.some((i) => !i.assetId && !/^https:\/\/\S+\.\S+/i.test(i.url.trim()))) out.push(t('Every link must be a public https:// address.'));
    if (kind !== 'story') {
      if (caption.length > L.captionMax) out.push(t('The caption is too long (max {max} characters).', { max: L.captionMax }));
      if (hashtags > L.hashtagsMax) out.push(t('Use at most {max} hashtags.', { max: L.hashtagsMax }));
      if (countMentions(caption) > L.mentionsMax) out.push(t('Use at most {max} @mentions.', { max: L.mentionsMax }));
    }
    if (kind === 'image' && altText.trim().length > L.altTextMax) out.push(t('Alt text is too long (max {max} characters).', { max: L.altTextMax }));
    if (kind === 'reel' && coverUrl.trim() && !/^https:\/\/\S+\.\S+/i.test(coverUrl.trim())) out.push(t('The cover link must be a public https:// address.'));
    if (when === 'schedule') {
      const at = scheduledLocal ? new Date(scheduledLocal).getTime() : NaN;
      if (Number.isNaN(at)) out.push(t('Choose a date and time.'));
      else if (at < Date.now() + 60_000) out.push(t('Choose a time in the future.'));
      else if (at > Date.now() + L.scheduleMaxDays * 86_400_000) out.push(t('Posts can be scheduled at most {days} days ahead.', { days: L.scheduleMaxDays }));
    }
    return out;
  };

  const buildBody = (): PublicationCreateInput => ({
    accountId,
    kind,
    caption: kind === 'story' ? null : caption.trim() || null,
    items: items.map((i) => (i.assetId ? { type: i.type, assetId: i.assetId } : { type: i.type, url: i.url.trim() })),
    scheduledAt: when === 'schedule' ? localToIsoWithOffset(scheduledLocal) : null,
    ...(kind === 'reel' ? { shareToFeed, coverUrl: coverUrl.trim() || null } : {}),
    ...(kind === 'image' ? { altText: altText.trim() || null } : {}),
  });

  const create = useMutation(instagramPublishingService.create, {
    invalidate: ['ig:publish:list', `ig:publish:limit:${accountId}`],
    onSuccess: (p) => {
      setConfirm(false);
      setItems([]);
      setCaption('');
      setAltText('');
      setCoverUrl('');
      setScheduledLocal('');
      setWhen('now');
      toast({ tone: 'success', title: p.status === 'scheduled' ? t('Post scheduled') : t('Post sent to Instagram') });
    },
    onError: (e) => {
      setConfirm(false);
      setServerError(e instanceof ApiError || e instanceof Error ? e.message : String(e));
    },
  });

  const submit = () => {
    setServerError(null);
    const found = validate();
    setErrors(found);
    if (found.length) return;
    if (when === 'now') setConfirm(true);
    else void create.mutate(buildBody());
  };

  const now = new Date();
  const minLocal = toLocalInput(new Date(now.getTime() + 2 * 60_000));
  const maxLocal = toLocalInput(new Date(now.getTime() + L.scheduleMaxDays * 86_400_000));

  const q = limit.status === 'success' ? limit.data : undefined;

  return (
    <Card className="p-5 space-y-4">
      <CardHeader title={t('New post')} subtitle={t('Posts go live on Instagram. Check everything before you publish.')} />
      {!enabled && (
        <Notice tone="warning" title={t('You cannot publish right now')}>
          {!status.canPublish || !can('instagram:publish')
            ? t('Only an Admin or Owner can publish posts.')
            : t('None of the connected accounts can publish. See the reason next to each account.')}
        </Notice>
      )}
      <fieldset disabled={!enabled} className="space-y-4 min-w-0 disabled:opacity-60">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Account')} htmlFor={`${ids}-acc`}>
            <Select id={`${ids}-acc`} value={accountId} onChange={(e) => onAccountChange(e.target.value)} className="w-full">
              {status.accounts.map((a) => (
                <option key={a.id} value={a.id} disabled={!a.canPublish}>
                  @{a.username}
                  {a.canPublish ? '' : ` (${a.reason ?? t('cannot publish')})`}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-col gap-1">
            <span className="text-label-sm text-text-primary font-semibold">{t('Post type')}</span>
            <SegmentedControl<PublicationKind>
              ariaLabel={t('Post type')}
              value={kind}
              onChange={changeKind}
              options={(Object.keys(KIND_LABEL) as PublicationKind[]).map((k) => ({ value: k, label: t(KIND_LABEL[k]) }))}
            />
          </div>
        </div>
        {account && !account.canPublish && account.reason && <p className="text-[0.75rem] text-error">{account.reason}</p>}
        {q && q.quotaUsage !== null && q.quotaTotal !== null && (
          <p className="text-[0.75rem] text-text-tertiary">{t('Posts in the last 24 h: {used} / {total}', { used: q.quotaUsage, total: q.quotaTotal })}</p>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-label-sm text-text-primary font-semibold">
              {kind === 'carousel' ? t('Pictures and videos ({count} / {max})', { count: items.length, max: L.carouselMax }) : kind === 'reel' ? t('Video') : kind === 'image' ? t('Picture') : t('Picture or video')}
            </span>
            {kind === 'carousel' && <span className="text-[0.6875rem] text-text-tertiary">{t('{min} to {max} items', { min: L.carouselMin, max: L.carouselMax })}</span>}
          </div>
          {items.length > 0 && (
            <ul className="space-y-2">
              {items.map((item, index) => {
                const thumb = item.type === 'image' ? (item.assetId ? apiAssetUrl(item.previewUrl) : /^https:\/\//i.test(item.url) ? item.url : null) : null;
                return (
                  <li key={item.key} className="flex items-center gap-3 p-2 rounded-lg border border-border-strong bg-surface-card-subtle">
                    <div className="w-14 h-14 rounded-md bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
                      {thumb ? <ImageWithFallback src={thumb} alt={t('Picture {n}', { n: index + 1 })} className="w-full h-full object-cover" /> : <Icon name={item.type === 'video' ? 'movie' : 'image'} className="text-text-tertiary" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      {item.assetId ? (
                        <p className="text-body-sm text-text-secondary">{t('Uploaded picture')}</p>
                      ) : (
                        <TextInput
                          type="url"
                          inputMode="url"
                          placeholder={item.type === 'video' ? t('https://… link to a video (MP4)') : t('https://… link to a picture (JPEG)')}
                          aria-label={item.type === 'video' ? t('Video link {n}', { n: index + 1 }) : t('Picture link {n}', { n: index + 1 })}
                          value={item.url}
                          onChange={(e) => patchItem(item.key, e.target.value)}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {kind === 'carousel' && (
                        <>
                          <Button size="icon" variant="ghost" icon="arrow_upward" aria-label={t('Move item {n} up', { n: index + 1 })} disabled={index === 0} onClick={() => move(index, -1)} />
                          <Button size="icon" variant="ghost" icon="arrow_downward" aria-label={t('Move item {n} down', { n: index + 1 })} disabled={index === items.length - 1} onClick={() => move(index, 1)} />
                        </>
                      )}
                      <Button size="icon" variant="ghost" icon="close" aria-label={t('Remove item {n}', { n: index + 1 })} onClick={() => removeItem(item.key)} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {canAddMore && (
            <div className="flex flex-wrap gap-2">
              {allowed.includes('image') && (
                <>
                  <input ref={fileInput} type="file" accept="image/jpeg" className="sr-only" aria-label={t('Choose a JPEG picture')} onChange={(e) => void onFile(e.target.files?.[0])} />
                  {status.uploadsAvailable && (
                    <Button size="xs" icon="upload" loading={uploading} onClick={() => fileInput.current?.click()}>
                      {t('Upload JPEG')}
                    </Button>
                  )}
                  <Button size="xs" icon="link" onClick={() => addLink('image')}>
                    {t('Add picture link')}
                  </Button>
                </>
              )}
              {allowed.includes('video') && (
                <Button size="xs" icon="movie" onClick={() => addLink('video')}>
                  {t('Add video link')}
                </Button>
              )}
            </div>
          )}
          <p className="text-[0.6875rem] text-text-tertiary">
            {status.uploadsAvailable
              ? t('Pictures: upload a JPEG (max {mb} MB) or paste a public https link. Videos: public https link only.', { mb: Math.round(L.imageMaxBytes / 1048576) })
              : t('Paste public https links. Instagram downloads the files from there.')}
          </p>
        </div>

        {kind !== 'story' && (
          <Field
            label={t('Caption')}
            htmlFor={`${ids}-cap`}
            hint={
              <span className={cn(caption.length > L.captionMax || hashtags > L.hashtagsMax ? 'text-error' : undefined)}>
                {t('{n} / {max} characters', { n: caption.length, max: L.captionMax })} · {t('{n} / {max} hashtags', { n: hashtags, max: L.hashtagsMax })}
              </span>
            }
          >
            <textarea id={`${ids}-cap`} rows={4} className={textareaCls} value={caption} onChange={(e) => setCaption(e.target.value)} />
          </Field>
        )}

        {kind === 'reel' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-body-sm text-text-primary cursor-pointer">
              <input type="checkbox" className="h-4 w-4" checked={shareToFeed} onChange={(e) => setShareToFeed(e.target.checked)} />
              {t('Also share to feed')}
            </label>
            <Field label={t('Cover picture link (optional)')} htmlFor={`${ids}-cover`}>
              <TextInput id={`${ids}-cover`} type="url" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" />
            </Field>
          </div>
        )}
        {kind === 'image' && (
          <Field label={t('Alt text (optional)')} htmlFor={`${ids}-alt`} hint={t('{n} / {max} characters', { n: altText.length, max: L.altTextMax })}>
            <TextInput id={`${ids}-alt`} value={altText} onChange={(e) => setAltText(e.target.value)} />
          </Field>
        )}

        <div className="space-y-2">
          <span className="text-label-sm text-text-primary font-semibold">{t('When')}</span>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-body-sm text-text-primary cursor-pointer">
              <input type="radio" name={`${ids}-when`} checked={when === 'now'} onChange={() => setWhen('now')} />
              {t('Publish now')}
            </label>
            <label className="flex items-center gap-2 text-body-sm text-text-primary cursor-pointer">
              <input type="radio" name={`${ids}-when`} checked={when === 'schedule'} onChange={() => setWhen('schedule')} />
              {t('Schedule')}
            </label>
            {when === 'schedule' && (
              <TextInput
                type="datetime-local"
                aria-label={t('Date and time')}
                className="w-auto"
                min={minLocal}
                max={maxLocal}
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
              />
            )}
          </div>
          {when === 'schedule' && <p className="text-[0.6875rem] text-text-tertiary">{t('Your local time. Up to {days} days ahead.', { days: L.scheduleMaxDays })}</p>}
        </div>

        {errors.length > 0 && (
          <ul role="alert" className="space-y-0.5 text-[0.75rem] text-error">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {serverError && (
          <p role="alert" className="text-[0.75rem] text-error">
            {serverError}
          </p>
        )}
        <div className="flex justify-end">
          <Button variant="primary" icon={when === 'now' ? 'send' : 'schedule'} loading={create.isPending && !confirm} onClick={submit}>
            {when === 'now' ? t('Publish') : t('Schedule post')}
          </Button>
        </div>
      </fieldset>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        icon="send"
        title={t('Publish this post now?')}
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>{t('Cancel')}</Button>
            <Button variant="primary" loading={create.isPending} onClick={() => void create.mutate(buildBody())} data-autofocus>
              {t('Yes, publish')}
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-text-secondary">{t('This will post publicly on @{username}.', { username: account?.username ?? '' })}</p>
      </Modal>
    </Card>
  );
}
