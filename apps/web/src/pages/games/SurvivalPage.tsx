import type { GameQuestion, SurvivalRound } from '@fandom/types';
import { Badge, Button, Card, cn, Progress } from '@fandom/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Crown, HeartPulse, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { PremiumLock, XpReward } from '@/components/premium';
import { ApiError, api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';
import { GameShell, optionClass } from './GameShell';

const FEEDBACK_MS = 500;

/** Survival mode (subscribers): one question at a time, 20 s each, the first mistake ends the run. */
export default function SurvivalPage() {
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const locale = currentLocale();
  const qc = useQueryClient();
  const [run, setRun] = useState<SurvivalRound | null>(null);
  const [shown, setShown] = useState<GameQuestion | null>(null);
  const [feedback, setFeedback] = useState<{ chosen: string; correctKey: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const questionEnd = useRef(0);
  const finishing = useRef(false);

  const settle = (r: SurvivalRound) => {
    if (r.status === 'finished') {
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['universes', slug] });
    }
  };
  const armTimer = (r: SurvivalRound) => {
    questionEnd.current = Date.now() + r.questionSeconds * 1000;
    finishing.current = false;
    setNow(Date.now());
  };
  const start = useMutation({
    mutationFn: () => api<SurvivalRound>(`/v1/universes/${slug}/games/survival`, { method: 'POST' }),
    onSuccess: (r) => {
      setRun(r);
      setShown(r.question);
      setFeedback(null);
      armTimer(r);
    },
  });
  const finish = useMutation({
    mutationFn: (id: string) => api<SurvivalRound>(`/v1/games/survival/${id}/finish`, { method: 'POST' }),
    onSuccess: (r) => {
      setRun(r);
      settle(r);
    },
  });
  const answer = useMutation({
    mutationFn: (v: { id: string; questionId: string; key: string }) =>
      api<SurvivalRound>(`/v1/games/survival/${v.id}/answers`, { method: 'POST', body: { questionId: v.questionId, key: v.key } }),
    onSuccess: (r, v) => {
      setFeedback({ chosen: v.key, correctKey: r.last?.correctKey ?? v.key });
      // Keep the question on screen briefly so the player sees the right answer.
      setTimeout(() => {
        setFeedback(null);
        setRun(r);
        setShown(r.question);
        if (r.status === 'active') armTimer(r);
        settle(r);
      }, r.status === 'active' ? FEEDBACK_MS : FEEDBACK_MS * 2);
    },
  });

  const active = run?.status === 'active';
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [active]);
  const remaining = active ? Math.max(0, questionEnd.current - now) : 0;
  useEffect(() => {
    if (active && run && remaining === 0 && !feedback && !answer.isPending && !finishing.current) {
      finishing.current = true;
      finish.mutate(run.id);
    }
  }, [active, remaining, run, feedback, answer.isPending, finish]);

  const choose = (key: string) => {
    if (!run || !shown || answer.isPending || feedback) return;
    answer.mutate({ id: run.id, questionId: shown.id, key });
  };
  const locked = start.error instanceof ApiError && start.error.code === 'premium_required';
  const error = locked ? null : start.error ?? answer.error ?? finish.error;

  return (
    <GameShell slug={slug} title={t('games.survival.title')} subtitle={t('games.survival.description')}>
      {() => (
        <div className="mt-6">
          {locked ? (
            <PremiumLock plan="plus" title={t('premiumPerks.survivalLocked')}>{t('games.survival.rules')}</PremiumLock>
          ) : !run ? (
            <Card className="rounded-3xl border-gold-300/30 p-8 text-center">
              <HeartPulse className="mx-auto size-12 text-gold-200" />
              <Badge variant="gold" className="mt-4"><Crown className="size-3" /> {t('premiumPerks.exclusive', { plan: 'Plus' })}</Badge>
              <p className="mt-4 text-mist/75">{t('games.survival.rules')}</p>
              <Button className="mt-6" size="lg" variant="gold" loading={start.isPending} onClick={() => start.mutate()}>{t('games.survival.start')}</Button>
            </Card>
          ) : (run.status === 'active' || feedback) && shown ? (
            <Card className="rounded-3xl p-6 sm:p-8">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold tabular-nums">{Math.ceil(remaining / 1000)}s</span>
                <span className="font-semibold">{t('games.survival.streak', { count: run.score })}</span>
              </div>
              <Progress className="mt-2" value={remaining / (run.questionSeconds * 1000)} label={t('games.speed.timeLeft')} />
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
              <p className="text-sm uppercase tracking-[0.3em] text-mist/55">{run.last?.timedOut ? t('games.survival.timedOut') : t('games.survival.over')}</p>
              <p className="mt-2 font-display text-5xl font-bold">{t('games.survival.streak', { count: run.score })}</p>
              <XpReward className="mt-4" xp={run.xpAwarded} bonus={run.xpBonus} />
              {run.xpAwarded === 0 && <p className="mt-4 text-xs text-mist/50">{t('games.survival.noXp')}</p>}
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button variant="gold" loading={start.isPending} onClick={() => start.mutate()}><RotateCcw /> {t('games.playAgain')}</Button>
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
