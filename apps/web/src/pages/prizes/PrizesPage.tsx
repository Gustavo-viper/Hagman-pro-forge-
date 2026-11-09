import type { ContestSummary, DrawSummary, PrizeItem } from '@fandom/types';
import { Badge, Button, Skeleton } from '@fandom/ui';
import { useQuery } from '@tanstack/react-query';
import { Copy, Gem, Gift, Image as ImageIcon, Ticket } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState, ErrorState } from '@/components/states';
import { api } from '@/lib/api';
import { formatDate, localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';

export function PhaseBadge({ phase }: { phase: string }) {
  const { t } = useTranslation();
  const variant = phase === 'submissions' || phase === 'open' || phase === 'voting' ? 'success' : phase === 'cancelled' ? 'danger' : 'default';
  return <Badge variant={variant}>{t(`prizes.phases.${phase}`)}</Badge>;
}

function MyPrizes() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [copied, setCopied] = useState<string | null>(null);
  const prizes = useQuery({ queryKey: ['me', 'prizes'], queryFn: ({ signal }) => api<{ items: PrizeItem[] }>('/v1/me/prizes', { signal }).then((r) => r.items) });
  if (prizes.isPending) return <Skeleton className="h-24" />;
  if (prizes.isError) return <ErrorState error={prizes.error} />;
  if (prizes.data.length === 0) return <EmptyState>{t('prizes.mine.empty')}</EmptyState>;
  return (
    <ul className="space-y-3">
      {prizes.data.map((p) => (
        <li key={p.id} className="glass rounded-2xl p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="gold"><Gift className="size-3" /> {t(`prizes.mine.source.${p.source}`)}</Badge>
            {p.luckyNumber && <Badge>{t('prizes.draw.number', { number: p.luckyNumber })}</Badge>}
            <span className="text-xs text-mist/50">{formatDate(p.createdAt, locale)}</span>
          </div>
          <p className="mt-2 font-semibold">{localized(p.title, locale)}</p>
          <p className="text-sm text-mist/65">{localized(p.description, locale)}</p>
          {p.code ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="rounded-lg bg-black/40 px-3 py-2 font-mono text-sm tracking-wider text-emerald-200" aria-label={t('prizes.mine.code')}>{p.code}</code>
              <Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard?.writeText(p.code!); setCopied(p.id); }}>
                <Copy /> {copied === p.id ? t('prizes.mine.copied') : t('prizes.mine.copy')}
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gold-200">{t('prizes.mine.pending')}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Cultural contests (free), VIP prize draws and the user's prizes. */
export default function PrizesPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const { session } = useAuth();
  const contests = useQuery({ queryKey: ['contests'], queryFn: ({ signal }) => api<{ items: ContestSummary[] }>('/v1/contests', { signal, auth: false }).then((r) => r.items) });
  const draws = useQuery({ queryKey: ['draws', session?.user.id ?? 'anon'], queryFn: ({ signal }) => api<{ items: DrawSummary[] }>('/v1/draws', { signal }).then((r) => r.items) });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="flex items-center gap-3 font-display text-3xl font-bold tracking-wide"><Gift className="size-7 text-gold-300" /> {t('prizes.title')}</h1>
      <p className="mt-2 text-mist/65">{t('prizes.subtitle')}</p>

      <section className="mt-10" aria-labelledby="contests-title">
        <h2 id="contests-title" className="flex items-center gap-2 font-display text-2xl font-bold"><ImageIcon className="size-5 text-mystic-300" /> {t('prizes.contests.title')}</h2>
        <p className="mt-1 text-sm text-mist/60">{t('prizes.contests.subtitle')}</p>
        <div className="mt-4">
          {contests.isPending ? <Skeleton className="h-32" /> : contests.isError ? <ErrorState error={contests.error} /> : contests.data.length === 0 ? (
            <EmptyState>{t('prizes.contests.empty')}</EmptyState>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {contests.data.map((c) => (
                <li key={c.id}>
                  <Link to={`/concursos/${c.slug}`} className="glass block h-full rounded-2xl p-5 transition hover:bg-white/[0.07]">
                    <div className="flex flex-wrap items-center gap-2"><PhaseBadge phase={c.phase} /><Badge variant="mystic">{t('prizes.contests.free')}</Badge></div>
                    <h3 className="mt-3 font-display text-xl font-bold">{localized(c.title, locale)}</h3>
                    <p className="mt-1 text-sm text-mist/65">{localized(c.description, locale)}</p>
                    <p className="mt-3 text-sm text-gold-200"><Gift className="mr-1 inline size-4" />{localized(c.prize, locale)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-12" aria-labelledby="draws-title">
        <h2 id="draws-title" className="flex items-center gap-2 font-display text-2xl font-bold"><Ticket className="size-5 text-emerald-300" /> {t('prizes.draws.title')}</h2>
        <p className="mt-1 text-sm text-mist/60">{t('prizes.draws.subtitle')}</p>
        <div className="mt-4">
          {draws.isPending ? <Skeleton className="h-32" /> : draws.isError ? <ErrorState error={draws.error} /> : draws.data.length === 0 ? (
            <EmptyState>{t('prizes.draws.empty')}</EmptyState>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {draws.data.map((d) => (
                <li key={d.id}>
                  <Link to={`/sorteios/${d.id}`} className="glass block h-full rounded-2xl p-5 transition hover:bg-white/[0.07]">
                    <div className="flex flex-wrap items-center gap-2">
                      <PhaseBadge phase={d.phase} />
                      <Badge variant="gold"><Gem className="size-3" /> {t('prizes.draws.vipOnly')}</Badge>
                      {d.myNumber && <Badge variant="success">{t('prizes.draw.number', { number: d.myNumber })}</Badge>}
                    </div>
                    <h3 className="mt-3 font-display text-xl font-bold">{localized(d.title, locale)}</h3>
                    <p className="mt-1 text-sm text-mist/65">{localized(d.prize, locale)}</p>
                    <p className="mt-3 text-xs text-mist/50">{t('prizes.draw.certificate', { number: d.certificateNumber })}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {session && (
        <section className="mt-12" aria-labelledby="my-prizes-title">
          <h2 id="my-prizes-title" className="font-display text-2xl font-bold">{t('prizes.mine.title')}</h2>
          <div className="mt-4"><MyPrizes /></div>
        </section>
      )}
    </div>
  );
}
