import { Badge, Button, Skeleton } from '@fandom/ui';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Sparkles, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { ErrorState } from '@/components/states';
import { UniverseSigil, universeStyle } from '@/components/UniverseCard';
import { useDashboard, useUniverse } from '@/hooks/data';
import { useMembershipMutations } from '@/hooks/useMembership';
import { ApiError } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatNumber, localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';
import NotFoundPage from './NotFoundPage';

function humanize(key: string): string {
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function MembershipAction({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const dashboard = useDashboard();
  const { join, leave } = useMembershipMutations();

  if (!session) {
    return (
      <Button asChild size="lg" variant="gold">
        <Link to="/login" state={{ from: `/universes/${slug}` }}>{t('universe.signInToJoin')}</Link>
      </Button>
    );
  }
  if (dashboard.isPending) return <Skeleton className="h-13 w-56" />;
  if (dashboard.isError) return <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
  if (!dashboard.data.profile.onboardingCompleted) {
    return (
      <Button asChild size="lg" variant="gold">
        <Link to="/dashboard">{t('universe.completeOnboarding')}</Link>
      </Button>
    );
  }
  const member = dashboard.data.memberships.some((m) => m.slug === slug);
  const error = join.error ?? leave.error;
  return (
    <div className="flex flex-col gap-3">
      {member ? (
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="success" className="px-4 py-2 text-sm"><Check className="size-4" /> {t('universe.joined')}</Badge>
          <Button variant="ghost" size="sm" loading={leave.isPending} onClick={() => leave.mutate(slug)}>{t('universe.leave')}</Button>
        </div>
      ) : (
        <Button size="lg" variant="gold" loading={join.isPending} onClick={() => join.mutate(slug)}>
          <Sparkles /> {t('universe.join')}
        </Button>
      )}
      {error && <p role="alert" className="text-sm text-red-300">{errorMessage(error, t)}</p>}
    </div>
  );
}

export default function UniverseDetailPage() {
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const locale = currentLocale();
  const universe = useUniverse(slug);

  if (universe.isError && universe.error instanceof ApiError && [404, 422].includes(universe.error.status)) return <NotFoundPage />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link to="/universes" className="inline-flex items-center gap-2 text-sm text-mist/60 hover:text-mist">
        <ArrowLeft className="size-4" /> {t('universe.back')}
      </Link>
      {universe.isPending ? (
        <div className="mt-8 space-y-6">
          <Skeleton className="h-72" />
          <Skeleton className="h-48" />
        </div>
      ) : universe.isError ? (
        <div className="mt-8"><ErrorState error={universe.error} onRetry={() => void universe.refetch()} /></div>
      ) : (
        <div style={universeStyle(universe.data.theme)}>
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mt-8 overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(140deg,color-mix(in_oklab,var(--u-primary)_55%,transparent),color-mix(in_oklab,var(--u-bg)_95%,transparent)_60%,color-mix(in_oklab,var(--u-secondary)_50%,transparent))] p-8 sm:p-12"
          >
            <UniverseSigil slug={universe.data.slug} className="absolute -right-16 -top-16 size-80 opacity-30 animate-spin-slow" />
            <Badge className="relative bg-black/30 text-[color:var(--u-glow)]">
              <Users className="size-3" /> {t('landing.universes.members', { count: universe.data.memberCount, formatted: formatNumber(universe.data.memberCount, locale) })}
            </Badge>
            <h1 className="relative mt-6 font-display text-4xl font-bold tracking-wide text-white sm:text-6xl">{localized(universe.data.name, locale)}</h1>
            <p className="relative mt-3 text-lg text-[color:var(--u-glow)]">{localized(universe.data.tagline, locale)}</p>
            <p className="relative mt-5 max-w-2xl text-mist/75">{localized(universe.data.description, locale)}</p>
            <div className="relative mt-8"><MembershipAction slug={universe.data.slug} /></div>
          </motion.section>

          {universe.data.identityConfig.options && universe.data.identityConfig.options.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-bold tracking-wide">
                {t('universe.identity')}
                {universe.data.identityConfig.label && <span className="text-[color:var(--u-glow)]"> · {universe.data.identityConfig.label[locale]}</span>}
              </h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {universe.data.identityConfig.options.map((o, i) => (
                  <motion.div
                    key={o.key}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    className="glass relative overflow-hidden rounded-2xl p-5"
                  >
                    <div className="absolute inset-x-0 top-0 h-1" style={{ background: o.color ?? 'var(--u-accent)' }} />
                    <h3 className="font-display text-lg font-semibold">{o.name[locale] ?? o.key}</h3>
                    {o.traits?.[locale] && <p className="mt-2 text-sm capitalize text-mist/60">{o.traits[locale].join(' · ')}</p>}
                    {o.minLevel !== undefined && <p className="mt-2 text-sm text-mist/60">{t('universe.minLevel', { level: o.minLevel })}</p>}
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-12">
            <h2 className="font-display text-2xl font-bold tracking-wide">{t('universe.features')}</h2>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {universe.data.features.map((f) => (
                <span key={f} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-mist/80">
                  {t(`universe.featureNames.${f}`, { defaultValue: humanize(f) })}
                </span>
              ))}
            </div>
          </section>
          <p className="mt-12 text-xs text-mist/45">{t('landing.disclaimer.body')}</p>
        </div>
      )}
    </div>
  );
}
