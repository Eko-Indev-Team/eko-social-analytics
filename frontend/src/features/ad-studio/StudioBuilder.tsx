import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Select, TextInput } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Misc';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import { adStudioService, checkCopy, guardrailViolations } from '@/services/adStudio';
import type { AdCopy, Draft, StudioAngle, StudioGender, StudioObjective, StudioOptions, StudioTargeting, StudioVillage } from '@/types/adStudio';
import { CopySourceBadge, inr, StepCard } from './studioUi';

const textareaCls =
  'w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder:text-text-subtle focus:outline-none focus:ring-0 focus:border-border-focused';

function VillagePicker({ district, selected, onToggle }: { district: string; selected: string[]; onToggle: (v: StudioVillage) => void }) {
  const t = useT();
  const q = useQuery(`ads:studio:villages:${district}`, () => adStudioService.villages(district), { isEmpty: () => false });
  if (q.status === 'loading') return <p className="text-[0.75rem] text-text-tertiary">{t('Loading villages…')}</p>;
  const list = q.data ?? [];
  if (list.length === 0) return <p className="text-[0.75rem] text-text-tertiary">{t('{district}: no village list, the whole district is used.', { district })}</p>;
  return (
    <fieldset className="space-y-1">
      <legend className="text-[0.75rem] font-semibold text-text-secondary">{t('{district}: villages (optional)', { district })}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {list.map((v) => (
          <label key={v.code} className="flex items-center gap-1.5 text-body-sm text-text-primary cursor-pointer">
            <Checkbox checked={selected.includes(v.code)} onChange={() => onToggle(v)} label={v.village ?? v.code} />
            {v.village ?? v.code}
            {v.pincode && <span className="text-text-tertiary text-[0.6875rem]">{v.pincode}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Step-by-step ad builder. "Build" always makes a dry run: the exact Meta requests are prepared, nothing is sent. */
export function StudioBuilder({ options, onBuilt }: { options: StudioOptions; onBuilt: (draft: Draft) => void }) {
  const t = useT();
  const d = options.defaults;
  const caps = options.capabilities;

  const [angle, setAngle] = useState<StudioAngle>((d.brief.angle as StudioAngle) ?? 'general_opportunity');
  const [objective, setObjective] = useState<StudioObjective>((d.brief.objective as StudioObjective) ?? 'leads');
  const [language, setLanguage] = useState<'hindi' | 'english'>(d.brief.language === 'english' ? 'english' : 'hindi');
  const [product, setProduct] = useState(d.brief.product ?? '');
  const [description, setDescription] = useState(d.brief.description ?? '');
  const [captionIndex, setCaptionIndex] = useState(1);
  const [copy, setCopy] = useState<AdCopy | null>(null);
  const [edited, setEdited] = useState(false);

  const [districts, setDistricts] = useState<string[]>([]);
  const [villageCodes, setVillageCodes] = useState<string[]>([]);
  const [ageMin, setAgeMin] = useState(d.targeting.ageMin);
  const [ageMax, setAgeMax] = useState(d.targeting.ageMax);
  const [gender, setGender] = useState<StudioGender>(d.targeting.gender);
  const [dailyBudget, setDailyBudget] = useState(d.targeting.dailyBudget);
  const [scheduleDays, setScheduleDays] = useState(d.targeting.scheduleDays);
  const [preview, setPreview] = useState<StudioTargeting | null>(null);

  const [url, setUrl] = useState(d.destinationUrl);
  const [phone, setPhone] = useState('');
  const [targetCpa, setTargetCpa] = useState<number>(d.targetCpa);
  const [serverViolations, setServerViolations] = useState<string[]>([]);

  const brief = { product, description, objective, language, angle, tone: d.brief.tone, visualStyle: d.brief.visual_style };
  const targetingInput = { districts, villageCodes, ageMin, ageMax, gender, dailyBudget, scheduleDays, placements: d.targeting.placements };

  const copyMut = useMutation(adStudioService.copy, {
    onSuccess: (c) => {
      setCopy(c);
      setEdited(false);
      setServerViolations([]);
    },
  });
  const targetingMut = useMutation(adStudioService.targeting, { onSuccess: setPreview });
  const buildMut = useMutation(adStudioService.createDraft, {
    invalidate: ['ads:studio:drafts'],
    onSuccess: onBuilt,
    onError: (err) => setServerViolations(guardrailViolations(err).length ? guardrailViolations(err) : [err.message]),
  });

  const localViolations = useMemo(() => (copy ? checkCopy(copy, angle) : []), [copy, angle]);
  const ageError = ageMin > ageMax ? t('Minimum age must not be above maximum age.') : ageMin < 18 || ageMax > 65 ? t('Ages must be between 18 and 65.') : undefined;
  const budgetError = !(dailyBudget > 0) ? t('Enter a daily budget above 0.') : undefined;

  const patchCopy = (patch: Partial<AdCopy>) => {
    if (!copy) return;
    setCopy({ ...copy, ...patch });
    setEdited(true);
    setServerViolations([]);
  };

  const toggleDistrict = (name: string) => {
    setPreview(null);
    setDistricts((cur) => (cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name]));
  };

  const build = () => {
    if (!copy) return;
    setServerViolations([]);
    void buildMut.mutate({
      brief,
      copy: {
        headlineLine1: copy.headlineLine1,
        headlineLine2: copy.headlineLine2,
        subheading: copy.subheading,
        primaryText: copy.primaryText,
        description: copy.description,
        bullets: copy.bullets.filter((b) => b.trim()),
        ctaText: copy.ctaText,
        headline: null,
        source: edited && copy.source !== 'ai' ? 'custom' : copy.source,
        captionIndex: copy.captionIndex,
        aiModel: copy.aiModel,
      },
      targeting: targetingInput,
      destination: { url, number: phone.trim() || null },
      targetCpa: targetCpa > 0 ? targetCpa : null,
    });
  };

  const violations = serverViolations.length ? serverViolations : localViolations;
  const canBuild = !!copy && localViolations.length === 0 && !ageError && !budgetError && caps.canEdit;

  return (
    <div className="space-y-4">
      <StepCard step={1} title={t('What is the ad for?')} subtitle={t('Pick who you are talking to and what you want people to do.')}>
        <div role="radiogroup" aria-label={t('Angle')} className="grid gap-2 md:grid-cols-3">
          {options.angles.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={angle === a.id}
              onClick={() => setAngle(a.id as StudioAngle)}
              className={cn(
                'text-left rounded-lg border p-3 transition-colors',
                angle === a.id ? 'border-primary-container bg-status-completed-subtle' : 'border-border-strong hover:border-slate-600',
              )}
            >
              <span className="block text-label-md font-semibold text-text-primary">{a.label}</span>
              {a.description && <span className="block text-[0.75rem] text-text-secondary mt-0.5">{a.description}</span>}
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label={t('Goal')} htmlFor="studio-objective">
            <Select id="studio-objective" value={objective} onChange={(e) => setObjective(e.target.value as StudioObjective)}>
              {options.objectives.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('Language')} htmlFor="studio-language">
            <Select id="studio-language" value={language} onChange={(e) => setLanguage(e.target.value as 'hindi' | 'english')}>
              <option value="hindi">{t('Hindi')}</option>
              <option value="english">{t('English')}</option>
            </Select>
          </Field>
          <Field label={t('Product')} htmlFor="studio-product">
            <TextInput id="studio-product" value={product} maxLength={200} onChange={(e) => setProduct(e.target.value)} />
          </Field>
        </div>
        <Field label={t('Short description (for AI copy)')} htmlFor="studio-description">
          <TextInput id="studio-description" value={description} maxLength={600} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </StepCard>

      <StepCard step={2} title={t('The words')} subtitle={t('Start from an approved caption. Edited text is marked "Custom"; the button text must stay one of the approved phrases.')}>
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t('Approved caption')} htmlFor="studio-caption">
            <Select id="studio-caption" value={captionIndex} onChange={(e) => setCaptionIndex(Number(e.target.value))} className="max-w-xs">
              {options.lockedCaptions.map((c) => (
                <option key={c.index} value={c.index}>
                  {c.index}. {c.hook}
                </option>
              ))}
            </Select>
          </Field>
          <Button icon="verified" loading={copyMut.isPending} onClick={() => void copyMut.mutate({ mode: 'locked', captionIndex, brief })}>
            {t('Use this caption')}
          </Button>
          <Button
            variant="ai"
            icon="auto_awesome"
            disabled={!caps.aiCopy}
            title={caps.aiCopy ? undefined : t('AI copy is not set up. Approved captions only.')}
            onClick={() => void copyMut.mutate({ mode: 'generate', captionIndex, brief })}
          >
            {t('Write with AI')}
          </Button>
        </div>
        {!caps.aiCopy && <p className="text-[0.75rem] text-text-tertiary">{t('AI copy is not set up on this server, so only approved captions are available.')}</p>}
        {copy && (
          <div className="space-y-3 rounded-lg border border-border-strong p-4">
            <div className="flex flex-wrap items-center gap-2">
              <CopySourceBadge source={edited && copy.source !== 'ai' ? 'custom' : copy.source} />
              {copy.aiModel && <span className="text-[0.75rem] text-text-tertiary">{copy.aiModel}</span>}
              {copy.guardrails.ctaReplaced && <Badge tone="amber">{t('Button text was replaced with an approved one')}</Badge>}
              {copy.guardrails.removedPhrases.length > 0 && <Badge tone="amber">{t('Removed: {phrases}', { phrases: copy.guardrails.removedPhrases.join(', ') })}</Badge>}
            </div>
            {copy.note && <Notice tone={copy.source === 'ai' ? 'ai' : 'warning'}>{copy.note}</Notice>}
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('Headline line 1')} htmlFor="copy-h1">
                <TextInput id="copy-h1" value={copy.headlineLine1} maxLength={120} onChange={(e) => patchCopy({ headlineLine1: e.target.value })} />
              </Field>
              <Field label={t('Headline line 2')} htmlFor="copy-h2">
                <TextInput id="copy-h2" value={copy.headlineLine2} maxLength={120} onChange={(e) => patchCopy({ headlineLine2: e.target.value })} />
              </Field>
            </div>
            <Field label={t('Main text')} htmlFor="copy-primary">
              <textarea id="copy-primary" rows={3} className={textareaCls} value={copy.primaryText} maxLength={500} onChange={(e) => patchCopy({ primaryText: e.target.value })} />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('Subheading')} htmlFor="copy-sub">
                <TextInput id="copy-sub" value={copy.subheading} maxLength={200} onChange={(e) => patchCopy({ subheading: e.target.value })} />
              </Field>
              <Field label={t('Description')} htmlFor="copy-desc">
                <TextInput id="copy-desc" value={copy.description} maxLength={200} onChange={(e) => patchCopy({ description: e.target.value })} />
              </Field>
            </div>
            <Field label={t('Bullets (one per line, up to 4)')} htmlFor="copy-bullets">
              <textarea
                id="copy-bullets"
                rows={4}
                className={textareaCls}
                value={copy.bullets.join('\n')}
                onChange={(e) => patchCopy({ bullets: e.target.value.split('\n').slice(0, 4) })}
              />
            </Field>
            <Field label={t('Button text')} htmlFor="copy-cta">
              <Select id="copy-cta" value={copy.ctaText} onChange={(e) => patchCopy({ ctaText: e.target.value })}>
                {!options.ctas.some((c) => c.text === copy.ctaText) && <option value={copy.ctaText}>{copy.ctaText}</option>}
                {options.ctas.map((c) => (
                  <option key={c.text} value={c.text}>
                    {c.text} ({c.metaType})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        {violations.length > 0 && (
          <div role="alert" className="rounded-lg border border-error/30 bg-error-container/50 px-3 py-2">
            <p className="text-body-sm font-semibold text-text-primary flex items-center gap-1.5">
              <Icon name="gpp_bad" className="text-[1.125rem] text-error" />
              {t('Fix these before building:')}
            </p>
            <ul className="list-disc pl-6 mt-1 text-body-sm text-text-secondary">
              {violations.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-[0.75rem] text-text-tertiary">{t('Not allowed anywhere: {phrases}.', { phrases: options.bannedPhrases.join(' · ') })}</p>
      </StepCard>

      <StepCard step={3} title={t('Where and who')} subtitle={t('Choose districts (and villages if you want). Saturated districts cannot be picked.')}>
        {!options.referenceDataLoaded && <Notice tone="warning">{t('Location reference data is not imported, so districts have no map points yet.')}</Notice>}
        <fieldset>
          <legend className="text-label-sm font-semibold text-text-primary mb-1">{t('Districts')}</legend>
          <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto custom-scrollbar">
            {options.districts.map((dist) => {
              const on = districts.includes(dist.name);
              return (
                <button
                  key={dist.name}
                  type="button"
                  aria-pressed={on}
                  disabled={dist.excluded}
                  title={dist.excludedReason ?? (dist.state ? dist.state : undefined)}
                  onClick={() => toggleDistrict(dist.name)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-[0.75rem] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:line-through',
                    on ? 'border-primary-container bg-status-completed-subtle text-text-primary font-semibold' : 'border-border-strong text-text-secondary hover:text-text-primary',
                  )}
                >
                  {on && <Icon name="check" className="text-[0.875rem] mr-0.5 align-[-2px]" />}
                  {dist.name}
                  {dist.excluded && dist.excludedReason && <span className="ml-1 no-underline">({dist.excludedReason})</span>}
                </button>
              );
            })}
          </div>
          {options.districts.length === 0 && <p className="text-body-sm text-text-tertiary">{t('No districts available.')}</p>}
        </fieldset>
        {districts.map((dist) => (
          <VillagePicker
            key={dist}
            district={dist}
            selected={villageCodes}
            onToggle={(v) => {
              setPreview(null);
              setVillageCodes((cur) => (cur.includes(v.code) ? cur.filter((x) => x !== v.code) : [...cur, v.code]));
            }}
          />
        ))}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          <Field label={t('Min age')} htmlFor="t-agemin" error={ageError}>
            <TextInput id="t-agemin" type="number" min={18} max={65} value={ageMin} invalid={!!ageError} onChange={(e) => setAgeMin(Number(e.target.value))} />
          </Field>
          <Field label={t('Max age')} htmlFor="t-agemax">
            <TextInput id="t-agemax" type="number" min={18} max={65} value={ageMax} invalid={!!ageError} onChange={(e) => setAgeMax(Number(e.target.value))} />
          </Field>
          <Field label={t('Gender')} htmlFor="t-gender">
            <Select id="t-gender" value={gender} onChange={(e) => setGender(e.target.value as StudioGender)}>
              <option value="all">{t('Everyone')}</option>
              <option value="male">{t('Men')}</option>
              <option value="female">{t('Women')}</option>
            </Select>
          </Field>
          <Field label={t('Daily budget (₹)')} htmlFor="t-budget" error={budgetError}>
            <TextInput id="t-budget" type="number" min={1} value={dailyBudget} invalid={!!budgetError} onChange={(e) => setDailyBudget(Number(e.target.value))} />
          </Field>
          <Field label={t('Days (planning only)')} htmlFor="t-days">
            <TextInput id="t-days" type="number" min={1} max={90} value={scheduleDays} onChange={(e) => setScheduleDays(Number(e.target.value))} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button icon="map" loading={targetingMut.isPending} disabled={!!ageError || !!budgetError} onClick={() => void targetingMut.mutate(targetingInput)}>
            {t('Preview targeting')}
          </Button>
          <span className="text-[0.75rem] text-text-tertiary">{t('Placements: automatic (Meta chooses).')}</span>
        </div>
        {preview && (
          <div className="rounded-lg border border-border-strong p-4 space-y-2" data-testid="targeting-preview">
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <dt className="text-[0.75rem] text-text-tertiary">{t('Districts')}</dt>
                <dd className="font-semibold text-text-primary">{preview.districts.length ? preview.districts.join(', ') : t('All of India')}</dd>
              </div>
              <div>
                <dt className="text-[0.75rem] text-text-tertiary">{t('Map points (radius)')}</dt>
                <dd className="font-semibold text-text-primary tnum">{preview.anchors.length}</dd>
              </div>
              <div>
                <dt className="text-[0.75rem] text-text-tertiary">{t('PIN codes')}</dt>
                <dd className="font-semibold text-text-primary tnum">{preview.pincodes.length}</dd>
              </div>
              <div>
                <dt className="text-[0.75rem] text-text-tertiary">{t('People')}</dt>
                <dd className="font-semibold text-text-primary">
                  {preview.ageMin}-{preview.ageMax} · {preview.gender === 'all' ? t('Everyone') : preview.gender === 'male' ? t('Men') : t('Women')} · {inr(preview.dailyBudget)}
                  {t('/day')}
                </dd>
              </div>
            </dl>
            {preview.removed.length > 0 && <p className="text-body-sm text-status-paused">{t('Removed: {names}', { names: preview.removed.join(', ') })}</p>}
            {preview.unresolvedDistricts.length > 0 && (
              <p className="text-body-sm text-text-secondary">{t('No map points for: {names}. A live publish looks them up on Meta.', { names: preview.unresolvedDistricts.join(', ') })}</p>
            )}
            {preview.notes.map((n) => (
              <p key={n} className="text-[0.75rem] text-text-tertiary">
                {n}
              </p>
            ))}
          </div>
        )}
      </StepCard>

      <StepCard step={4} title={t('Where people land')} subtitle={t('The website link the ad opens. A call or WhatsApp number is shown in the review only.')}>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label={t('Website link')} htmlFor="dest-url" className="md:col-span-2">
            <TextInput id="dest-url" value={url} maxLength={500} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <Field label={t('Call / WhatsApp number (optional)')} htmlFor="dest-phone">
            <TextInput id="dest-phone" value={phone} maxLength={30} onChange={(e) => setPhone(e.target.value.replace(/[^0-9+()\- ]/g, ''))} />
          </Field>
          <Field label={t('Target cost per lead (₹)')} htmlFor="dest-cpa" hint={t('Used for the advice after the ad runs.')}>
            <TextInput id="dest-cpa" type="number" min={1} value={targetCpa} onChange={(e) => setTargetCpa(Number(e.target.value))} />
          </Field>
        </div>
      </StepCard>

      <StepCard step={5} title={t('Build (dry run)')} subtitle={t('Prepares the exact requests for Meta and saves them as a draft. Nothing is sent. Add the picture on the next screen.')}>
        {!caps.canEdit && <Notice tone="info">{t('Your role can look but not build ads.')}</Notice>}
        <Button variant="primary" size="md" icon="construction" loading={buildMut.isPending} disabled={!canBuild} onClick={build}>
          {t('Build dry run')}
        </Button>
        {!copy && <p className="text-[0.75rem] text-text-tertiary">{t('Pick the words in step 2 first.')}</p>}
      </StepCard>
    </div>
  );
}
