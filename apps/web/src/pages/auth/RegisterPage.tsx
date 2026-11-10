import { signUpSchema } from '@fandom/schemas';
import { Alert, Button, Input } from '@fandom/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { AuthLayout, FormField } from '@/components/AuthLayout';
import { VERIFICATION_LINK_HOURS } from '@/components/EmailVerificationGuide';
import { Gift, MailCheck } from 'lucide-react';
import { clearReferralCode, readReferralCode } from '@/lib/referral';
import { useZodForm } from '@/hooks/useZodForm';
import { errorMessage } from '@/lib/errors';

export default function RegisterPage() {
  const { t } = useTranslation();
  const { session, signUp } = useAuth();
  const navigate = useNavigate();
  const { values, errors, set, handleSubmit } = useZodForm(signUpSchema, { email: '', password: '', confirmPassword: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [referralCode] = useState(readReferralCode);

  if (session && !submitting) return <Navigate to="/dashboard" replace />;

  const onSubmit = handleSubmit(async (data) => {
    setSubmitting(true);
    setError(null);
    try {
      await signUp(data.email, data.password, referralCode);
      clearReferralCode();
      // Keep `submitting` on: the page stays mounted during the exit transition, and the
      // signed-in redirect above must not override the confirmation guide.
      void navigate('/confirm-email?welcome=1', { replace: true });
    } catch (err) {
      setError(err);
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
        {referralCode && (
          <p className="flex items-center gap-2 rounded-xl border border-gold-300/30 bg-gold-400/10 px-4 py-3 text-sm text-gold-100" data-testid="referral-banner">
            <Gift className="size-4 shrink-0" /> {t('referrals.invitedBy', { code: referralCode })}
          </p>
        )}
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
      <div className="mt-6 rounded-2xl border border-mystic-400/25 bg-mystic-500/10 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-mystic-100"><MailCheck className="size-4" /> {t('verify.registerHint.title')}</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-mist/70">
          <li>{t('verify.registerHint.one')}</li>
          <li>{t('verify.registerHint.two', { hours: VERIFICATION_LINK_HOURS })}</li>
          <li>{t('verify.registerHint.three')}</li>
        </ol>
      </div>
    </AuthLayout>
  );
}
