import { Alert, Button, Spinner } from '@fandom/ui';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { AuthLayout } from '@/components/AuthLayout';
import { errorMessage } from '@/lib/errors';
import { authRequest, sessionStore } from '@/lib/session';

/** Reached from the verification email: /verify-email?token=… (works signed in or out). */
export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'pending' | 'done' | 'error'>(token ? 'pending' : 'error');
  const [error, setError] = useState<unknown>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true; // the token is single-use: never confirm twice (StrictMode)
    authRequest('email-verification/confirm', { token })
      .then(() => {
        sessionStore.updateUser({ emailVerified: true });
        void qc.invalidateQueries({ queryKey: ['me'] });
        setState('done');
      })
      .catch((err: unknown) => {
        setError(err);
        setState('error');
      });
  }, [token, qc]);

  return (
    <AuthLayout title={t('auth.verify.title')}>
      {state === 'pending' ? (
        <div className="flex flex-col items-center gap-3 py-6 text-sm text-mist/70" role="status">
          <Spinner className="size-8 text-arcane-300" />
          {t('auth.verify.verifying')}
        </div>
      ) : state === 'done' ? (
        <div className="space-y-5">
          <Alert variant="success">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            <p>{t('auth.verify.success')}</p>
          </Alert>
          <Button asChild className="w-full">
            <Link to={session ? '/dashboard' : '/login'}>{session ? t('nav.dashboard') : t('nav.signIn')}</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <Alert variant="danger">{error ? errorMessage(error, t) : t('errors.invalid_or_expired_token')}</Alert>
          <Button asChild variant="glass" className="w-full">
            <Link to={session ? '/dashboard' : '/login'}>{t('auth.verify.requestNew')}</Link>
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}
