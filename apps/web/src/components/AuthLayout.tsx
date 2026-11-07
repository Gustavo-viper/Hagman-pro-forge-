import { Alert, Card } from '@fandom/ui';
import { motion } from 'framer-motion';
import { KeyRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { authConfigured } from '@/lib/env';
import { LogoMark } from './Logo';
import { ParticleField } from './ParticleField';

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="relative grid min-h-[calc(100dvh-4rem)] place-items-center overflow-hidden px-4 py-16">
      <ParticleField className="absolute inset-0 size-full" density={0.6} />
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full max-w-md">
        <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-arcane-500/40 via-transparent to-mystic-500/30 blur-xl" aria-hidden="true" />
        <Card className="relative rounded-3xl p-8">
          <div className="mb-8 flex flex-col items-center text-center">
            <LogoMark className="size-12 animate-float" />
            <h1 className="mt-4 font-display text-2xl font-bold tracking-wide">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-mist/60">{subtitle}</p>}
          </div>
          {!authConfigured && (
            <Alert variant="warning" className="mb-6">
              <KeyRound className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-semibold">{t('auth.notConfigured.title')}</p>
                <p className="mt-1 text-xs opacity-80">{t('auth.notConfigured.body')}</p>
              </div>
            </Alert>
          )}
          {children}
        </Card>
        {footer && <div className="relative mt-6 text-center text-sm text-mist/60">{footer}</div>}
      </motion.div>
    </div>
  );
}

export function FormField({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-mist/85">{label}</label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-300">{t(`validation.${error}`)}</p>
      ) : (
        hint && <p className="text-xs text-mist/45">{hint}</p>
      )}
    </div>
  );
}
