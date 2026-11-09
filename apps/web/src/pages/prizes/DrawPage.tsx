import type { DrawSummary } from '@fandom/types';
import { Alert, Badge, Button, Card, Skeleton } from '@fandom/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Gem, ShieldCheck, Ticket, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { ErrorState } from '@/components/states';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';
import { PhaseBadge } from './PrizesPage';

/** One VIP prize draw: lucky number, authorization data and verifiable results. */
export default function DrawPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const locale = currentLocale();
  const { session } = useAuth();
  const qc = useQueryClient();
  const key = ['draws', id, session?.user.id ?? 'anon'];
  const draw = useQuery({ queryKey: key, queryFn: ({ signal }) => api<DrawSummary>(`/v1/draws/${id}`, { signal }) });
  const enter = useMutation({
    mutationFn: () => api<DrawSummary>(`/v1/draws/${id}/entries`, { method: 'POST' }),
    onSuccess: (d) => qc.setQueryData(key, d),
  });

  if (draw.isPending) return <div className="mx-auto max-w-3xl px-4 py-12"><Skeleton className="h-96" /></div>;
  if (draw.isError) return <div className="mx-auto max-w-3xl px-4 py-12"><ErrorState error={draw.error} /></div>;
  const d = draw.data;
  const closes = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(d.entriesCloseAt));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link to="/premios" className="inline-flex items-center gap-2 text-sm text-mist/60 hover:text-mist"><ArrowLeft className="size-4" /> {t('prizes.title')}</Link>
      <div className="mt-4 flex flex-wrap items-center gap-2"><PhaseBadge phase={d.phase} /><Badge variant="gold"><Gem className="size-3" /> {t('prizes.draws.vipOnly')}</Badge></div>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-wide">{localized(d.title, locale)}</h1>
      <p className="mt-2 text-mist/70">{localized(d.description, locale)}</p>
      <p className="mt-3 text-gold-200">{t('prizes.draw.prize', { prize: localized(d.prize, locale), count: d.prizeCount })}</p>

      <Card className="mt-6 rounded-2xl p-5">
        <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-emerald-300" /> {t('prizes.draw.authorized')}</p>
        <p className="mt-1 text-sm text-mist/70">{t('prizes.draw.certificate', { number: d.certificateNumber })}</p>
        {d.regulationUrl && (
          <a href={d.regulationUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-mystic-300 underline"><ExternalLink className="size-3.5" /> {t('prizes.draw.rules')}</a>
        )}
        <p className="mt-3 text-xs text-mist/50">{t('prizes.draw.closes', { date: closes, count: d.entryCount })}</p>
      </Card>

      <div className="mt-6">
        {d.myNumber ? (
          <Card className="rounded-3xl p-8 text-center">
            <Ticket className="mx-auto size-10 text-emerald-300" />
            <p className="mt-3 text-sm uppercase tracking-[0.3em] text-mist/55">{t('prizes.draw.yourNumber')}</p>
            <p className="mt-1 font-display text-6xl font-bold tabular-nums">{String(d.myNumber).padStart(5, '0')}</p>
          </Card>
        ) : d.eligible ? (
          <Button size="lg" variant="gold" loading={enter.isPending} onClick={() => enter.mutate()}><Ticket /> {t('prizes.draw.getNumber')}</Button>
        ) : d.phase === 'open' ? (
          <Alert variant="info" className="flex-wrap items-center">
            <span className="flex-1">{t(`prizes.draw.blocked.${d.ineligibleReason ?? 'closed'}`)}</span>
            {d.ineligibleReason === 'plan_required' && <Button asChild size="sm" variant="gold"><Link to="/premium">{t('prizes.draw.becomeVip')}</Link></Button>}
            {d.ineligibleReason === 'sign_in' && <Button asChild size="sm"><Link to="/login">{t('nav.signIn')}</Link></Button>}
          </Alert>
        ) : null}
        {enter.isError && <p role="alert" className="mt-3 text-sm text-red-300">{errorMessage(enter.error, t)}</p>}
      </div>

      {d.results && (
        <section className="mt-8" aria-labelledby="results">
          <h2 id="results" className="flex items-center gap-2 font-display text-xl font-bold"><Trophy className="size-5 text-gold-300" /> {t('prizes.draw.results')}</h2>
          <ol className="mt-3 space-y-2">
            {d.results.winners.map((w) => (
              <li key={w.position} className="glass flex items-center justify-between rounded-xl px-4 py-3">
                <span>{w.position}º · {w.name}</span>
                <span className="font-mono tabular-nums">{String(w.luckyNumber).padStart(5, '0')}</span>
              </li>
            ))}
          </ol>
          <details className="glass mt-4 rounded-2xl p-4 text-sm">
            <summary className="cursor-pointer select-none font-semibold">{t('prizes.draw.verify')}</summary>
            <p className="mt-2 text-mist/70">{t('prizes.draw.verifyText')}</p>
            <dl className="mt-3 space-y-1 break-all font-mono text-xs text-mist/70">
              <div><dt className="inline text-mist/45">sha256(seed) = </dt><dd className="inline">{d.seedHash}</dd></div>
              <div><dt className="inline text-mist/45">seed = </dt><dd className="inline">{d.results.seed}</dd></div>
              <div><dt className="inline text-mist/45">{t('prizes.draw.external')} = </dt><dd className="inline">{d.results.externalValue}</dd></div>
            </dl>
          </details>
        </section>
      )}
    </div>
  );
}
