import { Alert, Skeleton } from '@fandom/ui';
import { ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { STAFF_VIEW_ROLES, useMe } from '@/hooks/data';

/** UX gate only: every admin endpoint is authorized again by the API (RBAC). */
export function RequireStaff({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const me = useMe();
  if (me.isPending) return <div className="mx-auto max-w-6xl px-4 py-10"><Skeleton className="h-64" /></div>;
  const ok = me.data?.profile.roles.some((r) => STAFF_VIEW_ROLES.includes(r));
  if (!ok) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <Alert variant="danger"><ShieldAlert className="size-5 shrink-0" /> {t('admin.denied')}</Alert>
      </div>
    );
  }
  return <>{children}</>;
}
