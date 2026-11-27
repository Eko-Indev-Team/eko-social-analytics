import { Link } from 'react-router-dom';
import { useAppUi } from '@/app/AppUiContext';
import { useAuth } from '@/app/AuthContext';
import { Icon } from '@/components/ui/Icon';
import { InstagramRing } from '@/components/ui/InstagramRing';
import { Avatar } from '@/components/ui/Misc';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { formatCompact } from '@/lib/format';
import { accountService } from '@/services/accounts';

/**
 * Welcome card: the Instagram account's picture in a story ring, a greeting and the two main actions,
 * over a soft glow in Instagram's colours.
 */
export function DashboardHeader({ activeCount, healthScore }: { activeCount?: number; healthScore?: number }) {
  const t = useT();
  const { displayName, workspaceName } = useAuth();
  const { openCreateCampaign } = useAppUi();
  const accounts = useQuery('accounts:list', accountService.list);
  const primary = accounts.data?.find((a) => a.isPrimary);
  const firstName = displayName.split(' ')[0];
  const accountName = primary?.displayName ?? workspaceName;

  return (
    <section
      className="relative overflow-hidden rounded-2xl mb-6 text-white shadow-card"
      // Instagram's colours, muted: a dark navy wash over the gradient keeps the hues but drops the brightness.
      style={{
        background:
          'linear-gradient(rgba(14,17,34,0.58), rgba(14,17,34,0.58)), linear-gradient(115deg, #f58529 0%, #dd2a7b 38%, #8134af 72%, #515bd4 100%)',
      }}
    >
      {/* Decorative only: soft light blobs, a faint dot grid and a large Instagram-style camera outline. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-10 h-60 w-60 rounded-[9999px] bg-[#feda75] opacity-[0.12] blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-64 w-80 rounded-[9999px] bg-[#ff6fa8] opacity-[0.10] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '18px 18px', maskImage: 'linear-gradient(90deg, transparent 35%, #000 100%)' }}
        />
        <svg viewBox="0 0 100 100" className="absolute -right-8 -bottom-10 h-56 w-56 opacity-[0.14]" fill="none" stroke="#fff" strokeWidth="7">
          <rect x="8" y="8" width="84" height="84" rx="24" />
          <circle cx="50" cy="50" r="19" />
          <circle cx="73" cy="27" r="4" fill="#fff" stroke="none" />
        </svg>
      </div>

      <div className="relative flex flex-col md:flex-row md:items-center gap-5 p-5 md:p-7">
        <span className="self-start md:self-center rounded-[9999px] p-[3px] bg-white/90 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          <InstagramRing className="p-[3px]">
            <span className="rounded-[9999px] overflow-hidden flex w-16 h-16 bg-navy">
              <Avatar name={accountName} src={primary?.avatarUrl} size="lg" className="!w-16 !h-16 !rounded-none border-0" />
            </span>
          </InstagramRing>
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-[1.9rem] leading-tight font-extrabold tracking-tight drop-shadow-sm">
            {t('Hi {name}', { name: firstName })} 👋
          </h1>
          <p className="text-body-lg text-white/90 mt-1">
            {activeCount === undefined
              ? t('Here is how your Instagram is doing.')
              : t('Here is how your Instagram is doing. {count} campaigns are running.', { count: activeCount })}
          </p>
          <div className="mt-3 flex items-center gap-2 flex-wrap text-label-md">
            <span className="inline-flex items-center gap-1.5 rounded-[9999px] bg-white/15 border border-white/25 backdrop-blur-sm px-3 py-1 font-semibold">
              <Icon name="photo_camera" className="text-[0.95rem]" />@{primary?.handle ?? 'ekoindia'}
            </span>
            {primary?.followers !== undefined && (
              <span className="inline-flex items-center gap-1.5 rounded-[9999px] bg-white/15 border border-white/25 backdrop-blur-sm px-3 py-1 tnum">
                <Icon name="group" className="text-[0.95rem]" />
                {t('{count} followers', { count: formatCompact(primary.followers) })}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/ai-insights"
            className="px-3.5 py-2 rounded-xl bg-white/15 border border-white/30 backdrop-blur-sm text-white text-label-md font-semibold flex items-center gap-1.5 hover:bg-white/25 transition-colors"
          >
            <Icon name="auto_awesome" className="text-[1rem]" />
            {t('AI score')}: <span className="tnum">{healthScore ?? '—'}/100</span>
          </Link>
          <button
            type="button"
            onClick={openCreateCampaign}
            className="px-4 py-2 rounded-xl bg-white text-[#c13584] text-label-md font-bold flex items-center gap-1.5 shadow-[0_6px_18px_rgba(0,0,0,0.18)] hover:-translate-y-px hover:shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition-all"
          >
            <Icon name="add" className="text-[1.1rem]" />
            {t('New campaign')}
          </button>
        </div>
      </div>
    </section>
  );
}
