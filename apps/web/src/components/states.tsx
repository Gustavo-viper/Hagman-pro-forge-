import { Alert, Button, Skeleton, Spinner } from '@fandom/ui';
import { AlertTriangle, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '@/lib/errors';

export function FullPageLoader() {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-[60dvh] place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-mist/70">
        <Spinner className="size-8 text-arcane-300" />
        <span className="text-sm">{t('common.loading')}</span>
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
  const { t } = useTranslation();
  return (
    <Alert variant="danger" className="items-start">
      <AlertTriangle className="mt-0.5 size-5 shrink-0" />
      <div className="flex-1 space-y-2">
        {title && <p className="font-semibold">{title}</p>}
        <p>{errorMessage(error, t)}</p>
        {onRetry && (
          <Button variant="glass" size="sm" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        )}
      </div>
    </Alert>
  );
}

export function EmptyState({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-10 text-center text-mist/70">
      {icon ?? <Inbox className="size-8 text-arcane-300" />}
      <div className="max-w-md text-sm">{children}</div>
    </div>
  );
}

export function CardGridSkeleton({ count = 2, className = 'h-64' }: { count?: number; className?: string }) {
  return (
    <div className="grid gap-6 md:grid-cols-2" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </div>
  );
}
