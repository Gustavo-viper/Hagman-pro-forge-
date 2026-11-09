import type { ContestDetail } from '@fandom/types';
import { Alert, Badge, Button, Card, Checkbox, cn, Input, Label, Skeleton } from '@fandom/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Gift, Heart, Trophy, Upload } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { PlanName } from '@/components/premium';
import { EmptyState, ErrorState } from '@/components/states';
import { api } from '@/lib/api';
import { env } from '@/lib/env';
import { errorMessage } from '@/lib/errors';
import { localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';
import { PhaseBadge } from './PrizesPage';

const when = (iso: string, locale: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

function SubmitForm({ slug, onDone }: { slug: string; onDone: (d: ContestDetail) => void }) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [own, setOwn] = useState(false);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const send = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.set('title', title.trim());
      form.set('description', description.trim());
      form.set('ownWork', 'true');
      form.set('image', file!);
      return api<ContestDetail>(`/v1/contests/${slug}/entries`, { method: 'POST', body: form });
    },
    onSuccess: onDone,
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (file && title.trim() && own) send.mutate();
  };
  return (
    <form onSubmit={submit} className="glass grid gap-4 rounded-2xl p-5 md:grid-cols-[1fr_16rem]" aria-label={t('prizes.contest.submitTitle')}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="c-file">{t('prizes.contest.file')}</Label>
          <input id="c-file" type="file" accept="image/png,image/jpeg,image/webp" className="mt-1.5 block w-full text-sm text-mist/80 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-mist"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <p className="mt-1 text-xs text-mist/50">{t('prizes.contest.fileHint')}</p>
        </div>
        <div>
          <Label htmlFor="c-title">{t('prizes.contest.entryTitle')}</Label>
          <Input id="c-title" className="mt-1.5" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="c-desc">{t('prizes.contest.entryDescription')}</Label>
          <textarea id="c-desc" rows={2} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-mist outline-none focus:border-mystic-400/70" />
        </div>
        <label className="flex items-start gap-2 text-sm text-mist/80">
          <Checkbox checked={own} onChange={(e) => setOwn(e.target.checked)} /> {t('prizes.contest.ownWork')}
        </label>
        <Button type="submit" disabled={!file || !title.trim() || !own} loading={send.isPending}><Upload /> {t('prizes.contest.send')}</Button>
        {send.isError && <p role="alert" className="text-sm text-red-300">{errorMessage(send.error, t)}</p>}
      </div>
      <div className="grid place-items-center overflow-hidden rounded-xl bg-black/30 text-xs text-mist/40">
        {preview ? <img src={preview} alt={t('prizes.contest.preview')} className="max-h-60 w-full object-contain" /> : t('prizes.contest.preview')}
      </div>
    </form>
  );
}

