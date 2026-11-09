import { cn } from '@fandom/ui';
import { ExternalLink, Music2, Volume2, VolumeX, X, MonitorPlay } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { universeStyle } from '@/components/UniverseCard';
import { useUniverse } from '@/hooks/data';
import { localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';
import { musicPlayer, renderTheme } from '@/lib/music/player';
import { THEMES, themeFor } from '@/lib/music/themes';
import { MP3_TRACKS, trackUrl } from '@/lib/music/tracks';

const PREFS_KEY = 'fandom.music';

interface Prefs { muted: boolean; volume: number }

function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>;
    return { muted: p.muted === true, volume: typeof p.volume === 'number' ? Math.min(1, Math.max(0, p.volume)) : 0.5 };
  } catch {
    return { muted: false, volume: 0.5 };
  }
}

/** Universe slug of the current route (the universe page and everything inside it). */
export function universeSlugFromPath(path: string): string | null {
  return /^\/universes\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/|$)/.exec(path)?.[1] ?? null;
}

// Automated checks render every soundtrack offline; only in builds that opt in.
if (import.meta.env.VITE_MUSIC_DEBUG === '1') {
  (window as unknown as Record<string, unknown>).__fandomMusic = {
    slugs: Object.keys(THEMES),
    source: () => musicPlayer.source,
    async render(slug: string, seconds: number) {
      const buf = await renderTheme(themeFor(slug), seconds);
      let peak = 0;
      let sum = 0;
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < d.length; i++) {
          const v = Math.abs(d[i]!);
          if (v > peak) peak = v;
          sum += v * v;
        }
      }
      return { peak, rms: Math.sqrt(sum / (buf.length * buf.numberOfChannels)), seconds: buf.duration };
    },
  };
}

/**
 * Original soundtrack of the universe being visited. Starts with the first interaction
 * (browser autoplay rules), keeps playing across the universe's pages, crossfades between
 * universes and fades out when leaving. Mute and volume are remembered on this device.
 */
