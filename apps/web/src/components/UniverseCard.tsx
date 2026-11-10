import { Badge, cn } from '@fandom/ui';
import type { UniverseSummary } from '@fandom/types';
import { motion } from 'framer-motion';
import { ArrowRight, Users } from 'lucide-react';
import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
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

/**
 * Real cover photo of a universe (freely licensed, credited). Falls back to the abstract
 * gradient + sigil when the universe has no cover or the image cannot be loaded.
 */
export function UniverseCover({ universe, className, imgClassName, showCredit = true }: { universe: UniverseSummary; className?: string; imgClassName?: string; showCredit?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = universe.theme.coverImage;
  const name = localized(universe.name, currentLocale());
  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)}>
      <div className="absolute inset-0 bg-[linear-gradient(150deg,color-mix(in_oklab,var(--u-primary)_70%,transparent),color-mix(in_oklab,var(--u-bg)_90%,transparent)_60%,color-mix(in_oklab,var(--u-secondary)_65%,transparent))]" />
      {src && !failed ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={cn('absolute inset-0 size-full object-cover', imgClassName)}
        />
      ) : (
        <UniverseSigil slug={universe.slug} className="absolute -right-8 -top-8 size-44 opacity-50" />
      )}
      {/* Tint the photo with the universe palette so every cover matches its identity. */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_25%,color-mix(in_oklab,var(--u-bg)_85%,transparent)_100%)]" />
      <div className="absolute inset-0 mix-blend-soft-light" style={{ background: 'linear-gradient(135deg, var(--u-primary), transparent 60%, var(--u-glow))' }} />
      {showCredit && src && !failed && universe.theme.coverCredit && (
        <span className="absolute bottom-1.5 right-2 max-w-[90%] truncate text-[9px] text-white/45" title={universe.theme.coverCredit}>{universe.theme.coverCredit}</span>
      )}
    </div>
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
      className={cn('glass glass-sheen group flex flex-col rounded-3xl', className)}
    >
      <div className="relative h-48 shrink-0 overflow-hidden rounded-t-3xl">
        <UniverseCover universe={universe} imgClassName="transition-transform duration-[1.2s] ease-out group-hover:scale-110" />
        <Badge className="absolute left-4 top-4 bg-black/40 text-[color:var(--u-glow)] ring-1 ring-white/15 backdrop-blur-md">
          <Users className="size-3" /> {t('landing.universes.members', { count: universe.memberCount, formatted: formatNumber(universe.memberCount, locale) })}
        </Badge>
        <h3 className="absolute inset-x-5 bottom-4 font-display text-3xl font-bold tracking-wide text-white drop-shadow-[0_2px_12px_rgb(0_0_0/0.8)]">{localized(universe.name, locale)}</h3>
      </div>
      {/* Cursor-following light */}
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'radial-gradient(380px circle at var(--mx) var(--my), color-mix(in oklab, var(--u-glow) 18%, transparent), transparent 60%)' }}
      />
      <div className="relative flex flex-1 flex-col p-6">
        <p className="text-[color:var(--u-glow)]">{localized(universe.tagline, locale)}</p>
        <p className="mt-3 line-clamp-3 flex-1 text-sm text-mist/70">{localized(universe.description, locale)}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {footer ?? (
            <Link
              to={`/universes/${universe.slug}`}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur-md transition hover:bg-white/20 hover:ring-[color:var(--u-accent)]"
            >
              {t('landing.universes.enter')} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          )}
        </div>
      </div>
    </motion.article>
  );
}
