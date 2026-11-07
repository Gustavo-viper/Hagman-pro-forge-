import { Button, Skeleton } from '@fandom/ui';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ErrorState } from '@/components/states';
import { universeStyle } from '@/components/UniverseCard';
import { useUniverse, type UniverseDetail } from '@/hooks/data';
import { ApiError } from '@/lib/api';
import { localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';

/** Common frame of the game pages: universe theme, back link, title and errors. */
export function GameShell({ slug, title, subtitle, error, children }: {
  slug: string;
  title: string;
  subtitle?: ReactNode;
  error?: unknown;
  children: (universe: UniverseDetail) => ReactNode;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const universe = useUniverse(slug);
  if (universe.isPending) return <div className="mx-auto max-w-3xl px-4 py-10"><Skeleton className="h-96" /></div>;
  if (universe.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState error={universe.error} /></div>;
  const u = universe.data;
  const notMember = error instanceof ApiError && error.code === 'membership_required';
  return (
    <div style={universeStyle(u.theme)} className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link to={`/universes/${slug}?tab=quizzes`} className="inline-flex items-center gap-2 text-sm text-mist/60 hover:text-mist">
        <ArrowLeft className="size-4" /> {localized(u.name, locale)} · {t('universe.tabs.quizzes')}
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold tracking-wide">{title}</h1>
      {subtitle && <div className="mt-2 text-mist/65">{subtitle}</div>}
      {error ? (
        <div className="mt-8">
          <ErrorState error={error} />
          {notMember && <Button asChild className="mt-4"><Link to={`/universes/${slug}`}>{t('games.joinUniverse')}</Link></Button>}
        </div>
      ) : (
        children(u)
      )}
    </div>
  );
}

/** Option button shared by the question games (states: idle, chosen, right, wrong). */
export function optionClass(state: 'idle' | 'chosen' | 'right' | 'wrong'): string {
  return {
    idle: 'border-white/10 bg-white/[0.04] text-mist/85 hover:border-white/25 hover:bg-white/[0.07]',
    chosen: 'border-[color:var(--u-accent)] bg-[color:var(--u-primary)]/35 text-white',
    right: 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100',
    wrong: 'border-red-400/60 bg-red-500/15 text-red-100',
  }[state];
}
