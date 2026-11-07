import type { DashboardResponse } from '@fandom/types';
import { Alert, Badge, Button, Card, Progress, Skeleton } from '@fandom/ui';
import { motion } from 'framer-motion';
import { Crown, MailWarning, ShieldCheck, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { EmptyState, ErrorState } from '@/components/states';
import { UniverseCard } from '@/components/UniverseCard';
import { useDashboard } from '@/hooks/data';
import { useMembershipMutations } from '@/hooks/useMembership';
import { errorMessage } from '@/lib/errors';
import { formatDate, formatNumber } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';
import { OnboardingForm } from './OnboardingForm';

function LevelOrb({ level, progress }: { level: number; progress: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="orb" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#9a6bff" />
            <stop offset="0.6" stopColor="#38b2f8" />
            <stop offset="1" stopColor="#f2cb6b" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="8" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="url(#orb)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - progress) }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-4xl font-bold">{level}</p>
          <p className="text-[10px] uppercase tracking-[0.3em] text-mist/50">LVL</p>
        </div>
      </div>
    </div>
  );
}

function Overview({ data }: { data: DashboardResponse }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const { profile, xp, subscription } = data;
  const isStaff = profile.roles.length > 0;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="relative overflow-hidden rounded-3xl p-6 lg:col-span-2">
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-arcane-500/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <LevelOrb level={xp.level} progress={xp.progress} />
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-wide sm:text-3xl">
                {t('dashboard.greeting', { name: profile.displayName ?? profile.username })}
              </h1>
              {isStaff && (
                <Badge variant="gold">
                  <ShieldCheck className="size-3" /> {t('dashboard.staff')}
                </Badge>
              )}
            </div>
            <p className="text-sm text-mist/60">
              @{profile.username} · {t('dashboard.subtitle')}
            </p>
            <div className="space-y-1.5 pt-2">
              <div className="flex flex-wrap justify-between gap-2 text-xs text-mist/60">
                <span>
                  {t('dashboard.level', { level: xp.level })} · {t('dashboard.xpTotal', { xp: formatNumber(xp.total, locale) })}
                </span>
                <span>
                  {xp.nextLevelXp === null
                    ? t('dashboard.maxLevel')
                    : t('dashboard.xpToNext', { xp: formatNumber(xp.nextLevelXp - xp.total, locale), level: xp.level + 1 })}
                </span>
              </div>
              <Progress value={xp.progress} label={t('dashboard.level', { level: xp.level })} />
            </div>
          </div>
        </div>
      </Card>
      <Card className="flex flex-col justify-between rounded-3xl p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-mist/50">{t('dashboard.plan')}</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-gold-400/15 text-gold-300">
              {subscription.planCode === 'free' ? <Sparkles className="size-5" /> : <Crown className="size-5" />}
            </span>
            <div>
              <p className="font-display text-xl font-bold">{t(`dashboard.planNames.${subscription.planCode}`)}</p>
              <p className="text-xs text-mist/55">{t(`dashboard.statuses.${subscription.status}`)}</p>
            </div>
          </div>
          {subscription.currentPeriodEnd && (
            <p className="mt-3 text-xs text-mist/55">
              {t('dashboard.validUntil', { date: formatDate(subscription.currentPeriodEnd, locale, profile.timezone) })}
            </p>
          )}
        </div>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/#plans">{t('dashboard.seePlans')}</Link>
        </Button>
      </Card>
    </div>
  );
}

function Universes({ data }: { data: DashboardResponse }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const { join, leave } = useMembershipMutations();
  const memberships = new Map(data.memberships.map((m) => [m.slug, m]));
  const mine = data.universes.filter((u) => memberships.has(u.slug));
  const others = data.universes.filter((u) => !memberships.has(u.slug));
  const error = join.error ?? leave.error;

  return (
    <>
      {error && (
        <Alert variant="danger" className="mt-8">
          {errorMessage(error, t)}
        </Alert>
      )}
      <section className="mt-12" aria-labelledby="my-universes">
        <h2 id="my-universes" className="font-display text-2xl font-bold tracking-wide">
          {t('dashboard.myUniverses')}
        </h2>
        <div className="mt-6">
          {mine.length === 0 ? (
            <EmptyState>{t('dashboard.noUniverses')}</EmptyState>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {mine.map((u) => {
                const m = memberships.get(u.slug)!;
                return (
                  <UniverseCard
                    key={u.id}
                    universe={u}
                    footer={
                      <>
                        <Button asChild size="sm" variant="glass">
                          <Link to={`/universes/${u.slug}`}>{t('dashboard.open')}</Link>
                        </Button>
                        <Badge variant="success">
                          {t('dashboard.joined')} · {t('dashboard.level', { level: m.level })}
                        </Badge>
                        <span className="text-xs text-mist/50">
                          {t('dashboard.memberSince', { date: formatDate(m.joinedAt, locale, data.profile.timezone) })}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto"
                          loading={leave.isPending && leave.variables === u.slug}
                          onClick={() => leave.mutate(u.slug)}
                        >
                          {t('dashboard.leave')}
                        </Button>
                      </>
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>
      {others.length > 0 && (
        <section className="mt-12" aria-labelledby="discover-universes">
          <h2 id="discover-universes" className="font-display text-2xl font-bold tracking-wide">
            {t('dashboard.discover')}
          </h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {others.map((u) => (
              <UniverseCard
                key={u.id}
                universe={u}
                footer={
                  <>
                    <Button size="sm" variant="gold" loading={join.isPending && join.variables === u.slug} onClick={() => join.mutate(u.slug)}>
                      {t('dashboard.join')}
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link to={`/universes/${u.slug}`}>{t('dashboard.open')}</Link>
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function VerifyEmailBanner() {
  const { t } = useTranslation();
  const resend = useMutation({ mutationFn: () => api<void>('/v1/auth/email-verification', { method: 'POST' }) });
  return (
    <Alert variant="warning" className="mb-6 flex-wrap items-center">
      <MailWarning className="size-5 shrink-0" />
      <span className="flex-1">{t('dashboard.emailNotVerified')}</span>
      {resend.isSuccess ? (
        <span className="text-xs">{t('dashboard.verificationSent')}</span>
      ) : (
        <Button size="sm" variant="glass" loading={resend.isPending} onClick={() => resend.mutate()}>
          {t('dashboard.resendVerification')}
        </Button>
      )}
      {resend.isError && <span role="alert" className="w-full text-xs text-red-200">{errorMessage(resend.error, t)}</span>}
    </Alert>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const dashboard = useDashboard();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {dashboard.isPending ? (
        <div className="space-y-6" aria-busy="true">
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-52 lg:col-span-2" />
            <Skeleton className="h-52" />
          </div>
          <Skeleton className="h-72" />
        </div>
      ) : dashboard.isError ? (
        <ErrorState error={dashboard.error} title={t('dashboard.error')} onRetry={() => void dashboard.refetch()} />
      ) : !dashboard.data.profile.onboardingCompleted ? (
        <OnboardingForm />
      ) : (
        <>
          {!dashboard.data.profile.emailVerified && <VerifyEmailBanner />}
          <Overview data={dashboard.data} />
          <Universes data={dashboard.data} />
        </>
      )}
    </div>
  );
}
