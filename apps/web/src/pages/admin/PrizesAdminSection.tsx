import type { AdminContest, AdminDraw } from '@fandom/types';
import { Alert, Badge, Button, Input, Label, Select, Skeleton } from '@fandom/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Gift, Image as ImageIcon, Lock, Play, Ticket, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { EmptyState, ErrorState } from '@/components/states';
import { useUniverses } from '@/hooks/data';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';

const L = (pt: string) => ({ 'pt-BR': pt.trim(), en: pt.trim() });
const toIso = (local: string) => new Date(local).toISOString();
const textarea = 'mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-mist outline-none focus:border-mystic-400/70';

function PrizeCodeForm({ prizeId, label }: { prizeId: string; label: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const save = useMutation({
    mutationFn: () => api(`/v1/admin/prizes/${prizeId}/code`, { method: 'PUT', body: { code: code.trim() } }),
    onSuccess: () => {
      setCode('');
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });
  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim().length >= 4) save.mutate(); }}>
      <Label htmlFor={`code-${prizeId}`} className="sr-only">{label}</Label>
      <Input id={`code-${prizeId}`} placeholder={label} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" className="h-9 w-56" />
      <Button size="sm" type="submit" loading={save.isPending} disabled={code.trim().length < 4}><Gift /> {t('admin.prizes.deliver')}</Button>
      {save.isError && <span role="alert" className="text-xs text-red-300">{errorMessage(save.error, t)}</span>}
    </form>
  );
}

