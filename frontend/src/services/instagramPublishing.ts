import { ApiError, apiClient } from '@/lib/api/client';
import { config } from '@/lib/config';
import { fromSource, mutateSource } from '@/lib/api/source';
import type { Publication, PublicationCreateInput, PublishAsset, PublishingLimit, PublishingStatus } from '@/types/instagramPublishing';

const base = '/integrations/instagram';

/**
 * Sample mode has no real Instagram accounts, so publishing is shown as not available: no accounts and no posts.
 * Nothing here is made up; the limits are Instagram's own rules (the same numbers the server sends).
 */
const DEMO_STATUS: PublishingStatus = {
  enabled: false,
  canPublish: false,
  uploadsAvailable: false,
  accounts: [],
  limits: { captionMax: 2200, hashtagsMax: 30, mentionsMax: 20, carouselMin: 2, carouselMax: 10, altTextMax: 1000, imageMaxBytes: 8 * 1024 * 1024, scheduleMaxDays: 75 },
  notes: [],
};

const notInDemo = () => {
  throw new ApiError('Publishing needs a real Instagram account (API mode).', 409, 'publishing_unavailable');
};

/** Publish or schedule posts on connected Instagram accounts (instagram:publish). */
export const instagramPublishingService = {
  status: () => fromSource<PublishingStatus>(() => DEMO_STATUS, `${base}/publishing`),

  publications: (accountId?: string) =>
    fromSource<Publication[]>(() => [], `${base}/publications?${accountId ? `accountId=${encodeURIComponent(accountId)}&` : ''}limit=50`),

  publication: (id: string) => fromSource<Publication>(notInDemo, `${base}/publications/${encodeURIComponent(id)}`),

  create: (body: PublicationCreateInput) => mutateSource<Publication>(notInDemo, { method: 'post', path: `${base}/publications`, body }),

  cancel: (id: string) => mutateSource<Publication>(notInDemo, { method: 'post', path: `${base}/publications/${encodeURIComponent(id)}/cancel` }),

  /** Raw JPEG upload (api mode only). */
  uploadAsset: async (file: Blob): Promise<PublishAsset> => {
    if (config.dataSource !== 'api') return notInDemo();
    return apiClient.putBinary<PublishAsset>(`${base}/publish-assets`, file, 'image/jpeg');
  },

  limit: (accountId: string) => fromSource<PublishingLimit>(() => ({ quotaUsage: null, quotaTotal: null, quotaDuration: null }), `${base}/accounts/${encodeURIComponent(accountId)}/publishing-limit`),
};
