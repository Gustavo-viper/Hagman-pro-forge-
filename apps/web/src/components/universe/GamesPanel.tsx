import type { GameKind } from '@fandom/types';
import { Badge, Button, cn, Skeleton } from '@fandom/ui';
import { CalendarCheck, Flame, Medal, Puzzle, Timer } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ErrorState } from '@/components/states';
import { useGameLeaderboard, useGamesOverview } from '@/hooks/games';
import type { UniverseDetail } from '@/hooks/data';

const GAMES: { key: GameKind; icon: typeof Timer }[] = [
  { key: 'daily', icon: CalendarCheck },
  { key: 'speed', icon: Timer },
  { key: 'hangman', icon: Puzzle },
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
              <span className="flex-1 truncate">{e.displayName ?? e.username}</span>
              <span className="font-semibold tabular-nums">{e.total ? `${e.score}/${e.total}` : t(`games.${game}.unit`, { count: e.score })}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Mini-games of a universe: daily challenge, speed round and hangman, with leaderboards. */
export function GamesPanel({ universe, isMember, signedIn }: { universe: UniverseDetail; isMember: boolean; signedIn: boolean }) {
  const { t } = useTranslation();
  const overview = useGamesOverview(universe.slug, signedIn && isMember);
  const o = overview.data;
  const status: Record<GameKind, string | null> = {
    daily: o ? (o.daily.playedToday ? t('games.daily.done', { score: o.daily.score, total: o.daily.total }) : t('games.daily.available')) : null,
    speed: o ? t('games.speed.best', { count: o.speed.best }) : null,
    hangman: o ? t('games.hangman.wins', { count: o.hangman.wins }) : null,
  };
  return (
    <section className="mb-10" aria-labelledby="games-title">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="games-title" className="font-display text-2xl font-bold tracking-wide">{t('games.title')}</h2>
        {o && o.daily.streak > 0 && <Badge variant="gold"><Flame className="size-3" /> {t('games.streak', { count: o.daily.streak })}</Badge>}
      </div>
      <p className="mt-1 text-sm text-mist/60">{t('games.subtitle')}</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {GAMES.map(({ key, icon: Icon }) => (
          <div key={key} className="glass flex flex-col rounded-2xl p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-[color:var(--u-primary)]/40 text-[color:var(--u-glow)]"><Icon className="size-5" /></span>
            <h3 className="mt-3 font-display text-lg font-bold">{t(`games.${key}.title`)}</h3>
            <p className="mt-1 flex-1 text-sm text-mist/65">{t(`games.${key}.description`)}</p>
            {status[key] && <p className="mt-3 text-xs font-semibold text-[color:var(--u-glow)]">{status[key]}</p>}
            <div className="mt-4">
              {signedIn && isMember ? (
                <Button asChild size="sm" variant={key === 'daily' && o?.daily.playedToday ? 'glass' : 'primary'}>
                  <Link to={`/universes/${universe.slug}/games/${key}`}>
                    {key === 'daily' && o?.daily.playedToday ? t('games.daily.review') : key === 'hangman' && o?.hangman.activeId ? t('games.hangman.resume') : t('games.play')}
                  </Link>
                </Button>
              ) : (
                <p className="text-sm text-mist/55">{t('universe.identityJoinFirst')}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4"><Leaderboard slug={universe.slug} /></div>
    </section>
  );
}
