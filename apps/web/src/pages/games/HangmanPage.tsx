import type { HangmanGame } from '@fandom/types';
import { Badge, Button, Card, cn, Skeleton } from '@fandom/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clapperboard, Heart, Lightbulb, PartyPopper, RotateCcw, Skull } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { useGamesOverview } from '@/hooks/games';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';
import { GameShell } from './GameShell';
import { XpReward } from '@/components/premium';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const base = (c: string) => c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

/** Gallows drawing: one more part for every wrong letter (6 lives). */
function Gallows({ wrong }: { wrong: number }) {
  const part = (n: number) => cn('transition-opacity duration-300', wrong >= n ? 'opacity-100' : 'opacity-0');
  return (
    <svg viewBox="0 0 120 140" className="h-44 w-36 text-mist" role="img" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" className="opacity-50">
        <path d="M10 132 H80 M30 132 V10 H80 V24" />
      </g>
      <g stroke="var(--u-glow, #c4b5fd)" strokeWidth="4" strokeLinecap="round" fill="none">
        <circle cx="80" cy="36" r="12" className={part(1)} />
        <path d="M80 48 V86" className={part(2)} />
        <path d="M80 58 L64 74" className={part(3)} />
        <path d="M80 58 L96 74" className={part(4)} />
        <path d="M80 86 L66 110" className={part(5)} />
        <path d="M80 86 L94 110" className={part(6)} />
      </g>
    </svg>
  );
}

