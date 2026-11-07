import { Alert, Button, Spinner } from '@fandom/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { AuthLayout } from '@/components/AuthLayout';

/**
 * Landing point for email confirmation links. supabase-js (detectSessionInUrl + PKCE)
 * exchanges the code automatically; we wait for the session or surface the error.
 */
export default function AuthCallbackPage() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(
    () => new URLSearchParams(window.location.search).has('error') || window.location.hash.includes('error='),
  );

  useEffect(() => {
    if (session) void navigate('/dashboard', { replace: true });
  }, [session, navigate]);

  useEffect(() => {
    if (loading || session) return;
    const timer = setTimeout(() => setFailed(true), 6000);
    return () => clearTimeout(timer);
  }, [loading, session]);

  return (
    <AuthLayout title={failed ? t('auth.callback.failed') : t('auth.callback.verifying')}>
      {failed ? (
        <div className="space-y-4">
          <Alert variant="danger">{t('auth.callback.failed')}</Alert>
          <Button asChild variant="glass" className="w-full">
            <Link to="/login">{t('auth.forgot.backToLogin')}</Link>
          </Button>
        </div>
      ) : (
        <div className="flex justify-center py-6" role="status">
          <Spinner className="size-8 text-arcane-300" />
        </div>
      )}
    </AuthLayout>
  );
}
