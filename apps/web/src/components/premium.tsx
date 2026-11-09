import { premiumBonus, PREMIUM_PERKS, PREMIUM_TRIAL, type PlanCode } from '@fandom/shared';
import type { PlanBadge as PlanBadgeValue, SubscriptionDetails, TrialStatus } from '@fandom/types';
import { Alert, Badge, Button, cn } from '@fandom/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, Gem, Gift, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { useMe } from '@/hooks/data';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';

/** Plan the signed-in user is entitled to right now ('free' when signed out). */
export function useMyPlan(): PlanCode {
  const { session } = useAuth();
  const me = useMe();
  return session ? (me.data?.subscription.planCode ?? 'free') : 'free';
}

/** Free-trial eligibility of the signed-in user (never offered to signed-out visitors here). */
export function useTrialStatus() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['me', 'trial'],
    queryFn: ({ signal }) => api<TrialStatus>('/v1/billing/trial', { signal }),
    enabled: Boolean(session),
    staleTime: 60_000,
  });
}

/**
 * Free Fandom Plus trial offer: a start button for eligible users, a sign-up invite for
 * visitors, nothing for everyone else. No card, no automatic charge.
 */
export function TrialOffer({ className }: { className?: string }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const { session } = useAuth();
  const qc = useQueryClient();
  const trial = useTrialStatus();
  const start = useMutation({
    mutationFn: () => api<SubscriptionDetails>('/v1/billing/trial', { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['me'] }),
  });
  if (start.isSuccess) {
    return (
      <Alert variant="success" className={className}>
        <Gift className="size-5 shrink-0" />
        <span>{t('trial.started', { date: start.data.subscription.currentPeriodEnd ? formatDate(start.data.subscription.currentPeriodEnd, locale) : '' })}</span>
      </Alert>
    );
  }
  if (session && !trial.data?.eligible) return null;
  return (
    <div className={cn('flex flex-col gap-4 rounded-2xl border border-gold-300/40 bg-[linear-gradient(120deg,rgb(232_182_76/0.16),rgb(124_58_237/0.12))] p-5 sm:flex-row sm:items-center', className)}>
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gold-400/20 text-gold-200"><Gift className="size-6" /></span>
      <div className="flex-1">
        <p className="font-display text-lg font-bold text-gold-100">{t('trial.title', { days: PREMIUM_TRIAL.days })}</p>
        <p className="mt-1 text-sm text-mist/70">{t('trial.info')}</p>
        {start.isError && <p role="alert" className="mt-2 text-sm text-red-300">{errorMessage(start.error, t)}</p>}
      </div>
      {session ? (
        <Button variant="gold" loading={start.isPending} onClick={() => start.mutate()}>{t('trial.start')}</Button>
      ) : (
        <Button asChild variant="gold"><Link to="/register">{t('trial.signUp')}</Link></Button>
      )}
    </div>
  );
}

/** Small subscriber badge shown next to names. */
export function PlanBadge({ plan, className }: { plan: PlanBadgeValue | undefined; className?: string }) {
  const { t } = useTranslation();
  if (!plan) return null;
  return (
    <span
      title={t(`dashboard.planNames.${plan}`)}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-px align-middle text-[10px] font-bold uppercase tracking-wider',
        plan === 'vip' ? 'bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-300/50' : plan === 'ultra' ? 'bg-gold-400/20 text-gold-200 ring-1 ring-gold-300/40' : 'bg-arcane-500/25 text-arcane-100 ring-1 ring-arcane-400/40',
        className,
      )}
    >
      {plan === 'ultra' && <Crown className="size-2.5" />}
      {plan === 'vip' && <Gem className="size-2.5" />}
      {plan}
    </span>
  );
}

/** Display name; Ultra subscribers get a golden, highlighted name. */
export function PlanName({ name, plan, className }: { name: string; plan: PlanBadgeValue | undefined; className?: string }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <span className={cn('truncate', plan === 'ultra' && 'bg-gradient-to-r from-gold-200 via-gold-300 to-gold-200 bg-clip-text font-semibold text-transparent', plan === 'vip' && 'bg-gradient-to-r from-emerald-200 via-gold-200 to-emerald-200 bg-clip-text font-semibold text-transparent')}>{name}</span>
      <PlanBadge plan={plan} />
    </span>
  );
}

/**
 * XP earned in a game or quiz: base + subscriber bonus. Free players see how much more the
 * Plus plan would have given them for the same result.
 */
export function XpReward({ xp, bonus, className }: { xp: number; bonus: number; className?: string }) {
  const { t } = useTranslation();
  const plan = useMyPlan();
  if (xp <= 0 && bonus <= 0) return null;
  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="flex flex-wrap justify-center gap-2">
        <Badge variant="gold" className="px-3 py-1.5 text-sm"><Sparkles className="size-4" /> +{xp} XP</Badge>
        {bonus > 0 && (
          <Badge variant="arcane" className="px-3 py-1.5 text-sm">
            <Crown className="size-4" /> {t('premiumPerks.bonusBadge', { xp: bonus, plan: t(`dashboard.planNames.${plan}`) })}
          </Badge>
        )}
      </div>
      {plan === 'free' && xp > 0 && (
        <p className="text-xs text-mist/60">
          {t('premiumPerks.wouldEarn', { xp: premiumBonus(xp, 'plus'), percent: PREMIUM_PERKS.xpBonusPercent.plus })}{' '}
          <Link to="/premium" className="font-semibold text-gold-200 underline">{t('premiumPerks.seePlans')}</Link>
        </p>
      )}
    </div>
  );
}

/** Locked premium content: explains what the plan unlocks and links to the plans page. */
export function PremiumLock({ plan, title, children, compact }: { plan: Exclude<PlanCode, 'free'>; title: string; children?: ReactNode; compact?: boolean }) {
  const { t } = useTranslation();
  const trial = useTrialStatus();
  const tryFree = plan === PREMIUM_TRIAL.plan && trial.data?.eligible;
  return (
    <div className={cn('rounded-2xl border border-gold-300/30 bg-[linear-gradient(160deg,rgb(232_182_76/0.12),rgb(255_255_255/0.02))]', compact ? 'p-4' : 'p-6 text-center')}>
      <p className={cn('flex items-center gap-2 font-semibold text-gold-100', !compact && 'justify-center font-display text-lg')}>
        <Crown className="size-4 shrink-0 text-gold-300" /> {title}
      </p>
      {children && <div className="mt-2 text-sm text-mist/70">{children}</div>}
      <Button asChild size="sm" variant="gold" className="mt-4">
        <Link to="/premium">{tryFree ? t('trial.tryFree', { days: PREMIUM_TRIAL.days }) : t('premiumPerks.unlockWith', { plan: t(`dashboard.planNames.${plan}`) })}</Link>
      </Button>
    </div>
  );
}
