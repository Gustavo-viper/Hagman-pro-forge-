import { applyDiscount, monthlyEquivalent, yearlySavingsPercent, type BillingInterval, type PlanCode } from '@fandom/shared';
import type { SubscriptionPlanSummary } from '@fandom/types';
import { Badge, Button, cn } from '@fandom/ui';
import { motion } from 'framer-motion';
import { Check, Crown, Gem, Sparkles, Star } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { useBillingConfig, useReferrals, useSubscriptionDetails } from '@/hooks/data';
import { useCheckout } from '@/hooks/useCheckout';
import { errorMessage } from '@/lib/errors';
import { localized, money } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';

const ICONS = { free: Star, plus: Sparkles, ultra: Crown, vip: Gem } as const;

/** Gold for Ultra, emerald for VIP, arcane for the rest. */
const accent = (code: PlanCode) => (code === 'vip' ? 'vip' : code === 'ultra' ? 'gold' : 'arcane');

/** Paid-plan call to action, driven by the server's billing config and subscription state. */
function PaidPlanAction({ plan, interval, highlighted }: { plan: Exclude<PlanCode, 'free'>; interval: BillingInterval; highlighted: boolean }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const config = useBillingConfig();
  const details = useSubscriptionDetails();
  const checkout = useCheckout();

  if (config.isPending) return <div className="h-11" />;
  if (!config.data?.enabled) {
    return (
      <p className="rounded-xl border border-dashed border-white/15 py-3 text-center text-sm text-mist/60" aria-live="polite">
        {t('landing.plans.soon')}
      </p>
    );
  }
  if (!session) {
    return (
      <Button asChild variant={highlighted ? 'primary' : plan === 'ultra' || plan === 'vip' ? 'gold' : 'glass'} className="w-full">
        <Link to="/login" state={{ from: '/premium' }}>{t('premium.subscribe')}</Link>
      </Button>
    );
  }
  const current = details.data?.renewablePlan ?? null;
  const blocked = current !== null && current !== plan;
  const label = current === plan ? t('premium.renew') : t('premium.subscribe');
  const pending = checkout.isPending || checkout.isSuccess; // isSuccess: redirecting to the payment page
  return (
    <div className="space-y-2">
      <Button
        variant={highlighted ? 'primary' : plan === 'ultra' || plan === 'vip' ? 'gold' : 'glass'}
        className="w-full"
        disabled={blocked || details.isPending}
        loading={pending}
        onClick={() => checkout.mutate({ planCode: plan, interval })}
      >
        {pending ? t('premium.redirecting') : label}
      </Button>
      {blocked && <p className="text-center text-xs text-mist/55">{t('premium.changeAtPeriodEnd')}</p>}
      {checkout.isError && (
        <p role="alert" className="text-center text-xs text-red-300">
          {errorMessage(checkout.error, t)}{' '}
          {checkout.error && 'code' in checkout.error && checkout.error.code === 'email_not_verified' && (
            <Link to="/dashboard" className="underline">{t('nav.dashboard')}</Link>
          )}
        </p>
      )}
    </div>
  );
}