export default function HangmanPage() {
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const locale = currentLocale();
  const qc = useQueryClient();
  const overview = useGamesOverview(slug, true);
  const [game, setGame] = useState<HangmanGame | null>(null);
  const resumed = useRef(false);

  const refreshAfter = (g: HangmanGame) => {
    if (g.status !== 'active') {
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['universes', slug] });
    }
  };
  const start = useMutation({
    mutationFn: () => api<HangmanGame>(`/v1/universes/${slug}/games/hangman`, { method: 'POST' }),
    onSuccess: (g) => {
      queue.current = [];
      setQueued([]);
      setGame(g);
    },
  });
  const resume = useMutation({
    mutationFn: (id: string) => api<HangmanGame>(`/v1/games/hangman/${id}`),
    onSuccess: (g) => setGame(g),
  });
  const clue = useMutation({
    mutationFn: (id: string) => api<HangmanGame>(`/v1/games/hangman/${id}/clues`, { method: 'POST' }),
    onSuccess: (g) => setGame(g),
  });
  const guess = useMutation({
    mutationFn: (v: { id: string; letter: string }) => api<HangmanGame>(`/v1/games/hangman/${v.id}/guesses`, { method: 'POST', body: { letter: v.letter } }),
  });
  // Letters typed quickly are queued and sent one at a time (the server applies them in order).
  const queue = useRef<string[]>([]);
  const [queued, setQueued] = useState<string[]>([]);
  const draining = useRef(false);
  const drain = async (id: string) => {
    if (draining.current) return;
    draining.current = true;
    try {
      while (queue.current.length) {
        const letter = queue.current[0]!;
        const g = await guess.mutateAsync({ id, letter }).catch(() => null);
        queue.current.shift();
        setQueued([...queue.current]);
        if (!g) {
          queue.current = [];
          setQueued([]);
          break;
        }
        setGame(g);
        refreshAfter(g);
        if (g.status !== 'active') {
          queue.current = [];
          setQueued([]);
        }
      }
    } finally {
      draining.current = false;
    }
  };

  // Resume an unfinished game once, otherwise wait for "New game".
  const activeId = overview.data?.hangman.activeId;
  useEffect(() => {
    if (resumed.current || !overview.data) return;
    resumed.current = true;
    if (activeId) resume.mutate(activeId);
  }, [overview.data, activeId, resume]);

  const play = (letter: string) => {
    if (!game || game.status !== 'active' || game.guessed.includes(letter) || queue.current.includes(letter)) return;
    queue.current.push(letter);
    setQueued([...queue.current]);
    void drain(game.id);
  };
  const playRef = useRef(play);
  playRef.current = play;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (/^[a-z]$/i.test(e.key)) playRef.current(e.key.toUpperCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const error = overview.error ?? start.error ?? resume.error ?? guess.error ?? clue.error;
  const loading = overview.isPending || resume.isPending;

  return (
    <GameShell slug={slug} title={t('games.hangman.title')} subtitle={t('games.hangman.description')} error={overview.error}>
      {() => (
        <div className="mt-6">
          {loading ? <Skeleton className="h-80" /> : !game ? (
            <Card className="rounded-3xl p-8 text-center">
              <Gallows wrong={0} />
              <p className="mt-4 text-mist/75">{t('games.hangman.rules')}</p>
              {overview.data && <p className="mt-2 text-xs text-mist/50">{t('games.hangman.rewardsLeft', { count: overview.data.hangman.rewardedWinsLeft })}</p>}
              <Button className="mt-6" size="lg" loading={start.isPending} onClick={() => start.mutate()}>{t('games.hangman.new')}</Button>
            </Card>
          ) : (
            <Card className="rounded-3xl p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge variant="mystic">{t('games.hangman.hint')}: {localized(game.hint, locale)}</Badge>
                <span className="inline-flex items-center gap-1 text-sm" aria-label={t('games.hangman.lives', { count: game.livesLeft })}>
                  {Array.from({ length: game.maxLives }, (_, i) => (
                    <Heart key={i} className={cn('size-4', i < game.livesLeft ? 'fill-red-400 text-red-400' : 'text-mist/25')} />
                  ))}
                </span>
              </div>
              {game.cluesTotal > 0 && (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md" data-testid="hangman-clues">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-semibold text-[color:var(--u-glow)]">
                      <Clapperboard className="size-4" /> {t('games.hangman.clues', { shown: game.clues.length, total: game.cluesTotal })}
                    </p>
                    {game.status === 'active' && game.clues.length < game.cluesTotal && (
                      <Button size="sm" variant="glass" loading={clue.isPending} onClick={() => clue.mutate(game.id)}>
                        <Lightbulb /> {t('games.hangman.moreClue')}
                      </Button>
                    )}
                  </div>
                  {game.clues.length === 0 ? (
                    <p className="mt-2 text-sm text-mist/55">{t('games.hangman.cluesHelp')}</p>
                  ) : (
                    <ol className="mt-3 space-y-2">
                      {game.clues.map((c, i) => (
                        <li key={i} className="flex gap-3 text-sm text-mist/85">
                          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[color:var(--u-primary)]/50 text-xs font-bold text-white">{i + 1}</span>
                          <span>{localized(c, locale)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
              <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:justify-center">
                <Gallows wrong={game.maxLives - game.livesLeft} />
                <p className="flex max-w-md flex-wrap justify-center gap-x-1.5 gap-y-3" aria-label={t('games.hangman.word')} data-testid="hangman-word">
                  {game.mask.map((c, i) =>
                    c === ' ' ? <span key={i} className="w-4" /> : (
                      <span key={i} className={cn('grid h-11 w-8 place-items-end justify-center border-b-2 pb-1 font-display text-2xl font-bold uppercase', c === null ? 'border-mist/40' : 'border-[color:var(--u-accent)]', game.status === 'lost' && c && !game.guessed.includes(base(c)) && /[A-Z]/.test(base(c)) && 'text-red-300')}>
                        {c ?? ' '}
                      </span>
                    ),
                  )}
                </p>
              </div>

              {game.status === 'active' ? (
                <div className="mt-8 grid grid-cols-7 gap-2 sm:grid-cols-[repeat(13,minmax(0,1fr))]" role="group" aria-label={t('games.hangman.keyboard')}>
                  {LETTERS.map((l) => {
                    const used = game.guessed.includes(l) || queued.includes(l);
                    const bad = game.wrong.includes(l);
                    return (
                      <button
                        key={l}
                        type="button"
                        disabled={used}
                        onClick={() => play(l)}
                        aria-label={t('games.hangman.letter', { letter: l })}
                        className={cn(
                          'h-10 rounded-lg border text-sm font-bold transition',
                          !used && 'border-white/15 bg-white/[0.05] hover:border-white/35 hover:bg-white/10',
                          used && !bad && queued.includes(l) && 'border-white/15 bg-white/10 text-mist/60',
                          used && !bad && !queued.includes(l) && 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200',
                          bad && 'border-red-400/40 bg-red-500/10 text-red-300/70 line-through',
                        )}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-8 text-center">
                  {game.status === 'won' ? (
                    <p className="flex items-center justify-center gap-2 font-display text-2xl font-bold text-emerald-200"><PartyPopper className="size-6" /> {t('games.hangman.won')}</p>
                  ) : (
                    <p className="flex items-center justify-center gap-2 font-display text-2xl font-bold text-red-200"><Skull className="size-6" /> {t('games.hangman.lost', { word: game.word })}</p>
                  )}
                  <XpReward className="mt-3" xp={game.xpAwarded} bonus={game.xpBonus} />
                  {game.status === 'won' && game.xpAwarded === 0 && <p className="mt-3 text-xs text-mist/50">{t('games.hangman.noXp')}</p>}
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Button loading={start.isPending} onClick={() => start.mutate()}><RotateCcw /> {t('games.hangman.new')}</Button>
                    <Button asChild variant="glass"><Link to={`/universes/${slug}?tab=quizzes`}>{t('games.seeBoard')}</Link></Button>
                  </div>
                </div>
              )}
            </Card>
          )}
          {error && error !== overview.error && <p role="alert" className="mt-4 text-sm text-red-300">{errorMessage(error, t)}</p>}
        </div>
      )}
    </GameShell>
  );
}
