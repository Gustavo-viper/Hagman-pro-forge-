import type { AdminEvent } from '@fandom/types';
import { Badge, Button, Input, Label, Select, Skeleton } from '@fandom/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CalendarPlus, Pencil, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { EmptyState, ErrorState } from '@/components/states';
import { useUniverseQuizzes, useUniverses } from '@/hooks/data';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatDate, localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';

const KINDS = ['community', 'tournament', 'watch_party', 'challenge'] as const;

interface FormState {
  universeSlug: string;
  titlePt: string;
  titleEn: string;
  descPt: string;
  descEn: string;
  kind: (typeof KINDS)[number];
  startsAt: string;
  endsAt: string;
  capacity: string;
  premiumPlan: '' | 'plus' | 'ultra';
  externalUrl: string;
  quizId: string;
}

/** ISO → value for <input type="datetime-local"> in the browser's timezone. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const empty = (): FormState => ({
  universeSlug: '', titlePt: '', titleEn: '', descPt: '', descEn: '', kind: 'community',
  startsAt: '', endsAt: '', capacity: '', premiumPlan: '', externalUrl: '', quizId: '',
});

function fromEvent(e: AdminEvent): FormState {
  return {
    universeSlug: e.universeSlug,
    titlePt: e.title['pt-BR'] ?? '',
    titleEn: e.title.en ?? '',
    descPt: e.description['pt-BR'] ?? '',
    descEn: e.description.en ?? '',
    kind: e.kind,
    startsAt: toLocalInput(e.startsAt),
    endsAt: toLocalInput(e.endsAt),
    capacity: e.capacity ? String(e.capacity) : '',
    premiumPlan: e.premiumPlan ?? '',
    externalUrl: e.externalUrl ?? '',
    quizId: e.quizId ?? '',
  };
}

function EventForm({ initial, onDone }: { initial: AdminEvent | null; onDone: () => void }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const qc = useQueryClient();
  const [f, setF] = useState<FormState>(initial ? fromEvent(initial) : empty());
  const universes = useUniverses();
  const quizzes = useUniverseQuizzes(f.universeSlug);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      const common = {
        title: { 'pt-BR': f.titlePt.trim(), en: f.titleEn.trim() || f.titlePt.trim() },
        description: { 'pt-BR': f.descPt.trim(), en: f.descEn.trim() || f.descPt.trim() },
        startsAt: new Date(f.startsAt).toISOString(),
        endsAt: new Date(f.endsAt).toISOString(),
        capacity: f.capacity ? Number(f.capacity) : null,
        premiumPlan: f.premiumPlan || null,
        externalUrl: f.externalUrl.trim() || null,
        quizId: f.quizId || null,
      };
      return initial
        ? api<AdminEvent>(`/v1/admin/events/${initial.id}`, { method: 'PATCH', body: common })
        : api<AdminEvent>('/v1/admin/events', { method: 'POST', body: { ...common, universeSlug: f.universeSlug, kind: f.kind } });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'events'] });
      void qc.invalidateQueries({ queryKey: ['universes'] });
      onDone();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  const field = 'mt-1.5';
  return (
    <form onSubmit={submit} className="glass mt-4 grid gap-4 rounded-2xl p-5 sm:grid-cols-2" aria-label={initial ? t('admin.events.edit') : t('admin.events.create')}>
      <div>
        <Label htmlFor="ev-universe">{t('admin.events.universe')}</Label>
        <Select id="ev-universe" className={field} required disabled={Boolean(initial)} value={f.universeSlug} onChange={(e) => { set('universeSlug', e.target.value); set('quizId', ''); }}>
          <option value="">{t('admin.events.choose')}</option>
          {universes.data?.map((u) => <option key={u.slug} value={u.slug}>{localized(u.name, locale)}</option>)}
        </Select>
      </div>
      <div>
        <Label htmlFor="ev-kind">{t('admin.events.kind')}</Label>
        <Select id="ev-kind" className={field} disabled={Boolean(initial)} value={f.kind} onChange={(e) => set('kind', e.target.value as FormState['kind'])}>
          {KINDS.map((k) => <option key={k} value={k}>{t(`sections.eventKinds.${k}`)}</option>)}
        </Select>
      </div>
      <div>
        <Label htmlFor="ev-title-pt">{t('admin.events.titlePt')}</Label>
        <Input id="ev-title-pt" className={field} required maxLength={120} value={f.titlePt} onChange={(e) => set('titlePt', e.target.value)} />
      </div>
      <div>
        <Label htmlFor="ev-title-en">{t('admin.events.titleEn')}</Label>
        <Input id="ev-title-en" className={field} maxLength={120} value={f.titleEn} onChange={(e) => set('titleEn', e.target.value)} />
      </div>
      <div>
        <Label htmlFor="ev-desc-pt">{t('admin.events.descPt')}</Label>
        <textarea id="ev-desc-pt" required maxLength={1000} rows={3} value={f.descPt} onChange={(e) => set('descPt', e.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-mist outline-none focus:border-mystic-400/70" />
      </div>
      <div>
        <Label htmlFor="ev-desc-en">{t('admin.events.descEn')}</Label>
        <textarea id="ev-desc-en" maxLength={1000} rows={3} value={f.descEn} onChange={(e) => set('descEn', e.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-mist outline-none focus:border-mystic-400/70" />
      </div>
      <div>
        <Label htmlFor="ev-start">{t('admin.events.startsAt')}</Label>
        <Input id="ev-start" type="datetime-local" className={field} required value={f.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
      </div>
      <div>
        <Label htmlFor="ev-end">{t('admin.events.endsAt')}</Label>
        <Input id="ev-end" type="datetime-local" className={field} required value={f.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
      </div>
      <div>
        <Label htmlFor="ev-capacity">{t('admin.events.capacity')}</Label>
        <Input id="ev-capacity" type="number" min={1} className={field} value={f.capacity} onChange={(e) => set('capacity', e.target.value)} placeholder={t('admin.events.unlimited')} />
      </div>
      <div>
        <Label htmlFor="ev-plan">{t('admin.events.plan')}</Label>
        <Select id="ev-plan" className={field} value={f.premiumPlan} onChange={(e) => set('premiumPlan', e.target.value as FormState['premiumPlan'])}>
          <option value="">{t('admin.events.everyone')}</option>
          <option value="plus">Plus</option>
          <option value="ultra">Ultra</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="ev-url">{t('admin.events.externalUrl')}</Label>
        <Input id="ev-url" type="url" className={field} maxLength={500} placeholder="https://meet.google.com/…" value={f.externalUrl} onChange={(e) => set('externalUrl', e.target.value)} />
        <p className="mt-1 text-xs text-mist/50">{t('admin.events.externalHint')}</p>
      </div>
      <div>
        <Label htmlFor="ev-quiz">{t('admin.events.quiz')}</Label>
        <Select id="ev-quiz" className={field} value={f.quizId} disabled={!f.universeSlug} onChange={(e) => set('quizId', e.target.value)}>
          <option value="">{t('admin.events.noQuiz')}</option>
          {quizzes.data?.map((q) => <option key={q.id} value={q.id}>{localized(q.title, locale)}</option>)}
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" loading={save.isPending}>{initial ? t('admin.events.save') : t('admin.events.create')}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>{t('admin.events.close')}</Button>
        {save.isError && <p role="alert" className="text-sm text-red-300">{errorMessage(save.error, t)}</p>}
      </div>
    </form>
  );
}

/** Admin events: list, create, edit and cancel (cancel emails every registered member). */
export function EventsSection({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AdminEvent | 'new' | null>(null);
  const events = useQuery({ queryKey: ['admin', 'events'], queryFn: ({ signal }) => api<{ items: AdminEvent[] }>('/v1/admin/events', { signal }).then((r) => r.items) });
  const cancel = useMutation({
    mutationFn: (id: string) => api(`/v1/admin/events/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'events'] });
      void qc.invalidateQueries({ queryKey: ['universes'] });
    },
  });
  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold tracking-wide"><CalendarPlus className="size-5 text-mystic-300" /> {t('admin.events.title')}</h2>
        {canEdit && editing === null && <Button size="sm" onClick={() => setEditing('new')}><CalendarPlus /> {t('admin.events.new')}</Button>}
      </div>
      {editing !== null && <EventForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      <div className="mt-4">
        {events.isPending ? <Skeleton className="h-40" /> : events.isError ? <ErrorState error={events.error} onRetry={() => void events.refetch()} /> : events.data.length === 0 ? (
          <EmptyState>{t('admin.events.empty')}</EmptyState>
        ) : (
          <ul className="space-y-2">
            {events.data.map((e) => {
              const ended = new Date(e.endsAt) < new Date();
              return (
                <li key={e.id} className="glass flex flex-wrap items-center gap-3 rounded-2xl px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      <Link to={`/universes/${e.universeSlug}/events/${e.id}`} className="hover:underline">{localized(e.title, locale)}</Link>
                    </p>
                    <p className="text-xs text-mist/55">{e.universeSlug} · {formatDate(e.startsAt, locale)} · {e.participantCount}{e.capacity ? `/${e.capacity}` : ''} {t('sections.registered')}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {e.status === 'cancelled' ? <Badge variant="danger">{t('eventRoom.cancelled')}</Badge> : ended ? <Badge>{t('sections.ended')}</Badge> : <Badge variant="success">{t('admin.events.scheduled')}</Badge>}
                    {e.quizId && <Badge variant="mystic">{t('eventRoom.hasQuiz')}</Badge>}
                    {e.externalUrl && <Badge variant="mystic">{t('eventRoom.hasLive')}</Badge>}
                    {canEdit && e.status !== 'cancelled' && !ended && (
                      <>
                        <Button size="sm" variant="ghost" aria-label={t('admin.events.edit')} onClick={() => setEditing(e)}><Pencil /></Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={t('admin.events.cancel')}
                          loading={cancel.isPending && cancel.variables === e.id}
                          onClick={() => { if (window.confirm(t('admin.events.confirmCancel'))) cancel.mutate(e.id); }}
                        >
                          <Ban />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {cancel.isError && <p role="alert" className="mt-2 flex items-center gap-1 text-sm text-red-300"><X className="size-4" /> {errorMessage(cancel.error, t)}</p>}
      </div>
    </section>
  );
}
