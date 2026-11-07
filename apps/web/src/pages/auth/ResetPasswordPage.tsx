import { resetPasswordSchema } from '@fandom/schemas';
import { Alert, Button, Input } from '@fandom/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AuthLayout, FormField } from '@/components/AuthLayout';
import { useZodForm } from '@/hooks/useZodForm';
import { errorMessage } from '@/lib/errors';
import { authRequest, sessionStore } from '@/lib/session';

/** Reached from the password-reset email: /reset-password?token=… */
export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { values, errors, set, handleSubmit } = useZodForm(resetPasswordSchema, { password: '', confirmPassword: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);

  const onSubmit = handleSubmit(async (data) => {
    setSubmitting(true);
    setError(null);
    try {
      await authRequest('password-reset/confirm', { token, password: data.password });
      // Every session was revoked by the server, including this browser's.
      sessionStore.clear();
      setDone(true);
      setTimeout(() => void navigate('/login', { replace: true }), 1800);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <AuthLayout title={t('auth.reset.title')} subtitle={t('auth.reset.subtitle')}>
      {!token ? (
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
          {error != null && (
            <Alert variant="danger">
              <div className="space-y-2">
                <p>{errorMessage(error, t)}</p>
                <Link to="/forgot-password" className="text-xs underline">{t('auth.forgot.submit')}</Link>
              </div>
            </Alert>
          )}
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
