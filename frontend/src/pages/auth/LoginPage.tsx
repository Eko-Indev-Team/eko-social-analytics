import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Controls';
import { Notice } from '@/components/ui/Misc';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/i18n/I18nContext';
import { ApiError } from '@/lib/api/client';
import { allowedDomainsLabel, emailDomainAllowed } from '@/lib/emailDomain';
import { AuthLayout, safeNext } from '@/features/auth/AuthLayout';

export default function LoginPage() {
  const t = useT();
  useDocumentTitle(t('Sign in'));
  const { status, login, expiredReason: authExpiredReason } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const expired = params.get('reason') === 'expired';
  // English source text (msg-marked) or a server message; translated at render time.
  const expiredReason = (location.state as { expiredReason?: string } | null)?.expiredReason ?? authExpiredReason;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // An existing session goes straight back into the app. Demo mode has no accounts: the page is shown read-only.
  const demo = status === 'demo';
  if (status === 'authenticated') return <Navigate to={next} replace />;

  const domains = allowedDomainsLabel();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || demo) return;
    if (!email.trim() || !password) {
      setError(t('Enter your email and password.'));
      return;
    }
    if (!emailDomainAllowed(email)) {
      setError(t('Only {domains} email addresses can sign in.', { domains }));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      setPassword('');
      navigate(next, { replace: true });
    } catch (err) {
      setPassword('');
      if (err instanceof ApiError && err.status === 429) setError(t('Too many tries. Please wait a few minutes.'));
      else setError(err instanceof Error ? err.message : t('Sign-in failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={t('Sign in to SocialBoard')}
      subtitle={t('Use your {domains} work email.', { domains })}
      footer={
        <>
          {t('No account yet?')}{' '}
          <Link to="/signup" className="text-primary font-semibold hover:underline">
            {t('Sign up')}
          </Link>
        </>
      }
    >
      {demo && (
        <Notice tone="demo" title={t('Demo mode has no accounts')} className="mb-4">
          {t('Sign-in needs the SocialBoard server.')}{' '}
          <Link to="/dashboard" className="text-primary font-semibold hover:underline">
            {t('Continue to the demo')}
          </Link>
        </Notice>
      )}
      {expired && (
        <Notice tone="warning" title={t('Your session ended')} className="mb-4">
          {expiredReason ? t(expiredReason) : t('You were signed out to keep your account safe. Please sign in again.')}
        </Notice>
      )}
      {status === 'loading' ? (
        <p className="text-body-sm text-text-secondary" role="status">
          {t('Checking your session…')}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label={t('Work email')} htmlFor="login-email" required>
            <TextInput id="login-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting || demo} autoFocus />
          </Field>
          <Field label={t('Password')} htmlFor="login-password" required>
            <TextInput id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting || demo} />
          </Field>
          {error && (
            <p className="text-body-sm text-error font-medium" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="md" className="w-full" loading={submitting} disabled={demo}>
            {submitting ? t('Signing in…') : t('Sign in')}
          </Button>
          <p className="text-[0.6875rem] text-text-tertiary">{t('Forgot your password? Ask a workspace admin.')}</p>
        </form>
      )}
    </AuthLayout>
  );
}