function DrawsAdmin() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const qc = useQueryClient();
  const draws = useQuery({ queryKey: ['admin', 'draws'], queryFn: ({ signal }) => api<{ items: AdminDraw[] }>('/v1/admin/draws', { signal }).then((r) => r.items) });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin', 'draws'] });
  const [f, setF] = useState({ title: '', description: '', prize: '1 chave Steam de jogo aleatório', count: '1', closes: '', certificate: '', regulation: '' });
  const create = useMutation({
    mutationFn: () => api('/v1/admin/draws', { method: 'POST', body: {
      title: L(f.title), description: L(f.description), prize: L(f.prize), prizeCount: Number(f.count), entriesCloseAt: toIso(f.closes),
      certificateNumber: f.certificate.trim() || null, regulationUrl: f.regulation.trim() || null,
    } }),
    onSuccess: () => { refresh(); setF({ ...f, title: '', description: '', certificate: '', regulation: '' }); },
  });
  const action = useMutation({
    mutationFn: (v: { id: string; op: 'open' | 'cancel' | 'run'; body?: unknown; patch?: unknown }) =>
      v.patch ? api(`/v1/admin/draws/${v.id}`, { method: 'PATCH', body: v.patch }) : api(`/v1/admin/draws/${v.id}/${v.op}`, { method: 'POST', body: v.body }),
    onSuccess: refresh,
  });
  const [extra, setExtra] = useState<Record<string, { certificate: string; regulation: string; external: string }>>({});
  const ex = (id: string) => extra[id] ?? { certificate: '', regulation: '', external: '' };
  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate(); };

  return (
    <section className="mt-12" aria-labelledby="admin-draws">
      <h2 id="admin-draws" className="flex items-center gap-2 font-display text-2xl font-bold"><Ticket className="size-5 text-emerald-300" /> {t('admin.prizes.draws')}</h2>
      <Alert variant="warning" className="mt-3"><Lock className="size-4 shrink-0" /> {t('admin.prizes.lockNote')}</Alert>
      <form onSubmit={submit} className="glass mt-4 grid gap-3 rounded-2xl p-5 sm:grid-cols-2" aria-label={t('admin.prizes.newDraw')}>
        <div><Label htmlFor="d-title">{t('admin.prizes.title')}</Label><Input id="d-title" className="mt-1.5" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div><Label htmlFor="d-prize">{t('admin.prizes.prize')}</Label><Input id="d-prize" className="mt-1.5" required value={f.prize} onChange={(e) => setF({ ...f, prize: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label htmlFor="d-desc">{t('admin.prizes.description')}</Label><textarea id="d-desc" required rows={2} className={textarea} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div><Label htmlFor="d-count">{t('admin.prizes.count')}</Label><Input id="d-count" type="number" min={1} max={100} className="mt-1.5" value={f.count} onChange={(e) => setF({ ...f, count: e.target.value })} /></div>
        <div><Label htmlFor="d-closes">{t('admin.prizes.closes')}</Label><Input id="d-closes" type="datetime-local" required className="mt-1.5" value={f.closes} onChange={(e) => setF({ ...f, closes: e.target.value })} /></div>
        <div><Label htmlFor="d-cert">{t('admin.prizes.certificate')}</Label><Input id="d-cert" className="mt-1.5" placeholder="SPA/MF nº…" value={f.certificate} onChange={(e) => setF({ ...f, certificate: e.target.value })} /></div>
        <div><Label htmlFor="d-reg">{t('admin.prizes.regulation')}</Label><Input id="d-reg" type="url" className="mt-1.5" placeholder="https://…" value={f.regulation} onChange={(e) => setF({ ...f, regulation: e.target.value })} /></div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" loading={create.isPending}>{t('admin.prizes.saveDraft')}</Button>
          {create.isError && <p role="alert" className="text-sm text-red-300">{errorMessage(create.error, t)}</p>}
        </div>
      </form>
      <div className="mt-4">
        {draws.isPending ? <Skeleton className="h-24" /> : draws.isError ? <ErrorState error={draws.error} /> : draws.data.length === 0 ? <EmptyState>{t('admin.prizes.noDraws')}</EmptyState> : (
          <ul className="space-y-3">
            {draws.data.map((d) => (
              <li key={d.id} className="glass rounded-2xl p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={d.status === 'open' ? 'success' : d.status === 'cancelled' ? 'danger' : 'default'}>{t(`admin.prizes.status.${d.phase}`)}</Badge>
                  <p className="font-semibold">{localized(d.title, locale)}</p>
                  <span className="text-xs text-mist/50">{t('admin.prizes.entries', { count: d.entryCount })}</span>
                  {d.status !== 'draft' && <Link to={`/sorteios/${d.id}`} className="text-xs text-mystic-300 underline">{t('admin.prizes.publicPage')}</Link>}
                </div>
                {d.status === 'draft' && (
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    {(!d.certificateNumber || !d.regulationUrl) && (
                      <>
                        <Input aria-label={t('admin.prizes.certificate')} placeholder={t('admin.prizes.certificate')} className="h-9 w-48" value={ex(d.id).certificate} onChange={(e) => setExtra({ ...extra, [d.id]: { ...ex(d.id), certificate: e.target.value } })} />
                        <Input aria-label={t('admin.prizes.regulation')} placeholder="https://…" className="h-9 w-56" value={ex(d.id).regulation} onChange={(e) => setExtra({ ...extra, [d.id]: { ...ex(d.id), regulation: e.target.value } })} />
                        <Button size="sm" variant="glass" disabled={!ex(d.id).certificate.trim() && !ex(d.id).regulation.trim()}
                          onClick={() => action.mutate({ id: d.id, op: 'open', patch: {
                            ...(ex(d.id).certificate.trim() && { certificateNumber: ex(d.id).certificate.trim() }),
                            ...(ex(d.id).regulation.trim() && { regulationUrl: ex(d.id).regulation.trim() }),
                          } })}>{t('admin.prizes.saveAuth')}</Button>
                      </>
                    )}
                    <Button size="sm" variant="gold" disabled={!d.certificateNumber || !d.regulationUrl} onClick={() => action.mutate({ id: d.id, op: 'open' })}><Play /> {t('admin.prizes.open')}</Button>
                    <Button size="sm" variant="ghost" onClick={() => action.mutate({ id: d.id, op: 'cancel' })}>{t('admin.prizes.cancel')}</Button>
                  </div>
                )}
                {d.phase === 'closed' && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input aria-label={t('admin.prizes.external')} placeholder={t('admin.prizes.external')} className="h-9 w-72" value={ex(d.id).external} onChange={(e) => setExtra({ ...extra, [d.id]: { ...ex(d.id), external: e.target.value } })} />
                    <Button size="sm" variant="gold" disabled={!ex(d.id).external.trim()} onClick={() => { if (window.confirm(t('admin.prizes.runConfirm'))) action.mutate({ id: d.id, op: 'run', body: { externalValue: ex(d.id).external.trim() } }); }}>
                      <Ticket /> {t('admin.prizes.run')}
                    </Button>
                  </div>
                )}
                {d.phase === 'open' && <Button size="sm" variant="ghost" className="mt-2" onClick={() => action.mutate({ id: d.id, op: 'cancel' })}>{t('admin.prizes.cancel')}</Button>}
                {d.winners.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {d.winners.map((w) => (
                      <li key={w.position} className="flex flex-wrap items-center gap-3 rounded-xl bg-white/[0.04] p-3 text-sm">
                        <span>{w.position}º · {w.name} · {w.email} · nº {w.luckyNumber}</span>
                        {w.delivered ? <Badge variant="success"><Check className="size-3" /> {t('admin.prizes.delivered')}</Badge> : <PrizeCodeForm prizeId={w.prizeId} label={t('admin.prizes.steamKey')} />}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
        {action.isError && <p role="alert" className="mt-2 text-sm text-red-300">{errorMessage(action.error, t)}</p>}
      </div>
    </section>
  );
}

function ContestsAdmin({ canDecide }: { canDecide: boolean }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const qc = useQueryClient();
  const universes = useUniverses();
  const contests = useQuery({ queryKey: ['admin', 'contests'], queryFn: ({ signal }) => api<{ items: AdminContest[] }>('/v1/admin/contests', { signal }).then((r) => r.items) });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin', 'contests'] });
  const [f, setF] = useState({ slug: '', title: '', description: '', rules: '', prize: '1 mês de Crunchyroll (vale-presente)', universe: 'animes', open: '', close: '', voting: '' });
  const create = useMutation({
    mutationFn: () => api('/v1/admin/contests', { method: 'POST', body: {
      slug: f.slug.trim(), title: L(f.title), description: L(f.description), rules: L(f.rules), prize: L(f.prize), universeSlug: f.universe || null,
      submissionsOpenAt: toIso(f.open), submissionsCloseAt: toIso(f.close), votingCloseAt: toIso(f.voting),
    } }),
    onSuccess: () => { refresh(); setF({ ...f, slug: '', title: '', description: '' }); },
  });
  const act = useMutation({
    mutationFn: (v: { path: string; body?: unknown }) => api(v.path, { method: 'POST', body: v.body }),
    onSuccess: refresh,
  });

  return (
    <section className="mt-12" aria-labelledby="admin-contests">
      <h2 id="admin-contests" className="flex items-center gap-2 font-display text-2xl font-bold"><ImageIcon className="size-5 text-mystic-300" /> {t('admin.prizes.contests')}</h2>
      <p className="mt-1 text-sm text-mist/60">{t('admin.prizes.contestNote')}</p>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="glass mt-4 grid gap-3 rounded-2xl p-5 sm:grid-cols-2" aria-label={t('admin.prizes.newContest')}>
        <div><Label htmlFor="c-slug">{t('admin.prizes.slug')}</Label><Input id="c-slug" className="mt-1.5" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="wallpaper-dezembro" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} /></div>
        <div><Label htmlFor="c-ttl">{t('admin.prizes.title')}</Label><Input id="c-ttl" className="mt-1.5" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label htmlFor="c-dsc">{t('admin.prizes.description')}</Label><textarea id="c-dsc" required rows={2} className={textarea} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label htmlFor="c-rules">{t('admin.prizes.rules')}</Label><textarea id="c-rules" required rows={4} className={textarea} placeholder={t('admin.prizes.rulesHint')} value={f.rules} onChange={(e) => setF({ ...f, rules: e.target.value })} /></div>
        <div><Label htmlFor="c-prize">{t('admin.prizes.prize')}</Label><Input id="c-prize" className="mt-1.5" required value={f.prize} onChange={(e) => setF({ ...f, prize: e.target.value })} /></div>
        <div>
          <Label htmlFor="c-uni">{t('admin.prizes.universe')}</Label>
          <Select id="c-uni" className="mt-1.5" value={f.universe} onChange={(e) => setF({ ...f, universe: e.target.value })}>
            <option value="">{t('admin.prizes.allUniverses')}</option>
            {universes.data?.map((u) => <option key={u.slug} value={u.slug}>{localized(u.name, locale)}</option>)}
          </Select>
        </div>
        <div><Label htmlFor="c-open">{t('admin.prizes.submissionsOpen')}</Label><Input id="c-open" type="datetime-local" required className="mt-1.5" value={f.open} onChange={(e) => setF({ ...f, open: e.target.value })} /></div>
        <div><Label htmlFor="c-close">{t('admin.prizes.submissionsClose')}</Label><Input id="c-close" type="datetime-local" required className="mt-1.5" value={f.close} onChange={(e) => setF({ ...f, close: e.target.value })} /></div>
        <div><Label htmlFor="c-vote">{t('admin.prizes.votingClose')}</Label><Input id="c-vote" type="datetime-local" required className="mt-1.5" value={f.voting} onChange={(e) => setF({ ...f, voting: e.target.value })} /></div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" loading={create.isPending}>{t('admin.prizes.saveDraft')}</Button>
          {create.isError && <p role="alert" className="text-sm text-red-300">{errorMessage(create.error, t)}</p>}
        </div>
      </form>
      <div className="mt-4">
        {contests.isPending ? <Skeleton className="h-24" /> : contests.isError ? <ErrorState error={contests.error} /> : contests.data.length === 0 ? <EmptyState>{t('admin.prizes.noContests')}</EmptyState> : (
          <ul className="space-y-3">
            {contests.data.map((c) => (
              <li key={c.id} className="glass rounded-2xl p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{t(`prizes.phases.${c.status === 'draft' ? 'draft' : c.phase}`)}</Badge>
                  <p className="font-semibold">{localized(c.title, locale)}</p>
                  {c.status !== 'draft' && <Link to={`/concursos/${c.slug}`} className="text-xs text-mystic-300 underline">{t('admin.prizes.publicPage')}</Link>}
                  {c.status === 'draft' && <Button size="sm" variant="gold" onClick={() => act.mutate({ path: `/v1/admin/contests/${c.id}/publish` })}>{t('admin.prizes.publish')}</Button>}
                  {(c.status === 'draft' || c.status === 'published') && <Button size="sm" variant="ghost" onClick={() => act.mutate({ path: `/v1/admin/contests/${c.id}/cancel` })}>{t('admin.prizes.cancel')}</Button>}
                </div>
                {c.pending.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold">{t('admin.prizes.pending', { count: c.pending.length })}</p>
                    <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                      {c.pending.map((e) => (
                        <li key={e.id} className="flex gap-3 rounded-xl bg-white/[0.04] p-3">
                          <img src={e.thumbDataUrl} alt={e.title} className="h-20 w-32 rounded object-cover" />
                          <div className="min-w-0 flex-1 text-sm">
                            <p className="truncate font-semibold">{e.title}</p>
                            <p className="text-xs text-mist/55">{e.author}</p>
                            <div className="mt-2 flex gap-2">
                              <Button size="sm" variant="glass" aria-label={t('admin.prizes.approve')} onClick={() => act.mutate({ path: `/v1/admin/contest-entries/${e.id}/review`, body: { action: 'approve' } })}><Check /></Button>
                              <Button size="sm" variant="ghost" aria-label={t('admin.prizes.reject')} onClick={() => act.mutate({ path: `/v1/admin/contest-entries/${e.id}/review`, body: { action: 'reject' } })}><X /></Button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {c.ranking.length > 0 && (
                  <ol className="mt-3 space-y-1.5 text-sm">
                    {c.ranking.map((e, i) => (
                      <li key={e.id} className="flex flex-wrap items-center gap-2">
                        <span className="w-6 text-mist/50">{i + 1}º</span>
                        <span className="flex-1">{e.title} · {e.author}</span>
                        <span className="tabular-nums">{t('prizes.contest.votes', { count: e.voteCount })}</span>
                        {canDecide && c.phase === 'judging' && (
                          <Button size="sm" variant="gold" onClick={() => { if (window.confirm(t('admin.prizes.winnerConfirm', { title: e.title }))) act.mutate({ path: `/v1/admin/contests/${c.id}/winner`, body: { entryId: e.id } }); }}>{t('admin.prizes.declareWinner')}</Button>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
                {c.winner && c.prizeId && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    <span>{t('prizes.contest.winner', { title: c.winner.title, name: c.winner.name })}</span>
                    {c.prizeDelivered ? <Badge variant="success"><Check className="size-3" /> {t('admin.prizes.delivered')}</Badge> : canDecide && <PrizeCodeForm prizeId={c.prizeId} label={t('admin.prizes.giftCode')} />}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {act.isError && <p role="alert" className="mt-2 text-sm text-red-300">{errorMessage(act.error, t)}</p>}
      </div>
    </section>
  );
}

/** Prize draws (admin only) and cultural contests (admin/editor; moderators review entries). */
export function PrizesAdminSection({ isAdmin }: { isAdmin: boolean }) {
  return (
    <>
      <ContestsAdmin canDecide={isAdmin} />
      {isAdmin && <DrawsAdmin />}
    </>
  );
}
