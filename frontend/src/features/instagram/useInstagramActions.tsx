import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/features/settings/settingsUi';
import { useMutation } from '@/hooks/useMutation';
import { useT, type Translate } from '@/i18n/I18nContext';
import { ApiError } from '@/lib/api/client';
import { instagramService } from '@/services/instagram';
import type { InstagramConnection } from '@/types/instagram';

/** Every query that shows live Instagram data (accounts, media, insights, dashboard card). */
export const INSTAGRAM_QUERY_KEYS = ['instagram', 'dashboard'];

function describeError(err: Error, t: Translate): { title: string; description: string } {
  if (err instanceof ApiError) {
    if (err.status === 429) return { title: t('Please wait'), description: err.message || t('Too many tries. Try again soon.') };
    if (err.status === 403) return { title: t('Not allowed'), description: err.message };
    if (err.status === 409) return { title: t('Not possible right now'), description: err.message };
    if (err.status === 503) return { title: t('Instagram is not set up'), description: err.message };
  }
  return { title: t('Instagram request failed'), description: err.message };
}

/** Connect (redirects to Instagram) and Disconnect (with confirmation). Syncing: see ``useSyncState``. */
export function useInstagramActions(opts: { onDisconnected?: () => void } = {}) {
  const t = useT();
  const toast = useToast();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<InstagramConnection | null>(null);

  const connect = async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      const { authorizationUrl } = await instagramService.connect();
      const url = new URL(authorizationUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'www.instagram.com') throw new Error('Unexpected authorization URL.');
      window.location.assign(url.toString()); // official Instagram authorization window
    } catch (err) {
      setConnecting(false);
      toast({ tone: 'error', ...describeError(err instanceof Error ? err : new Error(String(err)), t) });
    }
  };

  const disconnect = useMutation(instagramService.disconnect, {
    invalidate: INSTAGRAM_QUERY_KEYS,
    onSuccess: (c) => {
      setDisconnecting(null);
      toast({ title: t('@{handle} disconnected', { handle: c.username }), description: t('Its login and fetched data were deleted from SocialBoard.') });
      opts.onDisconnected?.();
    },
    onError: (err) => toast({ tone: 'error', ...describeError(err, t) }),
  });

  const overlays = (
    <ConfirmModal
      open={!!disconnecting}
      onClose={() => setDisconnecting(null)}
      onConfirm={() => disconnecting && void disconnect.mutate(disconnecting.id)}
      loading={disconnect.isPending}
      title={t('Disconnect @{handle}?', { handle: disconnecting?.username ?? '' })}
      confirmLabel={t('Disconnect account')}
      icon="link_off"
    >
      <p>{t('SocialBoard will delete the encrypted access token and all posts, numbers and comments it fetched for this account.')}</p>
      <p>{t('Campaigns and leads are not affected. To remove access on Instagram too, go to Settings → Apps and websites.')}</p>
    </ConfirmModal>
  );

  return { connect, connecting, requestDisconnect: setDisconnecting, overlays };
}
