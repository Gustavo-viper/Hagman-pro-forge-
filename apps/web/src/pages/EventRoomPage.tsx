import type { EventMessage, EventRoom } from '@fandom/types';
import { Alert, Badge, Button, Card, cn, Skeleton } from '@fandom/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Brain, CalendarClock, ExternalLink, Medal, Radio, Send, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ErrorState } from '@/components/states';
import { universeStyle } from '@/components/UniverseCard';
import { AuthorLine } from '@/components/universe/CommunityTab';
import { useUniverse } from '@/hooks/data';
import { useEventStream } from '@/hooks/useEventStream';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';

function useCountdown(target: string | undefined): string | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!target) return null;
  const ms = new Date(target).getTime() - now;
  if (ms <= 0) return null;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${d > 0 ? `${d}d ` : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function EventRoomPage() {
  const { slug = '', eventId = '' } = useParams();
  const { t } = useTranslation();
  const locale = currentLocale();
  const qc = useQueryClient();
  const universe = useUniverse(slug);
  const key = ['event-room', eventId];
  const room = useQuery({ queryKey: key, queryFn: ({ signal }) => api<EventRoom>(`/v1/events/${eventId}/room`, { signal }), staleTime: 0, refetchOnMount: 'always' });
  const [messages, setMessages] = useState<EventMessage[]>([]);
  const [body, setBody] = useState('');
  const [live, setLive] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const countdown = useCountdown(room.data && !room.data.open ? room.data.opensAt : undefined);

  useEffect(() => {
    if (room.data) setMessages(room.data.messages);
  }, [room.data]);
  // Re-fetch the moment the room opens (timer up to ~24 days; setTimeout's max).
  const opensAt = room.data && !room.data.open ? room.data.opensAt : null;
  const { refetch } = room;
  useEffect(() => {
    if (!opensAt) return;
    const ms = new Date(opensAt).getTime() - Date.now();
    if (ms <= 0 || ms > 2_000_000_000) return;
    const id = setTimeout(() => void refetch(), ms + 500);
    return () => clearTimeout(id);
  }, [opensAt, refetch]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  useEventStream(`/v1/events/${eventId}/room/stream`, Boolean(room.data?.open), (ev) => {
    if (ev.type === 'ready') setLive(true);
    if (ev.type === 'message') {
      const m = ev.message as EventMessage;
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    }
    if (ev.type === 'removed') setMessages((prev) => prev.filter((x) => x.id !== ev.id));
    if (ev.type === 'leaderboard-changed' || ev.type === 'cancelled') void qc.invalidateQueries({ queryKey: key });
  });

  const send = useMutation({
    mutationFn: () => api<EventMessage>(`/v1/events/${eventId}/room/messages`, { method: 'POST', body: { body: body.trim() } }),
    onSuccess: (m) => {
      setBody('');
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/v1/events/${eventId}/room/messages/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => setMessages((prev) => prev.filter((x) => x.id !== id)),
  });

  if (room.isPending || universe.isPending) return <div className="mx-auto max-w-5xl px-4 py-10"><Skeleton className="h-96" /></div>;
  if (room.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState error={room.error} />
        <Button asChild variant="glass" className="mt-4"><Link to={`/universes/${slug}?tab=events`}>{t('eventRoom.backToEvents')}</Link></Button>
      </div>
    );
  }
  if (universe.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState error={universe.error} /></div>;
  const r = room.data;
  const u = universe.data;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (body.trim()) send.mutate();
  };

  return (
    <div style={universeStyle(u.theme)} className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link to={`/universes/${slug}?tab=events`} className="inline-flex items-center gap-2 text-sm text-mist/60 hover:text-mist">
        <ArrowLeft className="size-4" /> {localized(u.name, locale)} · {t('universe.tabs.events')}
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold tracking-wide">{localized(r.event.title, locale)}</h1>
        {r.event.status === 'cancelled' ? <Badge variant="danger">{t('eventRoom.cancelled')}</Badge> : r.open ? (
          <Badge variant="success"><Radio className="size-3" /> {live ? t('eventRoom.live') : t('eventRoom.open')}</Badge>
        ) : <Badge>{t('eventRoom.closed')}</Badge>}
      </div>
      <p className="mt-2 text-mist/65">{localized(r.event.description, locale)}</p>
      <p className="mt-2 text-sm text-mist/50">
        {new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short' }).format(new Date(r.event.startsAt))}
      </p>

      {r.event.status === 'cancelled' ? (
        <Alert variant="danger" className="mt-8">{t('eventRoom.cancelledInfo')}</Alert>
      ) : !r.open ? (
        <Card className="mt-8 rounded-3xl p-8 text-center">
          <CalendarClock className="mx-auto size-10 text-[color:var(--u-glow)]" />
          {countdown ? (
            <>
              <p className="mt-4 text-sm uppercase tracking-[0.3em] text-mist/55">{t('eventRoom.opensIn')}</p>
              <p className="mt-2 font-display text-5xl font-bold tabular-nums">{countdown}</p>
              <p className="mt-4 text-sm text-mist/60">{t('eventRoom.reminders')}</p>
            </>
          ) : <p className="mt-4 text-mist/70">{t('eventRoom.ended')}</p>}
        </Card>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card className="flex h-[560px] flex-col rounded-3xl p-0">
            <div className="border-b border-white/10 px-5 py-3 text-sm font-semibold">{t('eventRoom.chat')}</div>
            <ul ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
              {messages.length === 0 && <li className="text-sm text-mist/50">{t('eventRoom.noMessages')}</li>}
              {messages.map((m) => (
                <li key={m.id} className={cn('group rounded-xl px-3 py-2', m.mine ? 'bg-[color:var(--u-primary)]/25' : 'bg-white/[0.04]')}>
                  <div className="flex items-start justify-between gap-2">
                    <AuthorLine author={m.author} at={m.createdAt} universe={u} />
                    {(m.mine || r.canModerate) && (
                      <button type="button" aria-label={t('sections.delete')} onClick={() => remove.mutate(m.id)} className="text-mist/30 opacity-0 transition group-hover:opacity-100 hover:text-red-300">
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-mist/90">{m.body}</p>
                </li>
              ))}
            </ul>
            <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-3">
              <label htmlFor="chat-input" className="sr-only">{t('eventRoom.message')}</label>
              <input
                id="chat-input"
                value={body}
                maxLength={500}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t('eventRoom.message')}
                className="h-11 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-mist outline-none focus:border-mystic-400/70"
              />
              <Button type="submit" size="icon" aria-label={t('eventRoom.send')} disabled={!body.trim()} loading={send.isPending}><Send /></Button>
            </form>
            {send.isError && <p role="alert" className="px-4 pb-3 text-xs text-red-300">{errorMessage(send.error, t)}</p>}
          </Card>

          <div className="space-y-6">
            {r.externalUrl && (
              <Card className="rounded-3xl p-5">
                <p className="text-sm text-mist/65">{t('eventRoom.externalInfo')}</p>
                <Button asChild variant="gold" className="mt-3 w-full">
                  <a href={r.externalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink /> {t('eventRoom.openExternal')}</a>
                </Button>
              </Card>
            )}
            {r.quiz && (
              <Card className="rounded-3xl p-5">
                <h2 className="flex items-center gap-2 font-semibold"><Brain className="size-4" /> {localized(r.quiz.title, locale)}</h2>
                <p className="mt-1 text-sm text-mist/60">{t('eventRoom.quizInfo', { count: r.quiz.questionCount })}</p>
                <Button asChild className="mt-3 w-full"><Link to={`/universes/${slug}/quizzes/${r.quiz.id}?event=${eventId}`}>{t('eventRoom.playQuiz')}</Link></Button>
                <h3 className="mt-5 text-sm font-semibold text-mist/80">{t('eventRoom.scoreboard')}</h3>
                {r.leaderboard.length === 0 ? <p className="mt-2 text-sm text-mist/50">{t('eventRoom.noScores')}</p> : (
                  <ol className="mt-2 space-y-1.5">
                    {r.leaderboard.slice(0, 10).map((l) => (
                      <li key={l.userId} className="flex items-center gap-3 text-sm">
                        <span className={cn('grid size-7 place-items-center rounded-full text-xs font-bold', l.rank <= 3 ? 'bg-gold-400/20 text-gold-200' : 'bg-white/5 text-mist/60')}>
                          {l.rank <= 3 ? <Medal className="size-3.5" /> : l.rank}
                        </span>
                        <span className="flex-1 truncate">{l.displayName ?? l.username}</span>
                        <span className="font-semibold">{l.score}/{l.total}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
