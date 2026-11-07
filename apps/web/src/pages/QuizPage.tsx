import type { QuizAttemptResult } from '@fandom/types';
import { Badge, Button, Card, cn, Progress, Skeleton } from '@fandom/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, PartyPopper, RotateCcw, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ErrorState } from '@/components/states';
import { universeStyle } from '@/components/UniverseCard';
import { useQuiz, useUniverse } from '@/hooks/data';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';

export default function QuizPage() {
  const { slug = '', quizId = '' } = useParams();
  const { t } = useTranslation();
  const locale = currentLocale();
  const qc = useQueryClient();
  const universe = useUniverse(slug);
  const quiz = useQuiz(quizId);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const submit = useMutation({
    mutationFn: () => api<QuizAttemptResult>(`/v1/quizzes/${quizId}/attempts`, { method: 'POST', body: { answers } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['universes', slug, 'ranking'] });
    },
  });

  if (quiz.isPending || universe.isPending) return <div className="mx-auto max-w-3xl px-4 py-10"><Skeleton className="h-96" /></div>;
  if (quiz.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState error={quiz.error} /></div>;
  if (universe.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState error={universe.error} /></div>;

  const q = quiz.data;
  const u = universe.data;
  const question = q.questions[index]!;
  const total = q.questions.length;
  const chosen = answers[question.id];
  const isLast = index === total - 1;
  const restart = () => {
    setAnswers({});
    setIndex(0);
    submit.reset();
  };

  const result = submit.data;
  const identityOption = result?.resultIdentity ? u.identityConfig.options?.find((o) => o.key === result.resultIdentity) : undefined;

  return (
    <div style={universeStyle(u.theme)} className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link to={`/universes/${slug}?tab=quizzes`} className="inline-flex items-center gap-2 text-sm text-mist/60 hover:text-mist">
        <ArrowLeft className="size-4" /> {localized(u.name, locale)}
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold tracking-wide">{localized(q.title, locale)}</h1>

      {result ? (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 space-y-6">
          <Card className="relative overflow-hidden rounded-3xl p-8 text-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklab,var(--u-glow)_30%,transparent),transparent_70%)]" aria-hidden="true" />
            <PartyPopper className="relative mx-auto size-10 text-[color:var(--u-glow)]" />
            {identityOption ? (
              <>
                <p className="relative mt-4 text-sm uppercase tracking-[0.3em] text-mist/60">{t('quiz.yourResult')}</p>
                <p className="relative mt-2 font-display text-5xl font-bold" style={{ color: identityOption.color ?? 'var(--u-glow)' }}>
                  {identityOption.name[locale] ?? identityOption.key}
                </p>
                {identityOption.traits?.[locale] && <p className="relative mt-3 capitalize text-mist/70">{identityOption.traits[locale].join(' · ')}</p>}
              </>
            ) : (
              <>
                <p className="relative mt-4 font-display text-5xl font-bold">{result.score}/{result.total}</p>
                <p className="relative mt-2 text-mist/70">{t(result.score === result.total ? 'quiz.perfect' : result.score >= result.total / 2 ? 'quiz.good' : 'quiz.keepTrying')}</p>
              </>
            )}
            <div className="relative mt-6 flex flex-wrap justify-center gap-2">
              <Badge variant="gold" className="px-3 py-1.5 text-sm"><Sparkles className="size-4" /> +{result.xpAwarded} XP</Badge>
              {result.xpRemaining > 0 && <Badge className="px-3 py-1.5 text-sm">{t('quiz.remaining', { xp: result.xpRemaining })}</Badge>}
            </div>
            {result.xpAwarded === 0 && result.xpRemaining === 0 && <p className="relative mt-3 text-xs text-mist/50">{t('quiz.noMoreXp')}</p>}
          </Card>

          {q.kind === 'trivia' && (
            <div className="space-y-3">
              {q.questions.map((qq, i) => {
                const r = result.review.find((x) => x.questionId === qq.id)!;
                const label = (key: string | null) => (key ? localized(qq.options.find((o) => o.key === key)?.text, locale) : '');
                return (
                  <div key={qq.id} className="glass rounded-2xl p-4">
                    <p className="text-sm font-semibold">{i + 1}. {localized(qq.prompt, locale)}</p>
                    <p className={cn('mt-2 flex items-center gap-2 text-sm', r.correct ? 'text-emerald-300' : 'text-red-300')}>
                      {r.correct ? <Check className="size-4" /> : <X className="size-4" />} {label(r.chosen)}
                    </p>
                    {!r.correct && <p className="mt-1 text-sm text-emerald-300/90">{t('quiz.correctWas')} {label(r.correctKey)}</p>}
                    {r.explanation && <p className="mt-2 text-xs text-mist/60">{localized(r.explanation, locale)}</p>}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={restart} variant="glass"><RotateCcw /> {t('quiz.playAgain')}</Button>
            <Button asChild><Link to={`/universes/${slug}?tab=${q.setsIdentity ? 'overview' : 'ranking'}`}>{q.setsIdentity ? t('quiz.seeIdentity') : t('quiz.seeRanking')}</Link></Button>
          </div>
        </motion.div>
      ) : (
        <Card className="mt-8 rounded-3xl p-6 sm:p-8">
          <div className="flex items-center justify-between text-xs text-mist/55">
            <span>{t('quiz.questionOf', { n: index + 1, total })}</span>
            <span>+{q.xpReward} XP</span>
          </div>
          <Progress className="mt-2" value={(index + (chosen ? 1 : 0)) / total} label={t('quiz.questionOf', { n: index + 1, total })} />
          <AnimatePresence mode="wait">
            <motion.div key={question.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>
              <h2 className="mt-6 font-display text-2xl font-bold leading-snug">{localized(question.prompt, locale)}</h2>
              <div role="radiogroup" aria-label={localized(question.prompt, locale)} className="mt-6 grid gap-3">
                {question.options.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    role="radio"
                    aria-checked={chosen === o.key}
                    onClick={() => setAnswers((a) => ({ ...a, [question.id]: o.key }))}
                    className={cn(
                      'rounded-xl border px-5 py-4 text-left text-base transition',
                      chosen === o.key
                        ? 'border-[color:var(--u-accent)] bg-[color:var(--u-primary)]/35 text-white'
                        : 'border-white/10 bg-white/[0.04] text-mist/85 hover:border-white/25 hover:bg-white/[0.07]',
                    )}
                  >
                    {localized(o.text, locale)}
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="mt-8 flex justify-between gap-3">
            <Button variant="ghost" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}><ArrowLeft /> {t('quiz.previous')}</Button>
            {isLast ? (
              <Button disabled={Object.keys(answers).length < total} loading={submit.isPending} onClick={() => submit.mutate()}>
                {t('quiz.finish')} <Check />
              </Button>
            ) : (
              <Button disabled={!chosen} onClick={() => setIndex((i) => i + 1)}>{t('quiz.next')} <ArrowRight /></Button>
            )}
          </div>
          {submit.isError && (
            <p role="alert" className="mt-4 text-sm text-red-300">
              {errorMessage(submit.error, t)}{' '}
              <Link to={`/universes/${slug}`} className="underline">{localized(u.name, locale)}</Link>
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
