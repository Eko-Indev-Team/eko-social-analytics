import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountsOverview } from '@/features/accounts/AccountsOverview';
import { ConnectFlowModal } from '@/features/accounts/connect/ConnectFlowModal';
import { LiveConnectModal } from '@/features/instagram/LiveConnectModal';
import { isDemoMode } from '@/lib/config';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/i18n/I18nContext';

/**
 * Connect Instagram Account flow (design-reference: eko_socialboard_connect_instagram_account_flow).
 * As in the export, the accounts overview renders blurred and inert underneath the modal flow.
 */
export default function ConnectAccountPage() {
  useDocumentTitle(useT()('Connect Instagram account'));
  const navigate = useNavigate();
  const backgroundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // React 18 typings lack `inert`; set it imperatively so the background can't be focused.
    backgroundRef.current?.setAttribute('inert', '');
  }, []);

  return (
    <>
      <div ref={backgroundRef} aria-hidden className="blur-[2px] opacity-40 pointer-events-none select-none">
        <AccountsOverview background />
      </div>
      {/* demo mode: the labelled walkthrough; api mode: the real Instagram Login flow. */}
      {isDemoMode ? <ConnectFlowModal onClose={() => navigate('/accounts')} /> : <LiveConnectModal onClose={() => navigate('/accounts')} />}
    </>
  );
}
