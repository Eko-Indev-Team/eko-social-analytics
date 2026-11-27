/** Instagram publishing (/integrations/instagram/publishing, /publications, /publish-assets). Mirrors backend/app/schemas (camelCase). */

export type PublicationKind = 'image' | 'carousel' | 'reel' | 'story';
export type PublicationItemType = 'image' | 'video';
export type PublicationStatus = 'scheduled' | 'queued' | 'publishing' | 'published' | 'failed' | 'cancelled';

export interface PublishingAccount {
  id: string;
  username: string;
  profilePictureUrl: string | null;
  canPublish: boolean;
  reason: string | null;
}

export interface PublishingLimits {
  captionMax: number;
  hashtagsMax: number;
  mentionsMax: number;
  carouselMin: number;
  carouselMax: number;
  altTextMax: number;
  imageMaxBytes: number;
  scheduleMaxDays: number;
}

export interface PublishingStatus {
  enabled: boolean;
  canPublish: boolean;
  uploadsAvailable: boolean;
  accounts: PublishingAccount[];
  limits: PublishingLimits;
  notes: string[];
}

export interface PublicationItem {
  type: PublicationItemType;
  url: string | null;
  assetId: string | null;
  previewUrl: string | null;
}

export interface Publication {
  id: string;
  accountId: string;
  accountUsername: string | null;
  kind: PublicationKind;
  caption: string | null;
  items: PublicationItem[];
  shareToFeed: boolean | null;
  altText: string | null;
  coverUrl: string | null;
  status: PublicationStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  igMediaId: string | null;
  permalink: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  createdByName: string | null;
  canCancel: boolean;
}

export interface PublicationItemInput {
  type: PublicationItemType;
  url?: string;
  assetId?: string;
}

export interface PublicationCreateInput {
  accountId: string;
  kind: PublicationKind;
  caption?: string | null;
  items: PublicationItemInput[];
  scheduledAt?: string | null;
  shareToFeed?: boolean;
  altText?: string | null;
  coverUrl?: string | null;
}

export interface PublishAsset {
  id: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  previewUrl: string;
}

export interface PublishingLimit {
  quotaUsage: number | null;
  quotaTotal: number | null;
  quotaDuration: number | null;
}