export function PlanCards({ plans }: { plans: SubscriptionPlanSummary[] }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const locale = currentLocale();
  const [interval, setInterval] = useState<BillingInterval>('month');
  const referrals = useReferrals();
  const discount = session ? (referrals.data?.discountPercent ?? 0) : 0;

  return (
    <div>
      <div className="mb-10 flex justify-center">
        <div role="radiogroup" aria-label={t('landing.plans.eyebrow')} className="glass inline-flex rounded-xl p-1">
          {(['month', 'year'] as const).map((iv) => (
            <button
              key={iv}
              role="radio"
              aria-checked={interval === iv}
              onClick={() => setInterval(iv)}
              className={cn(
                'rounded-lg px-5 py-2 text-sm font-semibold transition',
                interval === iv ? 'bg-arcane-500 text-white shadow-lg shadow-arcane-500/30' : 'text-mist/70 hover:text-mist',
              )}
            >
              {iv === 'month' ? t('landing.plans.monthly') : t('landing.plans.yearly')}
            </button>
          ))}
        </div>
      </div>
      {!session || discount === 0 ? (
        <p className="mx-auto -mt-4 mb-8 max-w-xl text-center text-sm text-mist/65">
          <Link to={session ? '/dashboard#convites' : '/register'} className="font-semibold text-gold-200 hover:underline">{t('referrals.plansHint')}</Link>
        </p>
      ) : null}
      <div className={cn('grid gap-6 lg:grid-cols-3', plans.length > 3 && 'md:grid-cols-2 xl:grid-cols-4')}>
        {plans.map((plan, i) => {
          const Icon = ICONS[plan.code];
          // Plans without a yearly price (VIP) always show and sell the monthly one.
          const effectiveInterval: BillingInterval = plan.code === 'free' || !plan.prices.some((p) => p.interval === interval) ? 'month' : interval;
          const monthlyOnly = plan.code !== 'free' && interval === 'year' && effectiveInterval === 'month';
          const price = plan.prices.find((p) => p.interval === effectiveInterval);
          const monthly = plan.prices.find((p) => p.interval === 'month');
          const highlighted = plan.code === 'plus';
          return (
            <motion.div
              key={plan.code}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.08 }}
              className={cn(
                'glass relative flex flex-col rounded-3xl p-7',
                highlighted && 'glow-ring',
                accent(plan.code) === 'gold' && 'border-gold-300/30 bg-[linear-gradient(160deg,rgb(232_182_76/0.12),rgb(255_255_255/0.02))]',
                accent(plan.code) === 'vip' && 'border-emerald-300/30 bg-[linear-gradient(160deg,rgb(16_185_129/0.14),rgb(255_255_255/0.02))]',
              )}
            >
              {highlighted && (
                <Badge variant="arcane" className="absolute -top-3 left-7">
                  {t('landing.plans.popular')}
                </Badge>
              )}
              <div className="flex items-center gap-3">
                <span className={cn('grid size-10 place-items-center rounded-xl', { gold: 'bg-gold-400/15 text-gold-300', vip: 'bg-emerald-400/15 text-emerald-200', arcane: 'bg-arcane-500/15 text-arcane-200' }[accent(plan.code)])}>
                  <Icon className="size-5" />
                </span>
                <h3 className="font-display text-xl font-bold tracking-wide">{localized(plan.name, locale)}</h3>
              </div>
              <p className="mt-3 min-h-10 text-sm text-mist/60">{localized(plan.description, locale)}</p>
              <div className="mt-6">
                {price ? (
                  <>
                    {discount > 0 && plan.code !== 'free' && (
                      <p className="mb-1 flex items-center gap-2 text-sm">
                        <span className="text-mist/50 line-through">{money(price.amountMinor, price.currency, locale)}</span>
                        <Badge variant="gold">{t('referrals.planDiscount', { percent: discount })}</Badge>
                      </p>
                    )}
                    <p className="flex items-baseline gap-1">
                      <span className="font-display text-4xl font-bold">{money(plan.code === 'free' ? price.amountMinor : applyDiscount(price.amountMinor, discount), price.currency, locale)}</span>
                      {plan.code !== 'free' && (
                        <span className="text-sm text-mist/55">{effectiveInterval === 'month' ? t('landing.plans.perMonth') : t('landing.plans.perYear')}</span>
                      )}
                    </p>
                    {monthlyOnly && <p className="mt-1 text-xs text-mist/55">{t('landing.plans.monthlyOnly')}</p>}
                    {plan.code !== 'free' && effectiveInterval === 'year' && monthly && (
                      <p className="mt-1 text-xs text-gold-200">
                        {t('landing.plans.equivalent', { price: money(monthlyEquivalent(applyDiscount(price.amountMinor, discount)), price.currency, locale) })} ·{' '}
                        {t('landing.plans.save', { percent: yearlySavingsPercent(monthly.amountMinor, price.amountMinor) })}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-mist/55">{t('landing.plans.noPrice')}</p>
                )}
              </div>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {(plan.benefits[locale] ?? plan.benefits['pt-BR'] ?? []).map((b) => (
                  <li key={b} className="flex gap-2.5 text-mist/80">
                    <Check className={cn('mt-0.5 size-4 shrink-0', { gold: 'text-gold-300', vip: 'text-emerald-300', arcane: 'text-mystic-300' }[accent(plan.code)])} />
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                {plan.code === 'free' ? (
                  <Button asChild variant="glass" className="w-full">
                    <Link to={session ? '/dashboard' : '/register'}>{t('landing.plans.startFree')}</Link>
                  </Button>
                ) : (
                  <PaidPlanAction plan={plan.code} interval={effectiveInterval} highlighted={highlighted} />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
