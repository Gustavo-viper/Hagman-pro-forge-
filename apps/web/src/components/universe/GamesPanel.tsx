import type { GameKind } from '@fandom/types';
import { Badge, Button, cn, Skeleton } from '@fandom/ui';
import { CalendarCheck, Crown, Flame, HeartPulse, Medal, Puzzle, Timer } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ErrorState } from '@/components/states';
import { useGameLeaderboard, useGamesOverview } from '@/hooks/games';
import type { UniverseDetail } from '@/hooks/data';
import { PlanName, useMyPlan } from '@/components/premium';
import { PREMIUM_PERKS } from '@fandom/shared';

const GAMES: { key: GameKind; icon: typeof Timer }[] = [
  { key: 'daily', icon: CalendarCheck },
  { key: 'speed', icon: Timer },
  { key: 'hangman', icon: Puzzle },
  { key: 'survival', icon: HeartPulse },
];

function Leaderboard({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const [game, setGame] = useState<GameKind>('daily');
  const board = useGameLeaderboard(slug, game);
  return (
    <section className="glass rounded-2xl p-5" aria-labelledby="games-board">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="games-board" className="flex items-center gap-2 font-semibold"><Medal className="size-4 text-gold-300" /> {t('games.leaderboard')}</h3>
        <div role="radiogroup" aria-label={t('games.leaderboard')} className="inline-flex rounded-xl bg-white/[0.04] p-1">
          {GAMES.map((g) => (
            <button
              key={g.key}
              type="button"
              role="radio"
              aria-checked={game === g.key}
              onClick={() => setGame(g.key)}
              className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold transition', game === g.key ? 'bg-[color:var(--u-primary)] text-white' : 'text-mist/65 hover:text-mist')}
            >
              {t(`games.${g.key}.short`)}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-mist/50">{t(`games.${game}.boardInfo`)}</p>
      {board.isPending ? <Skeleton className="mt-4 h-32" /> : board.isError ? <ErrorState error={board.error} /> : board.data.length === 0 ? (
        <p className="mt-4 text-sm text-mist/55">{t('games.boardEmpty')}</p>
      ) : (
        <ol className="mt-4 space-y-1.5">
          {board.data.slice(0, 10).map((e) => (
            <li key={e.userId} className="flex items-center gap-3 text-sm">
              <span className={cn('grid size-7 place-items-center rounded-full text-xs font-bold', e.rank <= 3 ? 'bg-gold-400/20 text-gold-200' : 'bg-white/5 text-mist/60')}>{e.rank}</span>
              <PlanName name={e.displayName ?? e.username ?? '—'} plan={e.plan} className="flex-1" />
              <span className="font-semibold tabular-nums">{e.total ? `${e.score}/${e.total}` : t(`games.${game}.unit`, { count: e.score })}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Mini-games of a universe (daily, speed, hangman and the subscribers' survival mode), with leaderboards. */
export function GamesPanel({ universe, isMember, signedIn }: { universe: UniverseDetail; isMember: boolean; signedIn: boolean }) {
  const { t } = useTranslation();
  const overview = useGamesOverview(universe.slug, signedIn && isMember);
  const o = overview.data;
  const plan = useMyPlan();
  const survivalOpen = o ? o.survival.available : plan !== 'free';
  const status: Record<GameKind, string | null> = {
    daily: o ? (o.daily.playedToday ? t('games.daily.done', { score: o.daily.score, total: o.daily.total }) : t('games.daily.available')) : null,
    speed: o ? t('games.speed.best', { count: o.speed.best }) : null,
    hangman: o ? t('games.hangman.wins', { count: o.hangman.wins }) : null,
    survival: o && o.survival.available ? t('games.survival.best', { count: o.survival.best }) : null,
  };
  // What the player's plan gives in each game, and what Plus would give (shown to Free players).
  const limit: Record<GameKind, string | null> = {
    daily: o && o.daily.shieldsPerWeek > 0 ? t('premiumPerks.shieldLimit', { count: o.daily.shieldsPerWeek, used: o.daily.shieldsUsed }) : null,
    speed: o ? t('premiumPerks.speedLimit', { xp: o.limits.speedDailyXp }) : null,
    hangman: o ? t('premiumPerks.hangmanLimit', { count: o.limits.hangmanRewardedWins }) : null,
    survival: null,
  };
  const upgrade: Record<GameKind, string | null> = {
    daily: o?.plan === 'free' ? t('premiumPerks.shieldUpgrade') : null,
    speed: o?.plan === 'free' ? t('premiumPerks.speedUpgrade', { xp: PREMIUM_PERKS.speedDailyXpCap.plus }) : null,
    hangman: o?.plan === 'free' ? t('premiumPerks.hangmanUpgrade', { count: PREMIUM_PERKS.hangmanRewardedWins.plus }) : null,
    survival: null,
  };
  return (
    <section className="mb-10" aria-labelledby="games-title">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="games-title" className="font-display text-2xl font-bold tracking-wide">{t('games.title')}</h2>
        {o && o.daily.streak > 0 && <Badge variant="gold"><Flame className="size-3" /> {t('games.streak', { count: o.daily.streak })}</Badge>}
        {o && o.limits.xpBonusPercent > 0 && <Badge variant="arcane"><Crown className="size-3" /> {t('premiumPerks.bonusActive', { percent: o.limits.xpBonusPercent })}</Badge>}
      </div>
      <p className="mt-1 text-sm text-mist/60">{t('games.subtitle')}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {GAMES.map(({ key, icon: Icon }) => {
          const premium = key === 'survival';
          return (
            <div key={key} className={cn('glass flex flex-col rounded-2xl p-5', premium && 'border-gold-300/30 bg-[linear-gradient(160deg,rgb(232_182_76/0.10),rgb(255_255_255/0.02))]')}>
              <div className="flex items-center justify-between gap-2">
                <span className={cn('grid size-10 place-items-center rounded-xl', premium ? 'bg-gold-400/20 text-gold-200' : 'bg-[color:var(--u-primary)]/40 text-[color:var(--u-glow)]')}><Icon className="size-5" /></span>
                {premium && <Badge variant="gold"><Crown className="size-3" /> {t('premiumPerks.exclusive', { plan: 'Plus' })}</Badge>}
              </div>
              <h3 className="mt-3 font-display text-lg font-bold">{t(`games.${key}.title`)}</h3>
              <p className="mt-1 flex-1 text-sm text-mist/65">{t(`games.${key}.description`)}</p>
              {status[key] && <p className="mt-3 text-xs font-semibold text-[color:var(--u-glow)]">{status[key]}</p>}
              {limit[key] && <p className="mt-1 text-xs text-mist/50">{limit[key]}</p>}
              {upgrade[key] && (
                <Link to="/premium" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-gold-200 hover:underline"><Crown className="size-3" /> {upgrade[key]}</Link>
              )}
              <div className="mt-4">
                {!(signedIn && isMember) ? (
                  <p className="text-sm text-mist/55">{t('universe.identityJoinFirst')}</p>
                ) : premium && !survivalOpen ? (
                  <Button asChild size="sm" variant="gold"><Link to="/premium">{t('premiumPerks.unlockWith', { plan: t('dashboard.planNames.plus') })}</Link></Button>
                ) : (
                  <Button asChild size="sm" variant={key === 'daily' && o?.daily.playedToday ? 'glass' : premium ? 'gold' : 'primary'}>
                    <Link to={`/universes/${universe.slug}/games/${key}`}>
                      {key === 'daily' && o?.daily.playedToday ? t('games.daily.review') : key === 'hangman' && o?.hangman.activeId ? t('games.hangman.resume') : t('games.play')}
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4"><Leaderboard slug={universe.slug} /></div>
    </section>
  );
}
