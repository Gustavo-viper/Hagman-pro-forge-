import { Badge, cn } from '@fandom/ui';
import type { UniverseSummary } from '@fandom/types';
import { motion } from 'framer-motion';
import { ArrowRight, Users } from 'lucide-react';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { formatNumber, localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';

/** Universe theme tokens → CSS variables, so every universe renders with its own identity. */
export function universeStyle(theme: UniverseSummary['theme']): CSSProperties {
  return {
    '--u-primary': theme.primary,
    '--u-secondary': theme.secondary,
    '--u-accent': theme.accent,
    '--u-bg': theme.background,
    '--u-glow': theme.glow,
  } as CSSProperties;
}

/** Abstract per-universe sigil generated from the slug (no third-party artwork). */
export function UniverseSigil({ slug, className }: { slug: string; className?: string }) {
  const seed = [...slug].reduce((a, c) => a + c.charCodeAt(0), 0);
  const points = 5 + (seed % 4);
  const path = Array.from({ length: points * 2 }, (_, i) => {
    const angle = (Math.PI * i) / points - Math.PI / 2;
    const r = i % 2 === 0 ? 40 : 17;
    return `${50 + r * Math.cos(angle)},${50 + r * Math.sin(angle)}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="none" stroke="var(--u-accent)" strokeOpacity="0.5" strokeDasharray="2 6" />
      <circle cx="50" cy="50" r="34" fill="none" stroke="var(--u-glow)" strokeOpacity="0.35" />
      <polygon points={path} fill="var(--u-accent)" fillOpacity="0.85" />
      <circle cx="50" cy="50" r="6" fill="var(--u-bg)" />
    </svg>
  );
}

export function UniverseCard({ universe, footer, className }: { universe: UniverseSummary; footer?: ReactNode; className?: string }) {
  const { t } = useTranslation();
  const locale = currentLocale();

  const onMove = (e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  return (
    <motion.article
      style={universeStyle(universe.theme)}
      onMouseMove={onMove}
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 p-7',
        'bg-[linear-gradient(150deg,color-mix(in_oklab,var(--u-primary)_45%,transparent),color-mix(in_oklab,var(--u-bg)_92%,transparent)_55%,color-mix(in_oklab,var(--u-secondary)_40%,transparent))]',
        className,
      )}
    >
      {/* Cursor-following light */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'radial-gradient(380px circle at var(--mx) var(--my), color-mix(in oklab, var(--u-glow) 22%, transparent), transparent 60%)' }}
      />
      <UniverseSigil slug={universe.slug} className="absolute -right-8 -top-8 size-44 opacity-40 transition-transform duration-700 group-hover:rotate-45" />
      <div className="relative flex items-center gap-2">
        <Badge className="bg-black/30 text-[color:var(--u-glow)] ring-1 ring-[color:var(--u-accent)]/40">
          <Users className="size-3" /> {t('landing.universes.members', { count: universe.memberCount, formatted: formatNumber(universe.memberCount, locale) })}
        </Badge>
      </div>
      <h3 className="relative mt-10 font-display text-3xl font-bold tracking-wide text-white">{localized(universe.name, locale)}</h3>
      <p className="relative mt-2 text-[color:var(--u-glow)]">{localized(universe.tagline, locale)}</p>
      <p className="relative mt-4 line-clamp-3 text-sm text-mist/70">{localized(universe.description, locale)}</p>
      <div className="relative mt-8 flex flex-wrap items-center gap-3">
        {footer ?? (
          <Link
            to={`/universes/${universe.slug}`}
            className="inline-flex items-center gap-2 rounded-xl bg-black/30 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-black/45 hover:ring-[color:var(--u-accent)]"
          >
            {t('landing.universes.enter')} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        )}
      </div>
    </motion.article>
  );
}
