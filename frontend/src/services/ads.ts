import { demoAdDetails, demoAdLeads, demoAds, demoAdsStatus } from '@/data/ads';
import { ApiError } from '@/lib/api/client';
import { fromSource, mutateSource, NotFoundError } from '@/lib/api/source';
import { config } from '@/lib/config';
import { qualifyLead, QUALIFICATION_STATUSES, type EsafResponse } from '@/lib/qualification';
import type { AdLead, AdLeadQuery, AdsStatus, AdsSummary, AdsSyncResult, CreativeLabel, QualificationCounts } from '@/types/ads';

/** In-memory demo stores (demo mode only). */
const leadStore: AdLead[] = structuredClone(demoAdLeads);
const adStore = structuredClone(demoAds);
const labelStore = new Map<string, string | null>(adStore.filter((a) => a.creative.imageHash).map((a) => [a.creative.imageHash as string, a.creative.imageType]));
let statusStore: AdsStatus = structuredClone(demoAdsStatus);

function query(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

function matchesStatus(lead: AdLead, status: AdLeadQuery['status']): boolean {
  if (!status || status === 'all') return true;
  if (status === 'qualified') return lead.qualified;
  if (status === 'pincode') return lead.pincodeQualified === true;
  return lead.qualificationStatus === status;
}

function demoLeads({ adId, status, q }: AdLeadQuery): AdLead[] {
  const needle = q?.trim().toLowerCase() ?? '';
  return leadStore.filter(
    (l) =>
      (!adId || l.adId === adId) &&
      matchesStatus(l, status) &&
      (!needle ||
        [l.name, l.phone, l.adName, l.campaignName, l.submittedPincode].some((v) => v?.toLowerCase().includes(needle))),
  );
}

export function countByStatus(leads: AdLead[]): QualificationCounts {
  const counts = Object.fromEntries(QUALIFICATION_STATUSES.map((s) => [s, 0])) as QualificationCounts;
  for (const l of leads) counts[l.qualificationStatus] += 1;
  return counts;
}

function demoSummary(): AdsSummary {
  const sum = (pick: (a: (typeof adStore)[number]) => number) => adStore.reduce((acc, a) => acc + pick(a), 0);
  const spend = sum((a) => a.metrics.spend);
  const leads = leadStore.length;
  const qualified = leadStore.filter((l) => l.qualified).length;
  return {
    spend,
    impressions: sum((a) => a.metrics.impressions),
    reach: sum((a) => a.metrics.reach),
    clicks: sum((a) => a.metrics.clicks),
    linkClicks: sum((a) => a.metrics.linkClicks),
    landingPageViews: sum((a) => a.metrics.landingPageViews),
    leads,
    pincodeQualifiedLeads: leadStore.filter((l) => l.pincodeQualified === true).length,
    qualifiedLeads: qualified,
    websiteSignups: 64,
    strongSignups: 19,
    adCount: adStore.length,
    activeAdCount: adStore.filter((a) => a.status === 'ACTIVE').length,
    completedAdCount: adStore.filter((a) => a.status === 'COMPLETED').length,
    qualificationCounts: countByStatus(leadStore),
    costPerLead: leads ? spend / leads : null,
    costPerQualifiedLead: qualified ? spend / qualified : null,
    currency: 'INR',
  };
}

/** Turns an API-relative picture path (`/api/v1/ads/{id}/image`) into a URL the browser can load. */
export function resolveAdImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (/^https?:\/\//.test(imageUrl) || imageUrl.startsWith('data:')) return imageUrl;
  if (config.dataSource !== 'api') return imageUrl;
  try {
    return new URL(imageUrl, config.apiBaseUrl).toString();
  } catch {
    return imageUrl;
  }
}

export interface AdsExportParams {
  adId?: string;
  filter?: string;
  from?: string;
  to?: string;
}

/** Path of an Excel download (relative to the API base URL). */
export function adsExportPath({ adId, filter, from, to }: AdsExportParams = {}): string {
  return adId ? `/ads/${adId}/export.xlsx` : `/ads/export.xlsx${query({ from, to, filter })}`;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function demoCsv(leads: AdLead[]): string {
  const header = ['Lead ID', 'Created', 'Ad', 'Campaign', 'Name', 'Phone', 'Pincode', 'Qualification', 'Why not SBI', 'Education', 'Can invest', 'ESAF response'];
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const yn = (v: boolean | null) => (v === null ? '' : v ? 'Yes' : 'No');
  const lines = leads.map((l) =>
    [l.id, l.createdTime, l.adName, l.campaignName, l.name, l.phone, l.submittedPincode, l.qualificationStatus, l.sbiReasons.join('; '), l.educationLevel, yn(l.canInvest), l.esafResponse]
      .map(cell)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export const adsService = {
  status: () => fromSource(() => statusStore, '/ads/status'),
  summary: () => fromSource(demoSummary, '/ads/summary'),
  list: () => fromSource(() => adStore, '/ads'),
  detail: (adId: string) =>
    fromSource(() => {
      const found = demoAdDetails[adId];
      if (!found) throw new NotFoundError('Ad', adId);
      const row = adStore.find((a) => a.id === adId);
      return row ? { ...found, creative: row.creative, leadCounts: row.leadCounts } : found;
    }, `/ads/${adId}`),
  leads: (params: AdLeadQuery = {}) =>
    fromSource(() => demoLeads(params), `/ads/leads${query({ adId: params.adId, status: params.status && params.status !== 'all' ? params.status : undefined, q: params.q?.trim() })}`),
  adLeads: (adId: string) => fromSource(() => demoLeads({ adId }), `/ads/${adId}/leads`),

  /** Records the lead's answer to the ESAF pitch; the status is recomputed (by the API, or locally in demo mode). */
  updateLead: (id: string, patch: { esafResponse: EsafResponse }) =>
    mutateSource(
      () => {
        const lead = leadStore.find((l) => l.id === id);
        if (!lead) throw new NotFoundError('Ad lead', id);
        lead.esafResponse = patch.esafResponse;
        lead.esafResponseSource = patch.esafResponse ? 'staff' : null;
        const { status, reasons } = qualifyLead(lead.pincodeMatch, lead.educationOk, lead.canInvest, lead.esafResponse);
        lead.qualificationStatus = status;
        lead.sbiReasons = reasons;
        lead.qualified = status === 'sbi_strong' || status === 'esaf_strong';
        const row = adStore.find((a) => a.id === lead.adId);
        if (row) row.leadCounts.qualified = leadStore.filter((l) => l.adId === row.id && l.qualified).length;
        return lead;
      },
      { method: 'patch', path: `/ads/leads/${id}`, body: patch },
    ),

  sync: (kind: 'meta' | 'signups' = 'meta') =>
    mutateSource<AdsSyncResult>(
      () => {
        statusStore = { ...statusStore, lastSyncedAt: new Date().toISOString(), lastSyncStatus: 'succeeded' };
        return { jobId: `adsr_demo${Date.now().toString(16)}`, status: 'succeeded', kind, deduplicated: false };
      },
      { method: 'post', path: '/ads/sync', body: { kind } },
    ),

  creativeLabels: () =>
    fromSource<CreativeLabel[]>(
      () =>
        [...labelStore.entries()].map(([imageHash, imageType]) => ({
          imageHash,
          imageType,
          adIds: adStore.filter((a) => a.creative.imageHash === imageHash).map((a) => a.id),
          imageUrl: null,
        })),
      '/ads/creative-labels',
    ),

  setCreativeLabel: (imageHash: string, imageType: string | null) =>
    mutateSource<CreativeLabel>(
      () => {
        const value = imageType?.trim() || null;
        labelStore.set(imageHash, value);
        const adIds: string[] = [];
        for (const a of adStore)
          if (a.creative.imageHash === imageHash) {
            a.creative.imageType = value;
            adIds.push(a.id);
          }
        return { imageHash, imageType: value, adIds, imageUrl: null };
      },
      { method: 'put', path: `/ads/creative-labels/${encodeURIComponent(imageHash)}`, body: { imageType: imageType?.trim() || null } },
    ),

  /**
   * Downloads leads as a spreadsheet. API mode: the backend's Excel file (needs `ads:leads`).
   * Demo mode: a CSV of the sample leads made in the browser.
   */
  async downloadLeads(params: AdsExportParams = {}): Promise<{ filename: string }> {
    if (config.dataSource !== 'api') {
      const leads = demoLeads({ adId: params.adId, status: (params.filter || 'all') as AdLeadQuery['status'] });
      const filename = params.adId ? `ad-${params.adId}-leads-demo.csv` : 'ad-leads-demo.csv';
      saveBlob(new Blob([demoCsv(leads)], { type: 'text/csv' }), filename);
      return { filename };
    }
    let res: Response;
    try {
      res = await fetch(`${config.apiBaseUrl}${adsExportPath(params)}`, { credentials: 'include' });
    } catch {
      throw new ApiError(`Cannot reach the SocialBoard API at ${config.apiBaseUrl}. Is the backend running?`, 0, 'network_error');
    }
    if (!res.ok) {
      let message = `Download failed (${res.status})`;
      let code: string | undefined;
      try {
        const body = (await res.json()) as { error?: { code?: string; message?: string } };
        message = body.error?.message ?? message;
        code = body.error?.code;
      } catch {
        /* not JSON */
      }
      throw new ApiError(message, res.status, code);
    }
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? (params.adId ? `ad-${params.adId}-leads.xlsx` : 'ad-leads.xlsx');
    saveBlob(await res.blob(), filename);
    return { filename };
  },
};
