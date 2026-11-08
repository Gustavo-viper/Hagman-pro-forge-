import { Alert } from '@fandom/ui';
import { motion } from 'framer-motion';
import { CalendarClock, CreditCard, Crown, RotateCcw, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { SectionHeading } from '@/components/Layout';
import { PlanCards } from '@/components/PlanCards';
import { PremiumComparison } from '@/components/PremiumComparison';
import { CardGridSkeleton, ErrorState } from '@/components/states';
import { useBillingConfig, usePlans, useSubscriptionDetails } from '@/hooks/data';

const FAQ = [
  { key: 'payment', icon: CreditCard },
  { key: 'renewal', icon: CalendarClock },
  { key: 'cancel', icon: RotateCcw },
  { key: 'fair', icon: ShieldCheck },
] as const;

export default function PremiumPage() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const plans = usePlans('BRL');
  const config = useBillingConfig();
  const details = useSubscriptionDetails();
  const hasPlan = details.data && details.data.subscription.planCode !== 'free';

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mb-6 flex justify-center">
        <span className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-gold-400/30 to-arcane-500/30 text-gold-200 ring-1 ring-gold-300/40">
          <Crown className="size-8" />
        </span>
      </motion.div>
      <SectionHeading eyebrow={t('landing.plans.eyebrow')} title={t('premium.title')} subtitle={t('premium.subtitle')} />

      {session && hasPlan && (
        <Alert variant="success" className="mx-auto mt-8 max-w-2xl justify-center">
          <span>
            {t('premium.youHave', { plan: t(`dashboard.planNames.${details.data!.subscription.planCode}`) })}{' '}
            <Link to="/account/subscription" className="font-semibold underline">{t('premium.manage')}</Link>
          </span>
        </Alert>
      )}

      <div className="mt-12">
        {plans.isPending ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <CardGridSkeleton key={i} count={1} className="h-[520px]" />)}
          </div>
        ) : plans.isError ? (
          <ErrorState error={plans.error} title={t('landing.plans.error')} onRetry={() => void plans.refetch()} />
        ) : (
          <PlanCards plans={plans.data} />
        )}
      </div>

      {config.data?.enabled && <p className="mt-6 text-center text-xs text-mist/50">{t('premium.secureNote')}</p>}

      <PremiumComparison />

      <section className="mx-auto mt-20 max-w-4xl">
        <h2 className="text-center font-display text-2xl font-bold tracking-wide">{t('premium.faqTitle')}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {FAQ.map(({ key, icon: Icon }) => (
            <div key={key} className="glass rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-arcane-500/20 text-arcane-200"><Icon className="size-4" /></span>
                <h3 className="font-semibold">{t(`premium.faq.${key}.q`)}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-mist/65">{t(`premium.faq.${key}.a`)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
