import { Button } from '@fandom/ui';
import { motion } from 'framer-motion';
import { ArrowRight, Globe2, ShieldCheck, Swords, Trophy, Users, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { SectionHeading } from '@/components/Layout';
import { LogoMark } from '@/components/Logo';
import { ParticleField } from '@/components/ParticleField';
import { PlanCards } from '@/components/PlanCards';
import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/states';
import { UniverseCard } from '@/components/UniverseCard';
import { usePlans, useUniverses } from '@/hooks/data';

const FEATURES = [
  { key: 'identity', icon: Wand2 },
  { key: 'community', icon: Users },
  { key: 'gamification', icon: Trophy },
  { key: 'events', icon: Swords },
  { key: 'safety', icon: ShieldCheck },
  { key: 'global', icon: Globe2 },
] as const;

function Hero() {
  const { t } = useTranslation();
  const { session } = useAuth();
  return (
    <section className="relative isolate overflow-hidden">
      <ParticleField className="absolute inset-0 -z-10 size-full" />
      {/* Orbital portal */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[min(90vw,760px)] -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
        <div className="absolute inset-0 rounded-full border border-arcane-400/15 animate-spin-slow" />
        <div className="absolute inset-[12%] rounded-full border border-dashed border-mystic-400/15 animate-spin-slow [animation-direction:reverse]" />
        <div className="absolute inset-[28%] rounded-full bg-[radial-gradient(circle,rgb(124_58_237/0.28),transparent_70%)] blur-2xl" />
      </div>
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}>
          <LogoMark className="size-20 animate-float drop-shadow-[0_0_30px_rgb(124_58_237/0.6)]" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-8 rounded-full border border-gold-300/30 bg-gold-400/10 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-200 sm:text-xs sm:tracking-[0.3em]"
        >
          {t('landing.hero.eyebrow')}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.7 }}
          className="mt-6 font-display text-4xl font-bold leading-tight tracking-wide sm:text-6xl lg:text-7xl"
        >
          <span className="text-gradient animate-shimmer">{t('landing.hero.title')}</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="mt-6 max-w-2xl text-base text-mist/70 sm:text-lg">
          {t('landing.hero.subtitle')}
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-10 flex flex-col gap-3 sm:flex-row">
          {session ? (
            <Button asChild size="lg">
              <Link to="/dashboard">{t('landing.hero.ctaDashboard')} <ArrowRight /></Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link to="/register">{t('landing.hero.ctaPrimary')} <ArrowRight /></Link>
            </Button>
          )}
          <Button asChild size="lg" variant="glass">
            <Link to="/universes">{t('landing.hero.ctaSecondary')}</Link>
          </Button>
        </motion.div>
        <p className="mt-16 font-display text-xs tracking-[0.45em] text-mist/40">{t('common.slogan')}</p>
      </div>
    </section>
  );
}

function UniversesSection() {
  const { t } = useTranslation();
  const universes = useUniverses();
  return (
    <section id="universes" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <SectionHeading eyebrow={t('landing.universes.eyebrow')} title={t('landing.universes.title')} subtitle={t('landing.universes.subtitle')} />
      <div className="mt-14">
        {universes.isPending ? (
          <CardGridSkeleton count={3} className="h-80" />
        ) : universes.isError ? (
          <ErrorState error={universes.error} title={t('landing.universes.error')} onRetry={() => void universes.refetch()} />
        ) : universes.data.length === 0 ? (
          <EmptyState>{t('landing.universes.empty')}</EmptyState>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {universes.data.map((u, i) => (
              <motion.div key={u.id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <UniverseCard universe={u} className="h-full" />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FeaturesSection() {
  const { t } = useTranslation();
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <SectionHeading eyebrow={t('landing.features.eyebrow')} title={t('landing.features.title')} />
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ key, icon: Icon }, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            whileHover={{ y: -4 }}
            className="glass group rounded-2xl p-6"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-arcane-500/30 to-mystic-500/20 text-arcane-200 ring-1 ring-white/10 transition group-hover:shadow-[0_0_24px_-4px] group-hover:shadow-arcane-500/60">
              <Icon className="size-5" />
            </span>
            <h3 className="mt-5 font-semibold">{t(`landing.features.items.${key}.title`)}</h3>
            <p className="mt-2 text-sm text-mist/60">{t(`landing.features.items.${key}.body`)}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function PlansSection() {
  const { t } = useTranslation();
  const plans = usePlans('BRL');
  return (
    <section id="plans" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <SectionHeading eyebrow={t('landing.plans.eyebrow')} title={t('landing.plans.title')} subtitle={t('landing.plans.subtitle')} />
      <div className="mt-12">
        {plans.isPending ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <CardGridSkeleton count={1} className="h-[520px]" />
            <CardGridSkeleton count={1} className="h-[520px]" />
            <CardGridSkeleton count={1} className="h-[520px]" />
          </div>
        ) : plans.isError ? (
          <ErrorState error={plans.error} title={t('landing.plans.error')} onRetry={() => void plans.refetch()} />
        ) : (
          <PlanCards plans={plans.data} />
        )}
      </div>
    </section>
  );
}

export default function LandingPage() {
  const { t } = useTranslation();
  const { session } = useAuth();
  return (
    <>
      <Hero />
      <UniversesSection />
      <FeaturesSection />
      <PlansSection />
      <section className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="glass rounded-2xl p-6 text-center">
          <h2 className="font-display text-lg font-semibold tracking-wide text-gold-200">{t('landing.disclaimer.title')}</h2>
          <p className="mt-2 text-sm text-mist/60">{t('landing.disclaimer.body')}</p>
        </div>
      </section>
      {!session && (
        <section className="mx-auto mt-24 max-w-5xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-arcane-400/25 bg-[linear-gradient(120deg,rgb(124_58_237/0.35),rgb(29_143_224/0.2),rgb(232_182_76/0.18))] px-8 py-14 text-center">
            <h2 className="font-display text-3xl font-bold tracking-wide">{t('landing.cta.title')}</h2>
            <p className="mt-3 text-mist/75">{t('landing.cta.body')}</p>
            <Button asChild size="lg" variant="gold" className="mt-8">
              <Link to="/register">{t('landing.cta.button')} <ArrowRight /></Link>
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
