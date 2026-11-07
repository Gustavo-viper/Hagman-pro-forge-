import { Button } from '@fandom/ui';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { LogoMark } from '@/components/Logo';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-[70dvh] place-items-center px-4 text-center">
      <div>
        <LogoMark className="mx-auto size-16 opacity-60 grayscale" />
        <p className="mt-6 font-display text-7xl font-bold text-gradient">404</p>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-wide">{t('notFound.title')}</h1>
        <p className="mt-2 text-mist/60">{t('notFound.body')}</p>
        <Button asChild className="mt-8">
          <Link to="/">{t('notFound.home')}</Link>
        </Button>
      </div>
    </div>
  );
}
