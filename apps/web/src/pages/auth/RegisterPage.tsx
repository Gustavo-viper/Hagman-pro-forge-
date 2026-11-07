import { signUpSchema } from '@fandom/schemas';
import { Alert, Button, Input } from '@fandom/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { AuthLayout, FormField } from '@/components/AuthLayout';
import { useZodForm } from '@/hooks/useZodForm';
import { errorMessage } from '@/lib/errors';

export default function RegisterPage() {
  const { t } = useTranslation();
  const { session, signUp } = useAuth();
  const navigate = useNavigate();
  const { values, errors, set, handleSubmit } = useZodForm(signUpSchema, { email: '', password: '', confirmPassword: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (session) return <Navigate to="/dashboard" replace />;

  const onSubmit = handleSubmit(async (data) => {
    setSubmitting(true);
    setError(null);
    try {
      await signUp(data.email, data.password);
      void navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  });


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
        <Button type="submit" className="w-full" loading={submitting}>
          {t('auth.register.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
