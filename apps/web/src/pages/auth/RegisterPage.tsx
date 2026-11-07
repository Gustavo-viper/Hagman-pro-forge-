import { signUpSchema } from '@fandom/schemas';
import { Alert, Button, Input } from '@fandom/ui';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { AuthLayout, FormField } from '@/components/AuthLayout';
import { useZodForm } from '@/hooks/useZodForm';
import { authConfigured } from '@/lib/env';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const { values, errors, set, handleSubmit } = useZodForm(signUpSchema, { email: '', password: '', confirmPassword: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (session) return <Navigate to="/dashboard" replace />;

  const onSubmit = handleSubmit(async (data) => {
    if (!supabase) return;
    setSubmitting(true);
    setError(null);
    const { data: res, error: err } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback`, data: { locale: i18n.language } },
    });
    setSubmitting(false);
    if (err) setError(err);
    // With "Confirm email" enabled (required in production) no session is returned.
    else if (!res.session) setSentTo(data.email);
  });

  if (sentTo) {
    return (
      <AuthLayout title={t('auth.register.checkEmailTitle')}>
        <Alert variant="success">
          <MailCheck className="mt-0.5 size-5 shrink-0" />
          <p>{t('auth.register.checkEmailBody', { email: sentTo })}</p>
        </Alert>
        <Button asChild variant="glass" className="mt-6 w-full">
          <Link to="/login">{t('auth.forgot.backToLogin')}</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}
      footer={
        <>
          {t('auth.register.hasAccount')}{' '}
          <Link to="/login" className="font-semibold text-mystic-300 hover:underline">{t('nav.signIn')}</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {error != null && <Alert variant="danger">{errorMessage(error, t)}</Alert>}
        <FormField id="email" label={t('auth.email')} error={errors.email}>
          <Input id="email" type="email" autoComplete="email" value={values.email} onChange={(e) => set('email', e.target.value)} aria-invalid={Boolean(errors.email)} />
        </FormField>
        <FormField id="password" label={t('auth.password')} error={errors.password} hint={t('auth.passwordHint')}>
          <Input id="password" type="password" autoComplete="new-password" value={values.password} onChange={(e) => set('password', e.target.value)} aria-invalid={Boolean(errors.password)} />
        </FormField>
        <FormField id="confirmPassword" label={t('auth.confirmPassword')} error={errors.confirmPassword}>
          <Input id="confirmPassword" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} aria-invalid={Boolean(errors.confirmPassword)} />
        </FormField>
        <Button type="submit" className="w-full" loading={submitting} disabled={!authConfigured}>
          {t('auth.register.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
