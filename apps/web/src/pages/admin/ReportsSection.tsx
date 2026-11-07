import type { AdminReport } from '@fandom/types';
import { Badge, Button, Skeleton } from '@fandom/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeOff, Flag, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { EmptyState, ErrorState } from '@/components/states';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';

/** Community reports queue: hide the content (resolves all its reports) or dismiss. */
export function ReportsSection({ canResolve }: { canResolve: boolean }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const qc = useQueryClient();
  const reports = useQuery({ queryKey: ['admin', 'reports'], queryFn: ({ signal }) => api<{ items: AdminReport[] }>('/v1/admin/reports', { signal }).then((r) => r.items) });
  const resolve = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'hide' | 'dismiss' }) => api(`/v1/admin/reports/${id}/resolve`, { method: 'POST', body: { action } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'reports'] }),
  });
  return (
    <section className="mt-12">
      <h2 className="flex items-center gap-2 font-display text-2xl font-bold tracking-wide"><Flag className="size-5 text-red-300" /> {t('admin.reports.title')}</h2>
      <div className="mt-4">
        {reports.isPending ? <Skeleton className="h-40" /> : reports.isError ? <ErrorState error={reports.error} onRetry={() => void reports.refetch()} /> : reports.data.length === 0 ? (
          <EmptyState>{t('admin.reports.empty')}</EmptyState>
        ) : (
          <ul className="space-y-3">
            {reports.data.map((r) => (
              <li key={r.id} className="glass rounded-2xl p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="danger">{t(`sections.reasons.${r.reason}`)}</Badge>
                  <Badge>{t(`admin.reports.type.${r.targetType}`)}</Badge>
                  {r.reportsOnTarget > 1 && <Badge variant="gold">{t('admin.reports.count', { count: r.reportsOnTarget })}</Badge>}
                  <span className="text-mist/50">{formatDate(r.createdAt, locale)} · {r.reporter}</span>
                </div>
                {r.content ? (
                  <div className="mt-3 rounded-xl bg-black/20 p-4">
                    {r.content.title && <p className="font-semibold">{r.content.title}</p>}
                    <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-sm text-mist/75">{r.content.body}</p>
                    <p className="mt-2 text-xs text-mist/50">
                      {t('admin.reports.by')} {r.content.author} · {r.content.universeSlug} ·{' '}
                      {r.content.status === 'visible'
                        ? <Link className="underline" to={`/universes/${r.content.universeSlug}/forum/${r.content.topicId}`}>{t('admin.reports.open')}</Link>
                        : r.content.status}
                    </p>
                  </div>
                ) : <p className="mt-3 text-sm text-mist/50">{t('admin.reports.gone')}</p>}
                {r.details && <p className="mt-2 text-sm text-mist/65">“{r.details}”</p>}
                {canResolve && (
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="danger" loading={resolve.isPending && resolve.variables?.id === r.id && resolve.variables.action === 'hide'} onClick={() => resolve.mutate({ id: r.id, action: 'hide' })}>
                      <EyeOff /> {t('admin.reports.hide')}
                    </Button>
                    <Button size="sm" variant="ghost" loading={resolve.isPending && resolve.variables?.id === r.id && resolve.variables.action === 'dismiss'} onClick={() => resolve.mutate({ id: r.id, action: 'dismiss' })}>
                      <X /> {t('admin.reports.dismiss')}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {resolve.isError && <p role="alert" className="mt-3 text-sm text-red-300">{errorMessage(resolve.error, t)}</p>}
      </div>
    </section>
  );
}
