import { resetPasswordSchema } from '@fandom/schemas';
import { Alert, Button, Input } from '@fandom/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { AuthLayout, FormField } from '@/components/AuthLayout';
import { FullPageLoader } from '@/components/states';
import { useZodForm } from '@/hooks/useZodForm';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

/** Reached from the Supabase recovery email; the PKCE code in the URL yields a recovery session. */
export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const { values, errors, set, handleSubmit } = useZodForm(resetPasswordSchema, { password: '', confirmPassword: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);

  if (loading) return <FullPageLoader />;

  const onSubmit = handleSubmit(async (data) => {
    if (!supabase) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password: data.password });
    setSubmitting(false);
    if (err) setError(err);
    else {
      setDone(true);
      setTimeout(() => void navigate('/dashboard', { replace: true }), 1500);
    }
  });

  return (
    <AuthLayout title={t('auth.reset.title')} subtitle={t('auth.reset.subtitle')}>
      {!session ? (
        <div className="space-y-4">
          <Alert variant="danger">{t('auth.reset.invalidLink')}</Alert>
          <Button asChild variant="glass" className="w-full">
            <Link to="/forgot-password">{t('auth.forgot.submit')}</Link>
          </Button>
        </div>
      ) : done ? (
        <Alert variant="success">{t('auth.reset.success')}</Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error != null && <Alert variant="danger">{errorMessage(error, t)}</Alert>}
          <FormField id="password" label={t('auth.password')} error={errors.password} hint={t('auth.passwordHint')}>
            <Input id="password" type="password" autoComplete="new-password" value={values.password} onChange={(e) => set('password', e.target.value)} aria-invalid={Boolean(errors.password)} />
          </FormField>
          <FormField id="confirmPassword" label={t('auth.confirmPassword')} error={errors.confirmPassword}>
            <Input id="confirmPassword" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} aria-invalid={Boolean(errors.confirmPassword)} />
          </FormField>
          <Button type="submit" className="w-full" loading={submitting}>
            {t('auth.reset.submit')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
