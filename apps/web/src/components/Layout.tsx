import { Button, cn } from '@fandom/ui';
import { AnimatePresence, motion } from 'framer-motion';
import { Crown, LayoutDashboard, LogOut, Menu, Orbit, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation, useNavigate, useOutlet } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './Logo';

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive ? 'bg-white/10 text-mist' : 'text-mist/70 hover:bg-white/5 hover:text-mist',
    );
  return (
    <>
      <NavLink to="/universes" className={linkClass} onClick={onNavigate}>
        <Orbit className="size-4" /> {t('nav.universes')}
      </NavLink>
      <NavLink to="/premium" className={linkClass} onClick={onNavigate}>
        <Crown className="size-4" /> {t('nav.premium')}
      </NavLink>
      {session && (
        <NavLink to="/dashboard" className={linkClass} onClick={onNavigate}>
          <LayoutDashboard className="size-4" /> {t('nav.dashboard')}
        </NavLink>
      )}
    </>
  );
}

function AuthButtons({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  if (session) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={async () => {
          onNavigate?.();
          await signOut();
          void navigate('/');
        }}
      >
        <LogOut /> {t('nav.signOut')}
      </Button>
    );
  }
  return (
    <>
      <Button asChild variant="ghost" size="sm">
        <Link to="/login" onClick={onNavigate}>{t('nav.signIn')}</Link>
      </Button>
      <Button asChild size="sm">
        <Link to="/register" onClick={onNavigate}>{t('nav.signUp')}</Link>
      </Button>
    </>
  );
}

export function Navbar() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-void/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6" aria-label="Main">
        <Link to="/" className="rounded-lg" aria-label="Fandom Universe">
          <Logo />
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          <NavItems />
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitcher />
          <AuthButtons />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/5 md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-4">
              <NavItems onNavigate={() => setOpen(false)} />
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                <LanguageSwitcher />
                <AuthButtons onNavigate={() => setOpen(false)} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="mt-24 border-t border-white/5">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Logo />
          <p className="font-display text-xs tracking-[0.3em] text-gold-300/80">{t('common.slogan')}</p>
          <p className="text-xs text-mist/50">{t('footer.unofficial')}</p>
        </div>
        <div className="flex flex-col gap-3 text-xs text-mist/55 md:items-end">
          <div className="flex gap-4">
            <Link className="hover:text-mist" to="/legal/terms">{t('footer.terms')}</Link>
            <Link className="hover:text-mist" to="/legal/privacy">{t('footer.privacy')}</Link>
          </div>
          <p>{t('footer.rights', { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </footer>
  );
}

/**
 * Freezes the route element captured on mount. Without this, the page that is animating
 * out would render the NEW route (Outlet reads the current location), mounting it twice:
 * anything typed during the transition was lost when the exit finished.
 */
function FrozenOutlet() {
  const outlet = useOutlet();
  const [frozen] = useState(outlet);
  return frozen;
}

/** Page transition wrapper keyed by route. */
export function AppLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-arcane-600 focus:px-4 focus:py-2">
        {t('common.skipToContent')}
      </a>
      <Navbar />
      <AnimatePresence mode="wait">
        <motion.main
          id="main"
          key={location.pathname}
          className="flex-1"
          initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <FrozenOutlet />
        </motion.main>
      </AnimatePresence>
      <Footer />
    </div>
  );
}

export function SectionHeading({ eyebrow, title, subtitle, className }: { eyebrow?: string; title: string; subtitle?: string; className?: string }) {
  return (
    <div className={cn('mx-auto max-w-2xl text-center', className)}>
      {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-gold-300">{eyebrow}</p>}
      <h2 className="font-display text-3xl font-bold tracking-wide sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-mist/65">{subtitle}</p>}
    </div>
  );
}