export default function ContestPage() {
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const locale = currentLocale();
  const { session } = useAuth();
  const qc = useQueryClient();
  const key = ['contests', slug, session?.user.id ?? 'anon'];
  const contest = useQuery({ queryKey: key, queryFn: ({ signal }) => api<ContestDetail>(`/v1/contests/${slug}`, { signal }) });
  const set = (d: ContestDetail) => qc.setQueryData(key, d);
  const vote = useMutation({ mutationFn: (entryId: string) => api<ContestDetail>(`/v1/contests/${slug}/vote`, { method: 'PUT', body: { entryId } }), onSuccess: set });
  const withdraw = useMutation({ mutationFn: () => api<ContestDetail>(`/v1/contests/${slug}/entries/mine`, { method: 'DELETE' }), onSuccess: set });

  if (contest.isPending) return <div className="mx-auto max-w-5xl px-4 py-12"><Skeleton className="h-96" /></div>;
  if (contest.isError) return <div className="mx-auto max-w-5xl px-4 py-12"><ErrorState error={contest.error} /></div>;
  const c = contest.data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Link to="/premios" className="inline-flex items-center gap-2 text-sm text-mist/60 hover:text-mist"><ArrowLeft className="size-4" /> {t('prizes.title')}</Link>
      <div className="mt-4 flex flex-wrap items-center gap-2"><PhaseBadge phase={c.phase} /><Badge variant="mystic">{t('prizes.contests.free')}</Badge></div>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-wide">{localized(c.title, locale)}</h1>
      <p className="mt-2 text-mist/70">{localized(c.description, locale)}</p>
      <dl className="mt-4 grid gap-2 text-sm text-mist/70 sm:grid-cols-3">
        <div><dt className="text-xs text-mist/50">{t('prizes.contest.submissionsUntil')}</dt><dd>{when(c.submissionsCloseAt, locale)}</dd></div>
        <div><dt className="text-xs text-mist/50">{t('prizes.contest.votingUntil')}</dt><dd>{when(c.votingCloseAt, locale)}</dd></div>
        <div><dt className="text-xs text-mist/50">{t('prizes.contest.prize')}</dt><dd className="text-gold-200"><Gift className="mr-1 inline size-4" />{localized(c.prize, locale)}</dd></div>
      </dl>
      <p className="mt-2 text-xs text-mist/45">{t('prizes.contest.brandNote')}</p>

      <details className="glass mt-6 rounded-2xl p-5">
        <summary className="cursor-pointer select-none font-semibold">{t('prizes.contest.rules')}</summary>
        <p className="mt-3 whitespace-pre-line text-sm text-mist/75">{localized(c.rules, locale)}</p>
        <p className="mt-3 text-xs text-mist/50">{t('prizes.contest.legal')}</p>
      </details>

      {c.winner && (
        <Alert variant="success" className="mt-6"><Trophy className="size-5 shrink-0" /> {t('prizes.contest.winner', { title: c.winner.title, name: c.winner.name })}</Alert>
      )}

      <section className="mt-8" aria-labelledby="my-entry">
        <h2 id="my-entry" className="font-display text-xl font-bold">{t('prizes.contest.yourEntry')}</h2>
        <div className="mt-3">
          {c.myEntry ? (
            <Card className="flex flex-wrap items-center gap-4 rounded-2xl p-4">
              <img src={c.myEntry.thumbDataUrl} alt={c.myEntry.title} className="h-24 rounded-lg object-cover" />
              <div className="flex-1">
                <p className="font-semibold">{c.myEntry.title}</p>
                <p className="text-sm text-mist/65">{t(`prizes.contest.entryStatus.${c.myEntry.status}`)}</p>
              </div>
              {c.phase === 'submissions' && c.myEntry.status !== 'rejected' && (
                <Button size="sm" variant="ghost" loading={withdraw.isPending} onClick={() => { if (window.confirm(t('prizes.contest.withdrawConfirm'))) withdraw.mutate(); }}>{t('prizes.contest.withdraw')}</Button>
              )}
            </Card>
          ) : null}
          {c.canSubmit ? (
            <div className="mt-3"><SubmitForm slug={slug} onDone={set} /></div>
          ) : !c.myEntry || c.myEntry.status === 'rejected' ? (
            <p className="text-sm text-mist/60">
              {t(`prizes.contest.blocked.${c.submitBlockReason ?? 'closed'}`)}{' '}
              {c.submitBlockReason === 'sign_in' && <Link to="/login" className="underline">{t('nav.signIn')}</Link>}
              {c.submitBlockReason === 'email_not_verified' && <Link to="/confirm-email" className="underline">{t('verify.howTo')}</Link>}
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="gallery">
        <h2 id="gallery" className="font-display text-xl font-bold">{t('prizes.contest.gallery', { count: c.entries.length })}</h2>
        {c.phase === 'voting' && <p className="mt-1 text-sm text-mist/60">{session ? t('prizes.contest.voteHint') : t('prizes.contest.voteSignIn')}</p>}
        <div className="mt-4">
          {c.entries.length === 0 ? <EmptyState>{t('prizes.contest.noEntries')}</EmptyState> : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {c.entries.map((e) => {
                const voted = c.myVote === e.id;
                const isWinner = c.winner?.entryId === e.id;
                return (
                  <li key={e.id} className={cn('glass overflow-hidden rounded-2xl', isWinner && 'ring-2 ring-gold-300', voted && 'ring-2 ring-emerald-300/70')}>
                    <a href={`${env.apiUrl}${e.imagePath}`} target="_blank" rel="noopener noreferrer">
                      <img src={`${env.apiUrl}${e.thumbPath}`} alt={e.title} loading="lazy" className="aspect-video w-full bg-black/40 object-cover" />
                    </a>
                    <div className="p-4">
                      <p className="flex items-center gap-2 font-semibold">{isWinner && <Trophy className="size-4 text-gold-300" />}{e.title}</p>
                      <p className="text-xs text-mist/55"><PlanName name={e.author.displayName ?? e.author.username ?? '—'} plan={e.author.plan} /> · {e.width}×{e.height}</p>
                      {e.description && <p className="mt-1 text-sm text-mist/65">{e.description}</p>}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        {e.voteCount !== null && <span className="text-sm font-semibold">{t('prizes.contest.votes', { count: e.voteCount })}</span>}
                        {c.phase === 'voting' && session && !e.mine && (
                          <Button size="sm" variant={voted ? 'gold' : 'glass'} loading={vote.isPending && vote.variables === e.id} onClick={() => vote.mutate(e.id)} aria-pressed={voted}>
                            {voted ? <><Check /> {t('prizes.contest.yourVote')}</> : <><Heart /> {t('prizes.contest.vote')}</>}
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {vote.isError && <p role="alert" className="mt-3 text-sm text-red-300">{errorMessage(vote.error, t)}</p>}
        </div>
      </section>
    </div>
  );
}
