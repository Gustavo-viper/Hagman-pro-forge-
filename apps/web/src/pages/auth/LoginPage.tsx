import { signInSchema } from '@fandom/schemas';
import { Alert, Button, Input } from '@fandom/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { AuthLayout, FormField } from '@/components/AuthLayout';
import { useZodForm } from '@/hooks/useZodForm';
import { authConfigured } from '@/lib/env';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
  const { values, errors, set, handleSubmit } = useZodForm(signInSchema, { email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (session) return <Navigate to={from} replace />;

  const onSubmit = handleSubmit(async (data) => {
    if (!supabase) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword(data);
    setSubmitting(false);
    if (err) setError(err);
    else void navigate(from, { replace: true });
  });

  return (
    <AuthLayout
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.login.noAccount')}{' '}
          <Link to="/register" className="font-semibold text-mystic-300 hover:underline">{t('auth.login.createAccount')}</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {error != null && <Alert variant="danger">{errorMessage(error, t)}</Alert>}
        <FormField id="email" label={t('auth.email')} error={errors.email}>
          <Input id="email" type="email" autoComplete="email" value={values.email} onChange={(e) => set('email', e.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} />
        </FormField>
        <FormField id="password" label={t('auth.password')} error={errors.password}>
          <Input id="password" type="password" autoComplete="current-password" value={values.password} onChange={(e) => set('password', e.target.value)} aria-invalid={Boolean(errors.password)} />
        </FormField>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs text-mystic-300 hover:underline">{t('auth.login.forgot')}</Link>
        </div>
        <Button type="submit" className="w-full" loading={submitting} disabled={!authConfigured}>
          {t('auth.login.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
