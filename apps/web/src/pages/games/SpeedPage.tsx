import type { GameQuestion, SpeedRound } from '@fandom/types';
import { Button, Card, cn, Progress } from '@fandom/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, RotateCcw, Timer, X, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';
import { GameShell, optionClass } from './GameShell';
import { XpReward } from '@/components/premium';

const FEEDBACK_MS = 450;

export default function SpeedPage() {
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const locale = currentLocale();
  const qc = useQueryClient();
  const [round, setRound] = useState<SpeedRound | null>(null);
  const [shown, setShown] = useState<GameQuestion | null>(null);
  const [feedback, setFeedback] = useState<{ chosen: string; correctKey: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const localEnd = useRef(0);
  const finishing = useRef(false);

  const done = (r: SpeedRound) => {
    if (r.status === 'finished') {
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['universes', slug] });
    }
  };
  const start = useMutation({
    mutationFn: () => api<SpeedRound>(`/v1/universes/${slug}/games/speed`, { method: 'POST' }),
    onSuccess: (r) => {
      // Client clock: the round lasts durationSeconds from now (the server deadline is the authority).
      localEnd.current = Date.now() + r.durationSeconds * 1000;
      finishing.current = false;
      setRound(r);
      setShown(r.question);
      setFeedback(null);
      setNow(Date.now());
    },
  });
  const finish = useMutation({
    mutationFn: (id: string) => api<SpeedRound>(`/v1/games/speed/${id}/finish`, { method: 'POST' }),
    onSuccess: (r) => {
      setRound(r);
      done(r);
    },
  });
  const answer = useMutation({
    mutationFn: (v: { id: string; questionId: string; key: string }) =>
      api<SpeedRound>(`/v1/games/speed/${v.id}/answers`, { method: 'POST', body: { questionId: v.questionId, key: v.key } }),
    onSuccess: (r, v) => {
      setRound(r);
      if (r.last && r.last.questionId === v.questionId) {
        setFeedback({ chosen: v.key, correctKey: r.last.correctKey });
        setTimeout(() => {
          setFeedback(null);
          setShown(r.question);
        }, FEEDBACK_MS);
      } else {
        setShown(r.question);
      }
      done(r);
    },
  });

  const active = round?.status === 'active';
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [active]);
  const remaining = active ? Math.max(0, localEnd.current - now) : 0;
  useEffect(() => {
    if (active && round && remaining === 0 && !finishing.current) {
      finishing.current = true;
      finish.mutate(round.id);
    }
  }, [active, remaining, round, finish]);

  const choose = (key: string) => {
    if (!round || !shown || answer.isPending || feedback) return;
    answer.mutate({ id: round.id, questionId: shown.id, key });
  };
  const error = start.error ?? answer.error ?? finish.error;

  return (
    <GameShell slug={slug} title={t('games.speed.title')} subtitle={t('games.speed.description')}>
      {() => (
        <div className="mt-6">
          {!round ? (
            <Card className="rounded-3xl p-8 text-center">
              <Timer className="mx-auto size-12 text-[color:var(--u-glow)]" />
              <p className="mt-4 text-mist/75">{t('games.speed.rules')}</p>
              <Button className="mt-6" size="lg" loading={start.isPending} onClick={() => start.mutate()}><Zap /> {t('games.speed.start')}</Button>
            </Card>
          ) : round.status === 'active' && shown ? (
            <Card className="rounded-3xl p-6 sm:p-8">
              <div className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums" aria-live="off"><Timer className="size-4" /> {Math.ceil(remaining / 1000)}s</span>
                <span className="font-semibold">{t('games.speed.score', { count: round.score })}</span>
              </div>
              <Progress className="mt-2" value={remaining / (round.durationSeconds * 1000)} label={t('games.speed.timeLeft')} />
              <h2 className="mt-6 font-display text-2xl font-bold leading-snug">{localized(shown.prompt, locale)}</h2>
              <div role="radiogroup" aria-label={localized(shown.prompt, locale)} className="mt-6 grid gap-3">
                {shown.options.map((o) => {
                  const state = feedback ? (o.key === feedback.correctKey ? 'right' : o.key === feedback.chosen ? 'wrong' : 'idle') : 'idle';
                  return (
                    <button
                      key={o.key}
                      type="button"
                      role="radio"
                      aria-checked={feedback?.chosen === o.key}
                      onClick={() => choose(o.key)}
                      className={cn('flex items-center justify-between rounded-xl border px-5 py-4 text-left text-base transition', optionClass(state))}
                    >
                      {localized(o.text, locale)}
                      {state === 'right' && <Check className="size-4" />}
                      {state === 'wrong' && <X className="size-4" />}
                    </button>
                  );
                })}
              </div>
            </Card>
          ) : (
            <Card className="rounded-3xl p-8 text-center">
              <p className="text-sm uppercase tracking-[0.3em] text-mist/55">{t('games.speed.over')}</p>
              <p className="mt-2 font-display text-5xl font-bold">{t('games.speed.score', { count: round.score })}</p>
              <p className="mt-2 text-sm text-mist/60">{t('games.speed.answered', { count: round.answered })}</p>
              {round.xpAwarded > 0 ? (
                <XpReward className="mt-4" xp={round.xpAwarded} bonus={round.xpBonus} />
              ) : (
                <p className="mt-4 text-xs text-mist/50">{t('games.speed.noXp')}</p>
              )}
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button loading={start.isPending} onClick={() => start.mutate()}><RotateCcw /> {t('games.playAgain')}</Button>
                <Button asChild variant="glass"><Link to={`/universes/${slug}?tab=quizzes`}>{t('games.seeBoard')}</Link></Button>
              </div>
            </Card>
          )}
          {error && <p role="alert" className="mt-4 text-sm text-red-300">{errorMessage(error, t)}</p>}
        </div>
      )}
    </GameShell>
  );
}
