import type { BookShelf, LoreEntry, ShelfStatus } from '@fandom/types';
import { Badge, cn, Progress } from '@fandom/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked, BookOpen, Check, Clock } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import type { UniverseDetail } from '@/hooks/data';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';

const STATUSES: { key: ShelfStatus; icon: typeof Clock }[] = [
  { key: 'want', icon: Clock },
  { key: 'reading', icon: BookOpen },
  { key: 'read', icon: Check },
];

/** Generated cover: universe colors + title initials (no copyrighted artwork). */
function Cover({ title, index }: { title: string; index: number }) {
  const initials = title.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  return (
    <div
      aria-hidden="true"
      className="relative grid h-32 w-22 shrink-0 place-items-center overflow-hidden rounded-r-lg rounded-l-sm shadow-lg ring-1 ring-white/10"
      style={{ background: `linear-gradient(${135 + index * 23}deg, var(--u-primary), var(--u-secondary, #111))` }}
    >
      <span className="absolute inset-y-0 left-1.5 w-px bg-white/25" />
      <span className="font-display text-2xl font-bold text-white/90 drop-shadow">{initials}</span>
      <span className="absolute bottom-2 h-px w-10 bg-[color:var(--u-accent)]/70" />
    </div>
  );
}

/** Book library of a universe with the personal reading shelf. */
export function BooksView({ universe, books }: { universe: UniverseDetail; books: LoreEntry[] }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const { session } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'mine' | string>('all');
  const key = ['me', 'shelf', universe.slug];
  const shelf = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api<BookShelf>(`/v1/universes/${universe.slug}/books/shelf`, { signal }),
    enabled: Boolean(session),
  });
  const set = useMutation({
    mutationFn: (v: { entryId: string; status: ShelfStatus | null }) => api(`/v1/books/${v.entryId}/shelf`, { method: 'PUT', body: { status: v.status } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  });
  const statusOf = (id: string) => (set.isPending && set.variables?.entryId === id ? set.variables.status : shelf.data?.items.find((i) => i.entryId === id)?.status ?? null);
  const kinds = [...new Set(books.flatMap((b) => b.tags))];
  const shown = books.filter((b) => (filter === 'all' ? true : filter === 'mine' ? statusOf(b.id) !== null : b.tags.includes(filter)));
  const read = shelf.data?.counts.read ?? 0;

  return (
    <div>
      {session && (
        <div className="glass mb-6 rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="flex items-center gap-2 font-semibold"><BookMarked className="size-4 text-[color:var(--u-glow)]" /> {t('books.progress', { read, total: books.length })}</p>
            <p className="text-xs text-mist/55">{t('books.counts', { want: shelf.data?.counts.want ?? 0, reading: shelf.data?.counts.reading ?? 0 })}</p>
          </div>
          <Progress className="mt-2" value={books.length ? read / books.length : 0} label={t('books.progress', { read, total: books.length })} />
        </div>
      )}
      <div className="mb-5 flex flex-wrap gap-2" role="radiogroup" aria-label={t('books.filter')}>
        {['all', ...(session ? ['mine'] : []), ...kinds].map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={filter === f}
            onClick={() => setFilter(f)}
            className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition', filter === f ? 'border-[color:var(--u-accent)] bg-[color:var(--u-primary)]/40 text-white' : 'border-white/10 bg-white/5 text-mist/70 hover:text-mist')}
          >
            {f === 'all' ? t('books.all') : f === 'mine' ? t('books.mine') : t(`books.kinds.${f}`, { defaultValue: f })}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-mist/55">{filter === 'mine' ? t('books.emptyShelf') : t('sections.archiveEmpty')}</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {shown.map((b, i) => {
            const status = statusOf(b.id);
            const title = localized(b.title, locale);
            return (
              <li key={b.id} className="glass flex gap-4 rounded-2xl p-4">
                <Cover title={title} index={i} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {b.tags.map((k) => <Badge key={k} variant="mystic">{t(`books.kinds.${k}`, { defaultValue: k })}</Badge>)}
                    {status && <Badge variant="success">{t(`books.status.${status}`)}</Badge>}
                  </div>
                  <h3 className="mt-2 font-display text-lg font-bold leading-snug">{title}</h3>
                  {b.subtitle && <p className="text-xs text-mist/55">{localized(b.subtitle, locale)}</p>}
                  <p className="mt-2 text-sm text-mist/70">{localized(b.summary, locale)}</p>
                  {session ? (
                    <div className="mt-3 inline-flex flex-wrap gap-1 rounded-xl bg-white/[0.04] p-1" role="group" aria-label={t('books.shelfFor', { title })}>
                      {STATUSES.map(({ key: k, icon: Icon }) => (
                        <button
                          key={k}
                          type="button"
                          aria-pressed={status === k}
                          onClick={() => set.mutate({ entryId: b.id, status: status === k ? null : k })}
                          className={cn('inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition', status === k ? 'bg-[color:var(--u-primary)] text-white' : 'text-mist/65 hover:bg-white/5 hover:text-mist')}
                        >
                          <Icon className="size-3.5" /> {t(`books.status.${k}`)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-mist/50"><Link to="/login" className="underline">{t('books.signIn')}</Link></p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {set.isError && <p role="alert" className="mt-3 text-sm text-red-300">{errorMessage(set.error, t)}</p>}
      <p className="mt-6 text-xs text-mist/45">{t('books.note')}</p>
    </div>
  );
}
