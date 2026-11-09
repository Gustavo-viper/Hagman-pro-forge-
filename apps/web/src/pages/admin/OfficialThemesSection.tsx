import type { UniverseSummary } from '@fandom/types';
import { Alert, Button, Input, Label, Skeleton } from '@fandom/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Music2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUniverses } from '@/hooks/data';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';

function ThemeRow({ u }: { u: UniverseSummary }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const o = u.officialTheme;
  const [f, setF] = useState({ url: o ? `https://www.youtube.com/watch?v=${o.youtubeId}` : '', title: o?.title ?? '', artist: o?.artist ?? '' });
  const save = useMutation({
    mutationFn: (theme: typeof f | null) => api<UniverseSummary>(`/v1/universes/${u.slug}/official-theme`, { method: 'PUT', body: { theme } }),
    onSuccess: (next) => {
      if (!next.officialTheme) setF({ url: '', title: '', artist: '' });
      void qc.invalidateQueries({ queryKey: ['universes'] });
    },
  });
  const id = `ot-${u.slug}`;
  return (
    <li className="glass rounded-2xl p-4">
      <p className="font-semibold">{localized(u.name, currentLocale())}</p>
      <form className="mt-2 grid gap-2 sm:grid-cols-[2fr_1.5fr_1fr_auto_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); save.mutate(f); }}>
        <div><Label htmlFor={`${id}-url`} className="text-xs">{t('admin.officialThemes.url')}</Label><Input id={`${id}-url`} className="mt-1 h-9" required placeholder="https://www.youtube.com/watch?v=…" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></div>
        <div><Label htmlFor={`${id}-title`} className="text-xs">{t('admin.officialThemes.song')}</Label><Input id={`${id}-title`} className="mt-1 h-9" required maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div><Label htmlFor={`${id}-artist`} className="text-xs">{t('admin.officialThemes.artist')}</Label><Input id={`${id}-artist`} className="mt-1 h-9" maxLength={120} value={f.artist} onChange={(e) => setF({ ...f, artist: e.target.value })} /></div>
        <Button size="sm" type="submit" loading={save.isPending && save.variables !== null}>{t('admin.officialThemes.save')}</Button>
        {o ? <Button size="sm" type="button" variant="ghost" onClick={() => save.mutate(null)}>{t('admin.officialThemes.remove')}</Button> : <span />}
      </form>
      {save.isError && <p role="alert" className="mt-2 text-xs text-red-300">{errorMessage(save.error, t)}</p>}
      {save.isSuccess && <p role="status" className="mt-2 text-xs text-emerald-300">{t('admin.officialThemes.saved')}</p>}
    </li>
  );
}

/** Official theme songs: YouTube links from the rights holders, played in the universe's player. */
export function OfficialThemesSection() {
  const { t } = useTranslation();
  const universes = useUniverses();
  return (
    <section className="mt-12" aria-labelledby="admin-official-themes">
      <h2 id="admin-official-themes" className="flex items-center gap-2 font-display text-2xl font-bold"><Music2 className="size-5 text-mystic-300" /> {t('admin.officialThemes.title')}</h2>
      <Alert variant="info" className="mt-3">{t('admin.officialThemes.note')}</Alert>
      {universes.isPending ? <Skeleton className="mt-4 h-40" /> : (
        <ul className="mt-4 space-y-3">{universes.data?.map((u) => <ThemeRow key={u.slug} u={u} />)}</ul>
      )}
    </section>
  );
}
