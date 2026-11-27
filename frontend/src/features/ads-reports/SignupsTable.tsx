import { Badge } from '@/components/ui/Badge';
import { TableShell, Td, Th, Tr } from '@/components/tables/DataTable';
import { msg, useT } from '@/i18n/I18nContext';
import { formatDate } from '@/lib/format';
import type { AttributionTier, Signup } from '@/types/adsReports';
import { verdictTitle } from './reportFormat';

export const TIER_LABEL: Record<AttributionTier, string> = {
  campaign_matched: msg('Matched to an ad'),
  fbclid_only: msg('From Facebook, ad unknown'),
  none: msg('Not from Facebook'),
};

const TIER_TONE: Record<AttributionTier, 'active' | 'amber' | 'neutral'> = {
  campaign_matched: 'active',
  fbclid_only: 'amber',
  none: 'neutral',
};

export function verdictTone(verdict: string) {
  const v = verdict.toUpperCase();
  if (v === 'STRONG_QUALIFY') return 'active' as const;
  if (v.startsWith('NOT')) return 'draft' as const;
  if (!v) return 'neutral' as const;
  return 'completed' as const;
}

/** Website signups. Without `ads:leads` the API sends name/address as null and a last-4 phone mask. */
export function SignupsTable({ signups, piiVisible }: { signups: Signup[]; piiVisible: boolean }) {
  const t = useT();
  const hidden = <span className="text-text-tertiary italic">{t('Hidden')}</span>;
  return (
    <TableShell className="rounded-lg border border-border-strong">
      <thead>
        <tr>
          <Th>{t('Name')}</Th>
          <Th>{t('Mobile')}</Th>
          <Th>{t('Signed up')}</Th>
          <Th>{t("Site's verdict")}</Th>
          <Th>{t('Where from')}</Th>
          <Th>{t('Ad campaign')}</Th>
          <Th>{t('Shop address')}</Th>
        </tr>
      </thead>
      <tbody>
        {signups.map((s, i) => (
          <Tr key={s.id ?? `row-${i}`}>
            <Td className="font-medium">{s.name ?? (piiVisible ? '-' : hidden)}</Td>
            <Td className="font-mono-code whitespace-nowrap">{s.mobile ?? '-'}</Td>
            <Td className="whitespace-nowrap">{s.submittedAt ? `${formatDate(s.submittedAt)} ${s.submittedAt.slice(11, 16)}` : '-'}</Td>
            <Td>{s.qualificationVerdict ? <Badge tone={verdictTone(s.qualificationVerdict)}>{verdictTitle(s.qualificationVerdict)}</Badge> : <span className="text-text-tertiary">-</span>}</Td>
            <Td>
              <Badge tone={TIER_TONE[s.attributionTier] ?? 'neutral'}>{t(TIER_LABEL[s.attributionTier] ?? s.attributionTier)}</Badge>
            </Td>
            <Td className="text-[0.75rem]">
              {s.matchedCampaignName || s.matchedCampaignId || <span className="text-text-tertiary">-</span>}
              {(s.utmSource || s.utmMedium) && (
                <div className="text-text-tertiary">
                  {[s.utmSource, s.utmMedium].filter(Boolean).join(' / ')}
                </div>
              )}
            </Td>
            <Td className="text-[0.75rem] max-w-[16rem] whitespace-normal">{s.shopAddress ?? (piiVisible ? '-' : hidden)}</Td>
          </Tr>
        ))}
      </tbody>
    </TableShell>
  );
}
