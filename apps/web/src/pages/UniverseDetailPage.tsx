import type { QuizSummary, UniverseMembership } from '@fandom/types';
import { Badge, Button, cn, Skeleton } from '@fandom/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FEATURE_ENGINE } from '@fandom/shared';
import { ArrowLeft, BookOpen, Brain, CalendarDays, Check, Medal, MessagesSquare, Play, ShoppingBag, Sparkles, Target, Trophy, Users, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState, ErrorState } from '@/components/states';
import { UniverseCover, universeStyle } from '@/components/UniverseCard';
import { StoreTab } from '@/components/universe/StoreTab';
import { useDashboard, useQuizProgress, useRanking, useUniverse, useUniverseQuizzes, type UniverseDetail } from '@/hooks/data';
import { useMembershipMutations } from '@/hooks/useMembership';
import { api, ApiError } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatNumber, localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';
import { CommunityTab } from '@/components/universe/CommunityTab';
import { ArchiveTab, EventsTab, MissionsTab, StandingsCard } from '@/components/universe/SectionTabs';
import { GamesPanel } from '@/components/universe/GamesPanel';
import NotFoundPage from './NotFoundPage';
import { PlanName } from '@/components/premium';

type Tab = 'overview' | 'quizzes' | 'archive' | 'community' | 'missions' | 'events' | 'ranking' | 'store';

/** Engine → tab. Identity lives in the overview; house cup inside the ranking tab. */
const ENGINE_TAB: Record<string, Tab> = {
  identity: 'overview', quizzes: 'quizzes', archive: 'archive', forum: 'community', missions: 'missions',
  events: 'events', ranking: 'ranking', house_cup: 'ranking',
};
const TAB_ORDER: Tab[] = ['overview', 'quizzes', 'archive', 'community', 'missions', 'events', 'ranking', 'store'];
const TAB_ICONS = { overview: Sparkles, quizzes: Brain, archive: BookOpen, community: MessagesSquare, missions: Target, events: CalendarDays, ranking: Trophy, store: ShoppingBag };

function tabsFor(features: string[]): Tab[] {
  const set = new Set<Tab>(['overview', 'ranking', 'store']);
  for (const f of features) {
    const engine = FEATURE_ENGINE[f];
    if (engine) set.add(ENGINE_TAB[engine]!);
  }
  return TAB_ORDER.filter((t) => set.has(t));
}

