import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Controls';
import { Notice } from '@/components/ui/Misc';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/i18n/I18nContext';
import { ApiError } from '@/lib/api/client';
import { allowedDomainsLabel, emailDomainAllowed } from '@/lib/emailDomain';
import { authService } from '@/services/auth';
import { AuthLayout } from '@/features/auth/AuthLayout';

const MIN_LENGTH = 12;

/** Self sign-up: the account waits as "pending" until a workspace owner or admin approves it (Settings → Team). */
export default function SignupPage() {
  const t = useT();
  useDocumentTitle(t('Sign up'));
  const { status } = useAuth();
  const demo = status === 'demo';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;

  const domains = allowedDomainsLabel();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || demo) return;
    if (!name.trim() || !email.trim() || !password) return setError(t('Fill in your name, work email and a password.'));
    if (!emailDomainAllowed(email)) return setError(t('Only {domains} email addresses can sign up.', { domains }));
    if (password.length < MIN_LENGTH) return setError(t('Use at least {count} characters for the password.', { count: MIN_LENGTH }));
    if (password !== confirm) return setError(t('The passwords do not match.'));
    setSubmitting(true);
    setError(null);
    try {
      const result = await authService.signup(name.trim(), email.trim(), password);
      setDone(result.message);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) setError(t('Too many tries. Please wait a few minutes.'));
      else setError(err instanceof Error ? err.message : t('Sign-up failed. Please try again.'));
    } finally {
      setPassword('');
      setConfirm('');
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={t('Create your account')}
      subtitle={t('Use your {domains} work email. An admin approves new accounts.', { domains })}
      footer={
        <>
          {t('Already have an account?')}{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            {t('Sign in')}
          </Link>
        </>
      }
    >
      {demo && (
        <Notice tone="demo" title={t('Demo mode has no accounts')} className="mb-4">
          {t('Sign-up needs the SocialBoard server.')}
        </Notice>
      )}
      {done ? (
        <Notice tone="info" title={t('Request sent')}>
          {done}
        </Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label={t('Full name')} htmlFor="signup-name" required>
            <TextInput id="signup-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} disabled={submitting || demo} autoFocus />
          </Field>
          <Field label={t('Work email')} htmlFor="signup-email" required>
            <TextInput id="signup-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting || demo} />
          </Field>
          <Field label={t('Password')} htmlFor="signup-password" required hint={t('At least {count} characters.', { count: MIN_LENGTH })}>
            <TextInput id="signup-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting || demo} />
          </Field>
          <Field label={t('Confirm password')} htmlFor="signup-confirm" required>
            <TextInput id="signup-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={submitting || demo} />
          </Field>
          {error && (
            <p className="text-body-sm text-error font-medium" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="md" className="w-full" loading={submitting} disabled={demo}>
            {submitting ? t('Sending request…') : t('Sign up')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
