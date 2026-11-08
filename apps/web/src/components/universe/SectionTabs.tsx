import { BOOK_SECTION, FEATURE_ENGINE, PLAN_RANK, PREMIUM_CATEGORIES } from '@fandom/shared';
import type { IdentityStanding, LoreEntry, MissionProgress, MissionSummary, UniverseEvent } from '@fandom/types';
import { Badge, Button, cn, Progress, Skeleton } from '@fandom/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Brain, CalendarDays, Check, Crown, DoorOpen, Lock, Radio, Target, Trophy, Users, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState, ErrorState } from '@/components/states';
import type { UniverseDetail } from '@/hooks/data';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatNumber, localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';
import { PlanBadge, useMyPlan, XpReward } from '@/components/premium';
import { BooksView } from './BooksView';

export function featuresOf(universe: UniverseDetail, engine: string): string[] {
  return universe.features.filter((f) => FEATURE_ENGINE[f] === engine);
}

/** Chip row to switch between the sections of one engine (e.g. library / creatures / spells). */
export function SectionChips({ keys, value, onChange }: { keys: string[]; value: string; onChange: (k: string) => void }) {
  const { t } = useTranslation();
  if (keys.length < 2) return null;
  return (
    <div className="mb-6 flex flex-wrap gap-2" role="tablist">
      {keys.map((k) => (
        <button
          key={k}
          role="tab"
          aria-selected={value === k}
          onClick={() => onChange(k)}
          className={cn(
            'rounded-full border px-4 py-2 text-sm font-medium transition',
            value === k ? 'border-[color:var(--u-accent)] bg-[color:var(--u-primary)]/40 text-white' : 'border-white/10 bg-white/5 text-mist/70 hover:text-mist',
          )}
        >
          {PREMIUM_CATEGORIES[k] && <Crown className="mr-1 inline size-3.5 text-gold-300" />}
          {t(`universe.featureNames.${k}`)}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ archive

export function ArchiveTab({ universe, section, onSection }: { universe: UniverseDetail; section: string; onSection: (s: string) => void }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const keys = featuresOf(universe, 'archive');
  const current = keys.includes(section) ? section : keys[0]!;
  const entries = useQuery({
    queryKey: ['universes', universe.slug, 'archive', current],
    queryFn: ({ signal }) => api<{ items: LoreEntry[] }>(`/v1/universes/${universe.slug}/archive/${current}`, { signal, auth: false }).then((r) => r.items),
  });
  return (
    <div>
      <SectionChips keys={keys} value={current} onChange={onSection} />
      {entries.isPending ? (
        <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : entries.isError ? (
        <ErrorState error={entries.error} onRetry={() => void entries.refetch()} />
      ) : entries.data.length === 0 ? (
        <EmptyState>{t('sections.archiveEmpty')}</EmptyState>
      ) : current === BOOK_SECTION ? (
        <BooksView universe={universe} books={entries.data} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {entries.data.map((e, i) => (
            <motion.article key={e.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-lg font-bold">{localized(e.title, locale)}</h3>
                {e.subtitle && <Badge className="shrink-0">{localized(e.subtitle, locale)}</Badge>}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-mist/70">{localized(e.summary, locale)}</p>
            </motion.article>
          ))}
        </div>
      )}
      {current !== BOOK_SECTION && <p className="mt-6 text-xs text-mist/45">{t('sections.archiveNote')}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ missions

export function MissionsTab({ universe, isMember }: { universe: UniverseDetail; isMember: boolean }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const { session } = useAuth();
  const qc = useQueryClient();
  const plan = useMyPlan();
  const missions = useQuery({
    queryKey: ['universes', universe.slug, 'missions'],
    queryFn: ({ signal }) => api<{ items: MissionSummary[] }>(`/v1/universes/${universe.slug}/missions`, { signal, auth: false }).then((r) => r.items),
  });
  const progress = useQuery({
    queryKey: ['me', 'missions', universe.slug],
    queryFn: ({ signal }) => api<{ items: MissionProgress[] }>(`/v1/universes/${universe.slug}/missions/progress`, { signal }).then((r) => r.items),
    enabled: Boolean(session && isMember),
  });
  const claim = useMutation({
    mutationFn: (id: string) => api<MissionProgress & { xpAwarded: number; xpBonus: number }>(`/v1/missions/${id}/claim`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['me'] }),
  });
  if (missions.isPending) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (missions.isError) return <ErrorState error={missions.error} onRetry={() => void missions.refetch()} />;
  if (missions.data.length === 0) return <EmptyState>{t('sections.noMissions')}</EmptyState>;
  const sections = [...new Set(missions.data.map((m) => m.section))];
  const allowed = (m: MissionSummary) => !m.premiumPlan || PLAN_RANK[plan] >= PLAN_RANK[m.premiumPlan];
  return (
    <div className="space-y-10">
      {sections.map((sec) => (
        <section key={sec}>
          <h3 className="font-display text-xl font-bold tracking-wide">{t(`universe.featureNames.${sec}`)}</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {missions.data.filter((m) => m.section === sec).map((m) => {
              const p = progress.data?.find((x) => x.missionId === m.id);
              const ready = p && !p.completed && p.progress >= m.objectiveCount;
              return (
                <div key={m.id} className={cn('glass flex flex-col rounded-2xl p-5', m.premiumPlan && 'border-gold-300/30 bg-[linear-gradient(160deg,rgb(232_182_76/0.10),rgb(255_255_255/0.02))]')}>
                  <div className="flex items-center gap-2">
                    <span className={cn('grid size-9 place-items-center rounded-lg', m.premiumPlan ? 'bg-gold-400/20 text-gold-200' : 'bg-[color:var(--u-primary)]/40 text-[color:var(--u-glow)]')}>
                      {m.premiumPlan ? <Crown className="size-4" /> : <Target className="size-4" />}
                    </span>
                    <h4 className="flex-1 font-semibold">{localized(m.title, locale)}</h4>
                    {m.premiumPlan && <PlanBadge plan={m.premiumPlan} />}
                    <Badge variant="gold">+{m.xpReward} XP</Badge>
                  </div>
                  <p className="mt-2 flex-1 text-sm text-mist/65">{localized(m.description, locale)}</p>
                  {p && (
                    <div className="mt-4 space-y-1">
                      <Progress value={p.progress / m.objectiveCount} label={localized(m.title, locale)} />
                      <p className="text-xs text-mist/50">{p.progress}/{m.objectiveCount}</p>
                    </div>
                  )}
                  <div className="mt-4">
                    {!session || !isMember ? (
                      <p className="text-sm text-mist/55">{t('universe.identityJoinFirst')}</p>
                    ) : !allowed(m) ? (
                      <Button asChild size="sm" variant="gold">
                        <Link to="/premium"><Lock /> {t('premiumPerks.unlockWith', { plan: t(`dashboard.planNames.${m.premiumPlan}`) })}</Link>
                      </Button>
                    ) : p?.completed ? (
                      <Badge variant="success" className="px-3 py-1.5"><Check className="size-4" /> {t('sections.missionDone')}</Badge>
                    ) : (
                      <Button size="sm" disabled={!ready} loading={claim.isPending && claim.variables === m.id} onClick={() => claim.mutate(m.id)}>
                        {ready ? t('sections.claim') : t('sections.inProgress')}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {claim.isError && <p role="alert" className="text-sm text-red-300">{errorMessage(claim.error, t)}</p>}
      {claim.isSuccess && claim.data.xpAwarded > 0 && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-emerald-300">{t('sections.claimed', { xp: claim.data.xpAwarded })}</p>
          <XpReward xp={claim.data.xpAwarded} bonus={claim.data.xpBonus} className="items-start" />
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ events

export function EventsTab({ universe, isMember }: { universe: UniverseDetail; isMember: boolean }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const { session } = useAuth();
  const qc = useQueryClient();
  const events = useQuery({
    queryKey: ['universes', universe.slug, 'events'],
    queryFn: ({ signal }) => api<{ items: UniverseEvent[] }>(`/v1/universes/${universe.slug}/events`, { signal, auth: false }).then((r) => r.items),
  });
  const mine = useQuery({
    queryKey: ['me', 'events', universe.slug],
    queryFn: ({ signal }) => api<{ items: string[] }>(`/v1/universes/${universe.slug}/events/mine`, { signal }).then((r) => r.items),
    enabled: Boolean(session && isMember),
  });
  const toggle = useMutation({
    mutationFn: ({ id, join }: { id: string; join: boolean }) =>
      api(`/v1/events/${id}/registration`, { method: join ? 'POST' : 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['universes', universe.slug, 'events'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
  const fmt = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short' }).format(new Date(iso));
  if (events.isPending) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>;
  if (events.isError) return <ErrorState error={events.error} onRetry={() => void events.refetch()} />;
  if (events.data.length === 0) return <EmptyState>{t('sections.noEvents')}</EmptyState>;
  return (
    <div className="space-y-4">
      {events.data.map((e) => {
        const registered = mine.data?.includes(e.id) ?? false;
        const ended = new Date(e.endsAt) < new Date();
        const cancelled = e.status === 'cancelled';
        const roomOpen = !cancelled && Date.now() >= new Date(e.startsAt).getTime() - 30 * 60_000 && Date.now() <= new Date(e.endsAt).getTime() + 60 * 60_000;
        const full = e.capacity !== null && e.participantCount >= e.capacity && !registered;
        const premiumError = toggle.isError && toggle.variables?.id === e.id && 'code' in toggle.error && toggle.error.code === 'premium_required';
        return (
          <div key={e.id} className={cn('glass rounded-2xl p-5 sm:flex sm:items-center sm:gap-6', e.premiumPlan && 'border-gold-300/30')}>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{t(`sections.eventKinds.${e.kind}`)}</Badge>
                {e.premiumPlan && <Badge variant="gold"><Crown className="size-3" /> {t(`dashboard.planNames.${e.premiumPlan}`)}+</Badge>}
                {cancelled ? <Badge variant="danger">{t('eventRoom.cancelled')}</Badge> : ended && <Badge>{t('sections.ended')}</Badge>}
                {e.hasQuiz && <Badge variant="mystic"><Brain className="size-3" /> {t('eventRoom.hasQuiz')}</Badge>}
                {e.hasExternalLink && <Badge variant="mystic"><Video className="size-3" /> {t('eventRoom.hasLive')}</Badge>}
              </div>
              <h3 className="mt-3 font-display text-xl font-bold">{localized(e.title, locale)}</h3>
              <p className="mt-1 text-sm text-mist/65">{localized(e.description, locale)}</p>
              <p className="mt-3 flex flex-wrap items-center gap-4 text-xs text-mist/55">
                <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" /> {fmt(e.startsAt)}</span>
                <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" /> {e.participantCount}{e.capacity ? `/${e.capacity}` : ''} {t('sections.registered')}</span>
              </p>
            </div>
            <div className="mt-4 shrink-0 sm:mt-0">
              {cancelled || (ended && !roomOpen) ? null : !session || !isMember ? (
                <p className="max-w-48 text-sm text-mist/55">{t('universe.identityJoinFirst')}</p>
              ) : registered ? (
                <div className="flex flex-col items-start gap-2">
                  <Badge variant="success" className="px-3 py-1.5"><Check className="size-4" /> {t('sections.youreIn')}</Badge>
                  <Button asChild size="sm" variant={roomOpen ? 'gold' : 'glass'}>
                    <Link to={`/universes/${universe.slug}/events/${e.id}`}>{roomOpen ? <Radio /> : <DoorOpen />} {roomOpen ? t('eventRoom.enter') : t('eventRoom.view')}</Link>
                  </Button>
                  <Button size="sm" variant="ghost" loading={toggle.isPending && toggle.variables?.id === e.id} onClick={() => toggle.mutate({ id: e.id, join: false })}>{t('sections.leaveEvent')}</Button>
                </div>
              ) : (
                <Button size="sm" variant={e.premiumPlan ? 'gold' : 'primary'} disabled={full} loading={toggle.isPending && toggle.variables?.id === e.id} onClick={() => toggle.mutate({ id: e.id, join: true })}>
                  {full ? t('sections.full') : t('sections.joinEvent')}
                </Button>
              )}
              {premiumError && (
                <div className="mt-3 max-w-60 rounded-xl border border-gold-300/30 bg-gold-400/10 p-3 text-xs text-gold-100">
                  <p className="flex items-center gap-1.5 font-semibold"><Lock className="size-3.5" /> {t('sections.premiumLocked')}</p>
                  <Link to="/premium" className="mt-1 inline-block underline">{t('premium.subscribe')}</Link>
                </div>
              )}
              {toggle.isError && toggle.variables?.id === e.id && !premiumError && <p role="alert" className="mt-2 text-xs text-red-300">{errorMessage(toggle.error, t)}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ house cup / faction standings

export function StandingsCard({ universe }: { universe: UniverseDetail }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const standings = useQuery({
    queryKey: ['universes', universe.slug, 'standings'],
    queryFn: ({ signal }) => api<{ items: IdentityStanding[] }>(`/v1/universes/${universe.slug}/standings`, { signal, auth: false }).then((r) => r.items),
  });
  const options = universe.identityConfig.options ?? [];
  const max = Math.max(1, ...(standings.data ?? []).map((s) => s.xp));
  return (
    <section className="glass mb-8 rounded-3xl p-6">
      <h3 className="flex items-center gap-2 font-display text-xl font-bold"><Trophy className="size-5 text-gold-300" /> {t('universe.featureNames.house_cup')}</h3>
      {standings.isPending ? <Skeleton className="mt-4 h-40" /> : standings.isError ? <ErrorState error={standings.error} /> : (
        <ol className="mt-5 space-y-3">
          {standings.data.map((s, i) => {
            const o = options.find((x) => x.key === s.identity);
            return (
              <li key={s.identity}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{i + 1}. {o?.name[locale] ?? s.identity}</span>
                  <span className="text-mist/60">{formatNumber(s.xp, locale)} XP · {t('sections.members', { count: s.members })}</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div className="h-full rounded-full" style={{ background: o?.color ?? 'var(--u-accent)' }} initial={{ width: 0 }} animate={{ width: `${(s.xp / max) * 100}%` }} transition={{ duration: 0.8 }} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
