import { AccountsOverview } from '@/features/accounts/AccountsOverview';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/i18n/I18nContext';

/** Instagram Accounts Overview (design-reference: eko_socialboard_instagram_accounts_overview). */
export default function AccountsPage() {
  useDocumentTitle(useT()('Instagram accounts'));
  return <AccountsOverview />;
}
