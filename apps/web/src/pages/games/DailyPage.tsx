import type { DailyChallenge } from '@fandom/types';
import { Badge, Button, Card, cn, Skeleton } from '@fandom/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Flame, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';
import { GameShell, optionClass } from './GameShell';
import { XpReward } from '@/components/premium';

export default function DailyPage() {
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const locale = currentLocale();
  const qc = useQueryClient();
  const key = ['me', 'games', slug, 'daily'];
  const daily = useQuery({ queryKey: key, queryFn: ({ signal }) => api<DailyChallenge>(`/v1/universes/${slug}/games/daily`, { signal }) });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const submit = useMutation({
    mutationFn: () => api<DailyChallenge>(`/v1/universes/${slug}/games/daily`, { method: 'POST', body: { answers } }),
    onSuccess: (d) => {
      qc.setQueryData(key, d);
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['universes', slug] });
    },
  });
  const d = daily.data;
  const dayLabel = d ? new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${d.day}T12:00:00Z`)) : '';

  return (
    <GameShell slug={slug} title={t('games.daily.title')} subtitle={d ? dayLabel : undefined} error={daily.error}>
      {() =>
        !d ? <Skeleton className="mt-8 h-96" /> : (
          <div className="mt-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="gold"><Sparkles className="size-3" /> {t('games.daily.xpInfo', { xp: d.xpPerCorrect, bonus: d.perfectBonus })}</Badge>
              {d.streak > 0 && <Badge variant="gold"><Flame className="size-3" /> {t('games.streak', { count: d.streak })}</Badge>}
            </div>

            {d.result && (
              <Card className="mt-6 rounded-3xl p-6 text-center">
                <p className="text-sm uppercase tracking-[0.3em] text-mist/55">{t('games.daily.yourResult')}</p>
                <p className="mt-2 font-display text-5xl font-bold">{d.result.score}/{d.result.total}</p>
                <XpReward className="mt-3" xp={d.result.xpAwarded} bonus={d.result.xpBonus} />
                <p className="mt-3 text-sm text-mist/60">{t('games.daily.comeBack')}</p>
              </Card>
            )}

            <ol className="mt-6 space-y-5">
              {d.questions.map((q, i) => {
                const review = d.result?.review.find((r) => r.questionId === q.id);
                return (
                  <li key={q.id}>
                    <Card className="rounded-2xl p-5">
                      <p className="text-xs text-mist/50">{t('quiz.questionOf', { n: i + 1, total: d.questions.length })}</p>
                      <h2 className="mt-1 font-display text-lg font-bold">{localized(q.prompt, locale)}</h2>
                      <div role="radiogroup" aria-label={localized(q.prompt, locale)} className="mt-4 grid gap-2 sm:grid-cols-2">
                        {q.options.map((o) => {
                          const state = review
                            ? o.key === review.correctKey ? 'right' : o.key === review.chosen ? 'wrong' : 'idle'
                            : answers[q.id] === o.key ? 'chosen' : 'idle';
                          return (
                            <button
                              key={o.key}
                              type="button"
                              role="radio"
                              aria-checked={(review ? review.chosen : answers[q.id]) === o.key}
                              disabled={Boolean(review)}
                              onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.key }))}
                              className={cn('flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm transition', optionClass(state))}
                            >
                              {localized(o.text, locale)}
                              {state === 'right' && <Check className="size-4 shrink-0" />}
                              {state === 'wrong' && <X className="size-4 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                      {review?.explanation && <p className="mt-3 text-xs text-mist/60">{localized(review.explanation, locale)}</p>}
                    </Card>
                  </li>
                );
              })}
            </ol>

            {!d.result && (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button disabled={Object.keys(answers).length < d.questions.length} loading={submit.isPending} onClick={() => submit.mutate()}>
                  {t('games.daily.submit')} <Check />
                </Button>
                <p className="text-xs text-mist/50">{t('games.daily.once')}</p>
              </div>
            )}
            {submit.isError && <p role="alert" className="mt-3 text-sm text-red-300">{errorMessage(submit.error, t)}</p>}
            {d.result && (
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild><Link to={`/universes/${slug}/games/speed`}>{t('games.speed.title')}</Link></Button>
                <Button asChild variant="glass"><Link to={`/universes/${slug}/games/hangman`}>{t('games.hangman.title')}</Link></Button>
              </div>
            )}
          </div>
        )
      }
    </GameShell>
  );
}
