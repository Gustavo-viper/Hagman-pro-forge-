import { Button, Skeleton } from '@fandom/ui';
import { ArrowRight, PartyPopper } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { EmailVerificationGuide } from '@/components/EmailVerificationGuide';
import { ErrorState } from '@/components/states';
import { useMe } from '@/hooks/data';

/** Shown right after sign-up (and from the dashboard banner): how to confirm the email. */
export default function ConfirmEmailPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const welcome = params.get('welcome') === '1';
  const me = useMe();
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      {welcome && (
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-gold-300"><PartyPopper className="size-4" /> {t('verify.welcome')}</p>
      )}
      <h1 className="font-display text-3xl font-bold tracking-wide">{t('verify.pageTitle')}</h1>
      <p className="mt-2 text-mist/65">{t('verify.why')}</p>
      <div className="mt-8">
        {me.isPending ? <Skeleton className="h-80" /> : me.isError ? <ErrorState error={me.error} /> : (
          <EmailVerificationGuide email={me.data.profile.email} />
        )}
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button asChild><Link to="/dashboard">{welcome ? t('verify.continueProfile') : t('verify.backToDashboard')} <ArrowRight /></Link></Button>
        <p className="text-sm text-mist/55">{t('verify.canContinue')}</p>
      </div>
    </div>
  );
}