export function UniverseMusic() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const { pathname } = useLocation();
  const slug = universeSlugFromPath(pathname);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [unlocked, setUnlocked] = useState(false);
  // Universe whose official theme (YouTube player) is open; the background soundtrack pauses meanwhile.
  const [officialFor, setOfficialFor] = useState<string | null>(null);
  const officialOpen = officialFor !== null && officialFor === slug;
  const universe = useUniverse(slug ?? '');

  const save = useCallback((next: Prefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // private mode: preference lasts for this visit only
    }
  }, []);

  // The first interaction anywhere on the site unlocks audio for the whole visit.
  useEffect(() => {
    const unlock = () => {
      musicPlayer.unlock();
      musicPlayer.kick();
      if (musicPlayer.unlocked) {
        setUnlocked(true);
        for (const e of ['pointerdown', 'keydown', 'touchstart'] as const) window.removeEventListener(e, unlock, true);
      }
    };
    for (const e of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(e, unlock, true);
    return () => {
      for (const e of ['pointerdown', 'keydown', 'touchstart'] as const) window.removeEventListener(e, unlock, true);
    };
  }, []);

  useEffect(() => {
    musicPlayer.setVolume(prefs.volume);
  }, [prefs.volume]);

  useEffect(() => {
    const track = slug ? MP3_TRACKS[slug] : undefined;
    if (slug && !prefs.muted && unlocked && !officialOpen) musicPlayer.play(themeFor(slug), track && trackUrl(slug, track));
    else musicPlayer.stop();
  }, [slug, prefs.muted, unlocked, officialOpen]);

  // Leaving the site section (or the app) stops the music; hidden tabs pause it.
  useEffect(() => () => musicPlayer.stop(), []);
  useEffect(() => {
    const onVisibility = () => (document.hidden ? musicPlayer.pause() : musicPlayer.resume());
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  if (!slug) return null;
  const theme = themeFor(slug);
  const track = MP3_TRACKS[slug];
  const official = universe.data?.officialTheme ?? null;
  const state = prefs.muted ? 'muted' : unlocked ? 'playing' : 'waiting';
  return (
    <div
      style={universe.data ? universeStyle(universe.data.theme) : undefined}
      className="glass fixed bottom-4 right-4 z-40 flex items-center gap-3 rounded-full py-2 pl-2 pr-4 shadow-xl"
      data-testid="universe-music"
      data-state={state}
      data-source={track ? "mp3" : "synth"}
      role="region"
      aria-label={t('music.region')}
    >
      <button
        type="button"
        onClick={() => {
          musicPlayer.unlock();
          setUnlocked(musicPlayer.unlocked);
          save({ ...prefs, muted: !prefs.muted });
        }}
        aria-pressed={!prefs.muted}
        aria-label={prefs.muted ? t('music.play') : t('music.mute')}
        title={prefs.muted ? t('music.play') : t('music.mute')}
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-full transition',
          prefs.muted ? 'bg-white/10 text-mist/70 hover:bg-white/15' : 'bg-[color:var(--u-primary,#7c3aed)] text-white',
        )}
      >
        {prefs.muted ? <VolumeX className="size-5" /> : <Volume2 className={cn('size-5', state === 'playing' && 'animate-pulse')} />}
      </button>
      <div className="hidden min-w-0 sm:block">
        <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-mist">
          <Music2 className="size-3.5 shrink-0" /> {track ? track.title : localized(theme.title, locale)}
        </p>
        <p className="truncate text-[11px] text-mist/55">{officialOpen ? t('music.officialPaused') : state === 'waiting' ? t('music.tapToPlay') : track ? (track.credit ?? t('music.themeSong')) : t('music.original')}</p>
      </div>
      {official && (
        <button
          type="button"
          onClick={() => setOfficialFor(officialOpen ? null : slug)}
          aria-expanded={officialOpen}
          aria-controls="official-theme"
          title={t('music.officialTheme')}
          className={cn('flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition', officialOpen ? 'bg-red-600 text-white' : 'bg-white/10 text-mist hover:bg-white/15')}
        >
          <MonitorPlay className="size-4" /> <span className="hidden sm:inline">{t('music.officialTheme')}</span><span className="sr-only sm:hidden">{t('music.officialTheme')}</span>
        </button>
      )}
      {official && officialOpen && (
        <div id="official-theme" role="dialog" aria-label={t('music.officialTheme')} className="glass absolute bottom-full right-0 mb-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl shadow-2xl">
          <div className="flex items-start gap-2 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-mist">{official.title}</p>
              {official.artist && <p className="truncate text-xs text-mist/60">{official.artist}</p>}
            </div>
            <button type="button" onClick={() => setOfficialFor(null)} aria-label={t('music.closeOfficial')} className="grid size-7 place-items-center rounded-full text-mist/70 hover:bg-white/10"><X className="size-4" /></button>
          </div>
          <iframe
            title={`${official.title} — YouTube`}
            src={`https://www.youtube-nocookie.com/embed/${official.youtubeId}?autoplay=1&rel=0&loop=1&playlist=${official.youtubeId}`}
            className="aspect-video w-full bg-black"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
          <div className="flex items-center justify-between gap-2 p-3 text-[11px] text-mist/55">
            <span>{t('music.officialNote')}</span>
            <a href={`https://www.youtube.com/watch?v=${official.youtubeId}`} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-mystic-300 underline">
              <ExternalLink className="size-3" /> YouTube
            </a>
          </div>
        </div>
      )}
      <label className="sr-only" htmlFor="music-volume">{t('music.volume')}</label>
      <input
        id="music-volume"
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(prefs.volume * 100)}
        onChange={(e) => save({ ...prefs, volume: Number(e.target.value) / 100 })}
        disabled={prefs.muted}
        className="hidden w-20 accent-[color:var(--u-accent,#c4b5fd)] disabled:opacity-40 md:block"
      />
    </div>
  );
}
