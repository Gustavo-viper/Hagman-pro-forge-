import { yearlySavingsPercent, monthlyEquivalent, type BillingInterval } from '@fandom/shared';
import type { SubscriptionPlanSummary } from '@fandom/types';
import { Badge, Button, cn } from '@fandom/ui';
import { motion } from 'framer-motion';
import { Check, Crown, Sparkles, Star } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { localized, money } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';

const ICONS = { free: Star, plus: Sparkles, ultra: Crown } as const;

/**
 * Plan comparison from live API data. Paid checkout is introduced in stage 10 together with
 * the payment provider; until then paid plans show an explicit "coming soon" state instead
 * of a button that would do nothing.
 */
export function PlanCards({ plans }: { plans: SubscriptionPlanSummary[] }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const locale = currentLocale();
  const [interval, setInterval] = useState<BillingInterval>('month');

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
      <div className="grid gap-6 lg:grid-cols-3">
        {plans.map((plan, i) => {
          const Icon = ICONS[plan.code];
          const price = plan.prices.find((p) => p.interval === (plan.code === 'free' ? 'month' : interval));
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
                plan.code === 'ultra' && 'border-gold-300/30 bg-[linear-gradient(160deg,rgb(232_182_76/0.12),rgb(255_255_255/0.02))]',
              )}
            >
              {highlighted && (
                <Badge variant="arcane" className="absolute -top-3 left-7">
                  {t('landing.plans.popular')}
                </Badge>
              )}
              <div className="flex items-center gap-3">
                <span className={cn('grid size-10 place-items-center rounded-xl', plan.code === 'ultra' ? 'bg-gold-400/15 text-gold-300' : 'bg-arcane-500/15 text-arcane-200')}>
                  <Icon className="size-5" />
                </span>
                <h3 className="font-display text-xl font-bold tracking-wide">{localized(plan.name, locale)}</h3>
              </div>
              <p className="mt-3 min-h-10 text-sm text-mist/60">{localized(plan.description, locale)}</p>
              <div className="mt-6">
                {price ? (
                  <>
                    <p className="flex items-baseline gap-1">
                      <span className="font-display text-4xl font-bold">{money(price.amountMinor, price.currency, locale)}</span>
                      {plan.code !== 'free' && (
                        <span className="text-sm text-mist/55">{interval === 'month' ? t('landing.plans.perMonth') : t('landing.plans.perYear')}</span>
                      )}
                    </p>
                    {plan.code !== 'free' && interval === 'year' && monthly && (
                      <p className="mt-1 text-xs text-gold-200">
                        {t('landing.plans.equivalent', { price: money(monthlyEquivalent(price.amountMinor), price.currency, locale) })} ·{' '}
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
                    <Check className={cn('mt-0.5 size-4 shrink-0', plan.code === 'ultra' ? 'text-gold-300' : 'text-mystic-300')} />
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                {plan.code === 'free' ? (
                  <Button asChild variant={highlighted ? 'primary' : 'glass'} className="w-full">
                    <Link to={session ? '/dashboard' : '/register'}>{t('landing.plans.startFree')}</Link>
                  </Button>
                ) : (
                  <p className="rounded-xl border border-dashed border-white/15 py-3 text-center text-sm text-mist/60" aria-live="polite">
                    {t('landing.plans.soon')}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
