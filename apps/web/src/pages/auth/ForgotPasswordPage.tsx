import { forgotPasswordSchema } from '@fandom/schemas';
import { Alert, Button, Input } from '@fandom/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AuthLayout, FormField } from '@/components/AuthLayout';
import { useZodForm } from '@/hooks/useZodForm';
import { errorMessage } from '@/lib/errors';
import { authRequest } from '@/lib/session';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { values, errors, set, handleSubmit } = useZodForm(forgotPasswordSchema, { email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = handleSubmit(async (data) => {
    setSubmitting(true);
    setError(null);
    try {
      // Same response whether or not the account exists (prevents account enumeration).
      await authRequest('password-reset', { email: data.email });
      setSent(true);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <AuthLayout
      title={t('auth.forgot.title')}
      subtitle={t('auth.forgot.subtitle')}
      footer={<Link to="/login" className="text-mystic-300 hover:underline">{t('auth.forgot.backToLogin')}</Link>}
    >
      {sent ? (
        <Alert variant="success">{t('auth.forgot.sent')}</Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error != null && <Alert variant="danger">{errorMessage(error, t)}</Alert>}
          <FormField id="email" label={t('auth.email')} error={errors.email}>
            <Input id="email" type="email" autoComplete="email" value={values.email} onChange={(e) => set('email', e.target.value)} aria-invalid={Boolean(errors.email)} />
          </FormField>
          <Button type="submit" className="w-full" loading={submitting}>
            {t('auth.forgot.submit')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
