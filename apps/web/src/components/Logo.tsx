import { cn } from '@fandom/ui';

/** Original Fandom Universe mark: an orbit ring (technology) around a four-point star (magic). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-9', className)} aria-hidden="true">
      <defs>
        <linearGradient id="fu-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b79bff" />
          <stop offset="0.55" stopColor="#38b2f8" />
          <stop offset="1" stopColor="#f2cb6b" />
        </linearGradient>
        <radialGradient id="fu-core" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff4d6" />
          <stop offset="1" stopColor="#e8b64c" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="#0c0a18" />
      <ellipse cx="32" cy="32" rx="25" ry="10" fill="none" stroke="url(#fu-ring)" strokeWidth="2.5" transform="rotate(-28 32 32)" />
      <ellipse cx="32" cy="32" rx="25" ry="10" fill="none" stroke="url(#fu-ring)" strokeWidth="1.2" opacity="0.55" transform="rotate(42 32 32)" />
      <path d="M32 14 L35.2 28.8 L50 32 L35.2 35.2 L32 50 L28.8 35.2 L14 32 L28.8 28.8 Z" fill="url(#fu-core)" />
      <circle cx="51" cy="21" r="2.4" fill="#38b2f8" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="font-display text-lg font-bold leading-none tracking-[0.12em]">
        FANDOM <span className="text-gradient">UNIVERSE</span>
      </span>
    </span>
  );
}