function humanize(key: string): string {
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function useMembership(slug: string): { member: UniverseMembership | null; onboarded: boolean; loading: boolean } {
  const { session } = useAuth();
  const dash = useDashboard();
  if (!session) return { member: null, onboarded: false, loading: false };
  if (dash.isPending) return { member: null, onboarded: false, loading: true };
  return {
    member: dash.data?.memberships.find((m) => m.slug === slug) ?? null,
    onboarded: Boolean(dash.data?.profile.onboardingCompleted),
    loading: false,
  };
}

function MembershipAction({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { member, onboarded, loading } = useMembership(slug);
  const { join, leave } = useMembershipMutations();

  if (!session) {
    return (
      <Button asChild size="lg" variant="gold">
        <Link to="/login" state={{ from: `/universes/${slug}` }}>{t('universe.signInToJoin')}</Link>
      </Button>
    );
  }
  if (loading) return <Skeleton className="h-13 w-56" />;
  if (!onboarded) {
    return (
      <Button asChild size="lg" variant="gold">
        <Link to="/dashboard">{t('universe.completeOnboarding')}</Link>
      </Button>
    );
  }
  const error = join.error ?? leave.error;
  return (
    <div className="flex flex-col gap-3">
      {member ? (
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="success" className="px-4 py-2 text-sm"><Check className="size-4" /> {t('universe.joined')}</Badge>
          <Badge variant="gold" className="px-4 py-2 text-sm">{t('dashboard.level', { level: member.level })} · {member.xp} XP</Badge>
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

/** Identity system: sorting quiz (when the universe has one) or a direct choice. */
function IdentitySection({ universe, sortingQuiz }: { universe: UniverseDetail; sortingQuiz: QuizSummary | undefined }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const qc = useQueryClient();
  const { member } = useMembership(universe.slug);
  const choose = useMutation({
    mutationFn: (key: string) => api<UniverseMembership>(`/v1/universes/${universe.slug}/identity`, { method: 'PUT', body: { key } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['me'] }),
  });
  const options = universe.identityConfig.options ?? [];
  if (options.length === 0) return null;
  const currentKey = typeof member?.identity.key === 'string' ? member.identity.key : null;
  const canChoose = Boolean(member) && !sortingQuiz;

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-2xl font-bold tracking-wide">
          {t('universe.identity')}
          {universe.identityConfig.label && <span className="text-[color:var(--u-glow)]"> · {universe.identityConfig.label[locale]}</span>}
        </h2>
        {sortingQuiz && member && (
          <Button asChild variant="gold" size="sm">
            <Link to={`/universes/${universe.slug}/quizzes/${sortingQuiz.id}`}><Wand2 /> {currentKey ? t('universe.retakeSorting') : localized(sortingQuiz.title, locale)}</Link>
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm text-mist/60">
        {!member ? t('universe.identityJoinFirst') : sortingQuiz ? t('universe.identityByQuiz') : t('universe.identityChoose')}
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {options.map((o, i) => {
          const selected = currentKey === o.key;
          return (
            <motion.button
              key={o.key}
              type="button"
              disabled={!canChoose || choose.isPending}
              onClick={() => choose.mutate(o.key)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              whileHover={canChoose ? { y: -4 } : undefined}
              aria-pressed={selected}
              className={cn(
                'glass relative overflow-hidden rounded-2xl p-5 text-left transition disabled:cursor-default',
                selected && 'ring-2 ring-[color:var(--u-accent)]',
                canChoose && 'cursor-pointer hover:bg-white/10',
              )}
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: o.color ?? 'var(--u-accent)' }} />
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-lg font-semibold">{o.name[locale] ?? o.key}</h3>
                {selected && <Badge variant="success"><Check className="size-3" /> {t('universe.yours')}</Badge>}
              </div>
              {o.traits?.[locale] && <p className="mt-2 text-sm capitalize text-mist/60">{o.traits[locale].join(' · ')}</p>}
              {o.minLevel !== undefined && <p className="mt-2 text-sm text-mist/60">{t('universe.minLevel', { level: o.minLevel })}</p>}
            </motion.button>
          );
        })}
      </div>
      {choose.isError && <p role="alert" className="mt-3 text-sm text-red-300">{errorMessage(choose.error, t)}</p>}
    </section>
  );
}

function QuizzesTab({ universe }: { universe: UniverseDetail }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const { session } = useAuth();
  const { member } = useMembership(universe.slug);
  const quizzes = useUniverseQuizzes(universe.slug);
  const progress = useQuizProgress(universe.slug, Boolean(session && member));
  const games = <GamesPanel universe={universe} isMember={Boolean(member)} signedIn={Boolean(session)} />;
  if (quizzes.isPending) return <>{games}<div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-44" /><Skeleton className="h-44" /></div></>;
  if (quizzes.isError) return <>{games}<ErrorState error={quizzes.error} onRetry={() => void quizzes.refetch()} /></>;
  if (quizzes.data.length === 0) return <>{games}<EmptyState>{t('universe.noQuizzes')}</EmptyState></>;
  return (
    <>
    {games}
    <h2 className="mb-5 font-display text-2xl font-bold tracking-wide">{t('universe.quizzesTitle')}</h2>
    <div className="grid gap-4 md:grid-cols-2">
      {quizzes.data.map((q) => {
        const p = progress.data?.find((x) => x.quizId === q.id);
        return (
          <div key={q.id} className="glass flex flex-col rounded-2xl p-6">
            <div className="flex items-center gap-2">
              <span className="grid size-10 place-items-center rounded-xl bg-[color:var(--u-primary)]/40 text-[color:var(--u-glow)]">
                {q.kind === 'personality' ? <Wand2 className="size-5" /> : <Brain className="size-5" />}
              </span>
              <Badge>{q.kind === 'personality' ? t('quiz.personality') : t(`quiz.difficulty.${q.difficulty}`)}</Badge>
              <Badge variant="gold">+{q.xpReward} XP</Badge>
            </div>
            <h3 className="mt-4 font-display text-xl font-bold">{localized(q.title, locale)}</h3>
            <p className="mt-2 flex-1 text-sm text-mist/65">{localized(q.description, locale)}</p>
            <p className="mt-3 text-xs text-mist/50">
              {t('quiz.questions', { count: q.questionCount })}
              {p && q.kind === 'trivia' && ` · ${t('quiz.best', { score: p.bestScore, total: p.total })} · ${t('quiz.earned', { xp: p.xpEarned })}`}
              {p && q.kind === 'personality' && ` · ${t('quiz.done')}`}
            </p>
            <div className="mt-4">
              {member ? (
                <Button asChild variant={p ? 'glass' : 'primary'}>
                  <Link to={`/universes/${universe.slug}/quizzes/${q.id}`}><Play /> {p ? t('quiz.playAgain') : t('quiz.play')}</Link>
                </Button>
              ) : (
                <p className="text-sm text-mist/55">{t('universe.identityJoinFirst')}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}

function RankingTab({ universe }: { universe: UniverseDetail }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [params, setParams] = useSearchParams();
  const period = (['all', 'month', 'week'].includes(params.get('period') ?? '') ? params.get('period') : 'all') as 'all' | 'month' | 'week';
  const ranking = useRanking(universe.slug, period);
  const { session } = useAuth();
  const identityName = (key: string | null) => (key ? universe.identityConfig.options?.find((o) => o.key === key)?.name[locale] ?? key : null);
  return (
    <div>
      <div role="radiogroup" className="glass mb-6 inline-flex rounded-xl p-1">
        {(['all', 'month', 'week'] as const).map((p) => (
          <button
            key={p}
            role="radio"
            aria-checked={period === p}
            onClick={() => setParams({ tab: 'ranking', period: p }, { replace: true })}
            className={cn('rounded-lg px-4 py-2 text-sm font-semibold transition', period === p ? 'bg-[color:var(--u-primary)] text-white' : 'text-mist/70 hover:text-mist')}
          >
            {t(`ranking.${p}`)}
          </button>
        ))}
      </div>
      {ranking.isPending ? (
        <Skeleton className="h-72" />
      ) : ranking.isError ? (
        <ErrorState error={ranking.error} onRetry={() => void ranking.refetch()} />
      ) : ranking.data.length === 0 ? (
        <EmptyState icon={<Trophy className="size-8 text-[color:var(--u-glow)]" />}>{t('ranking.empty')}</EmptyState>
      ) : (
        <ol className="glass divide-y divide-white/5 overflow-hidden rounded-2xl">
          {ranking.data.map((e) => {
            const mine = session?.user.id === e.userId;
            return (
              <li key={e.userId} className={cn('flex items-center gap-4 px-5 py-3', mine && 'bg-white/[0.06]')}>
                <span className={cn('grid size-9 place-items-center rounded-full font-display font-bold', e.rank <= 3 ? 'bg-gold-400/20 text-gold-200' : 'bg-white/5 text-mist/60')}>
                  {e.rank <= 3 ? <Medal className="size-4" /> : e.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-1 font-semibold"><PlanName name={e.displayName ?? e.username ?? '—'} plan={e.plan} />{mine && <span className="shrink-0 text-xs text-mist/50"> · {t('ranking.you')}</span>}</p>
                  <p className="truncate text-xs text-mist/55">{e.username ? `@${e.username}` : ''}{identityName(e.identity) ? ` · ${identityName(e.identity)}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="font-display font-bold">{formatNumber(e.xp, locale)} XP</p>
                  <p className="text-xs text-mist/50">{t('dashboard.level', { level: e.level })}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-4 text-xs text-mist/45">{t('ranking.fair')}</p>
    </div>
  );
}

export default function UniverseDetailPage() {
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const locale = currentLocale();
  const [params, setParams] = useSearchParams();
  const universe = useUniverse(slug);
  const quizzes = useUniverseQuizzes(slug);
  const sortingQuiz = quizzes.data?.find((q) => q.setsIdentity);
  const { member } = useMembership(slug);
  const tabs = universe.data ? tabsFor(universe.data.features) : (['overview'] as Tab[]);
  const tab: Tab = tabs.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'overview';
  const section = params.get('section') ?? '';
  const go = (t: Tab, sec?: string) => setParams(t === 'overview' ? {} : { tab: t, ...(sec ? { section: sec } : {}) }, { replace: true });

  if (universe.isError && universe.error instanceof ApiError && [404, 422].includes(universe.error.status)) return <NotFoundPage />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link to="/universes" className="inline-flex items-center gap-2 text-sm text-mist/60 hover:text-mist">
        <ArrowLeft className="size-4" /> {t('universe.back')}
      </Link>
      {universe.isPending ? (
        <div className="mt-8 space-y-6"><Skeleton className="h-72" /><Skeleton className="h-48" /></div>
      ) : universe.isError ? (
        <div className="mt-8"><ErrorState error={universe.error} onRetry={() => void universe.refetch()} /></div>
      ) : (
        <div style={universeStyle(universe.data.theme)}>
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mt-8 min-h-[26rem] overflow-hidden rounded-3xl border border-white/15 shadow-[0_40px_120px_-40px_var(--u-primary)] sm:min-h-[30rem]"
          >
            <UniverseCover universe={universe.data} imgClassName="animate-ken-burns" />
            <div className="relative flex min-h-[26rem] flex-col justify-end p-4 sm:min-h-[30rem] sm:p-8">
              <div className="glass-strong max-w-3xl rounded-3xl p-6 sm:p-8">
                <Badge className="bg-black/30 text-[color:var(--u-glow)]">
                  <Users className="size-3" /> {t('landing.universes.members', { count: universe.data.memberCount })}
                </Badge>
                <h1 className="mt-4 font-display text-4xl font-bold tracking-wide text-white sm:text-6xl">{localized(universe.data.name, locale)}</h1>
                <p className="mt-3 text-lg text-[color:var(--u-glow)]">{localized(universe.data.tagline, locale)}</p>
                <p className="mt-4 max-w-2xl text-mist/80">{localized(universe.data.description, locale)}</p>
                <div className="mt-7"><MembershipAction slug={universe.data.slug} /></div>
              </div>
            </div>
          </motion.section>

          <nav role="tablist" aria-label={t('universe.sections')} className="glass-strong sticky top-16 z-30 -mx-4 mt-8 flex gap-1 overflow-x-auto px-4 py-2 sm:mx-0 sm:rounded-2xl">
            {tabs.map((k) => {
              const Icon = TAB_ICONS[k];
              return (
                <button
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => go(k)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
                    tab === k ? 'bg-[color:var(--u-primary)] text-white shadow-lg' : 'text-mist/70 hover:bg-white/5 hover:text-mist',
                  )}
                >
                  <Icon className="size-4" />
                  {t(`universe.tabs.${k}`)}
                </button>
              );
            })}
          </nav>

          <div className="mt-8" role="tabpanel">
            {tab === 'overview' && (
              <>
                <IdentitySection universe={universe.data} sortingQuiz={sortingQuiz} />
                <section className="mt-12">
                  <h2 className="font-display text-2xl font-bold tracking-wide">{t('universe.features')}</h2>
                  <div className="mt-6 flex flex-wrap gap-2.5">
                    {universe.data.features.map((f) => {
                      const engine = FEATURE_ENGINE[f];
                      const target = engine ? ENGINE_TAB[engine] : undefined;
                      return (
                        <button
                          key={f}
                          type="button"
                          disabled={!target}
                          onClick={() => target && go(target, engine === 'archive' || engine === 'forum' ? f : undefined)}
                          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--u-accent)]/50 bg-white/10 px-4 py-2 text-sm text-mist transition hover:bg-white/15 disabled:opacity-60"
                        >
                          {t(`universe.featureNames.${f}`, { defaultValue: humanize(f) })}
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">{t('universe.available')}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </>
            )}
            {tab === 'quizzes' && <QuizzesTab universe={universe.data} />}
            {tab === 'archive' && <ArchiveTab universe={universe.data} section={section} onSection={(sec) => go('archive', sec)} />}
            {tab === 'community' && <CommunityTab universe={universe.data} category={section} onCategory={(sec) => go('community', sec)} isMember={Boolean(member)} />}
            {tab === 'missions' && <MissionsTab universe={universe.data} isMember={Boolean(member)} />}
            {tab === 'events' && <EventsTab universe={universe.data} isMember={Boolean(member)} />}
            {tab === 'store' && <StoreTab universe={universe.data} />}
            {tab === 'ranking' && (
              <>
                {universe.data.features.includes('house_cup') && <StandingsCard universe={universe.data} />}
                <RankingTab universe={universe.data} />
              </>
            )}
          </div>
          <p className="mt-12 text-xs text-mist/45">{t('landing.disclaimer.body')}</p>
        </div>
      )}
    </div>
  );
}
