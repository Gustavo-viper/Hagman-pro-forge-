import type { AdminUserDetails } from '@fandom/types';
import { Alert, Badge, Button, Card, Input, Label, Select, Skeleton } from '@fandom/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, Crown, Gift, RotateCcw, ShieldOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ErrorState } from '@/components/states';
import { STAFF_EDIT_ROLES, useMe } from '@/hooks/data';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatDate, money } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';
import { RequireStaff } from './AdminLayout';
import { PlanBadge, StatusBadge } from './AdminPage';

const DURATIONS = [7, 30, 90, 180, 365];

function useAdminAction(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) =>
      api<AdminUserDetails>(`/v1/admin/users/${userId}/${path}`, { method: 'POST', body }),
    onSuccess: (data) => {
      qc.setQueryData(['admin', 'user', userId], data);
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

function GrantForm({ user }: { user: AdminUserDetails }) {
  const { t } = useTranslation();
  const action = useAdminAction(user.id);
  const [plan, setPlan] = useState<'plus' | 'ultra' | 'vip'>(user.plan.planCode === 'free' ? 'plus' : user.plan.planCode);
  const [duration, setDuration] = useState('30');
  const [custom, setCustom] = useState('');
  const [reason, setReason] = useState('');
  const days = duration === 'custom' ? Number(custom) : Number(duration);
  const valid = Number.isInteger(days) && days >= 1 && days <= 730 && reason.trim().length >= 3;
  const extends_ = user.plan.planCode === plan;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) action.mutate({ path: 'grant-plan', body: { planCode: plan, days, reason: reason.trim() } }, { onSuccess: () => setReason('') });
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <h3 className="flex items-center gap-2 font-semibold"><Gift className="size-4 text-gold-300" /> {t('admin.grant.title')}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="g-plan">{t('dashboard.plan')}</Label>
          <Select id="g-plan" value={plan} onChange={(e) => setPlan(e.target.value as 'plus' | 'ultra' | 'vip')}>
            <option value="plus">Fandom Plus</option>
            <option value="ultra">Fandom Ultra</option>
            <option value="vip">Fandom VIP</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-dur">{t('admin.grant.duration')}</Label>
          <Select id="g-dur" value={duration} onChange={(e) => setDuration(e.target.value)}>
            {DURATIONS.map((d) => <option key={d} value={d}>{t('admin.grant.days', { count: d })}</option>)}
            <option value="custom">{t('admin.grant.custom')}</option>
          </Select>
        </div>
      </div>
      {duration === 'custom' && (
        <div className="space-y-1.5">
          <Label htmlFor="g-days">{t('admin.grant.customDays')}</Label>
          <Input id="g-days" type="number" min={1} max={730} value={custom} onChange={(e) => setCustom(e.target.value)} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="g-reason">{t('admin.reason')}</Label>
        <Input id="g-reason" placeholder={t('admin.grant.reasonPlaceholder')} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
      </div>
      <p className="text-xs text-mist/55">{extends_ ? t('admin.grant.extends') : user.plan.planCode !== 'free' ? t('admin.grant.replaces') : t('admin.grant.starts')}</p>
      <Button type="submit" variant="gold" disabled={!valid} loading={action.isPending}>
        <Crown /> {t('admin.grant.submit', { plan: plan === 'plus' ? 'Fandom Plus' : 'Fandom Ultra', count: days || 0 })}
      </Button>
      {action.isError && <p role="alert" className="text-sm text-red-300">{errorMessage(action.error, t)}</p>}
      {action.isSuccess && <p className="text-sm text-emerald-300">{t('admin.done')}</p>}
    </form>
  );
}

/** Revoke-plan and suspend/reactivate actions: each requires a reason, kept in the audit log. */
function DangerAction({ user, kind }: { user: AdminUserDetails; kind: 'revoke' | 'suspend' | 'reactivate' }) {
  const { t } = useTranslation();
  const action = useAdminAction(user.id);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const path = kind === 'revoke' ? 'revoke-plan' : kind;
  const Icon = kind === 'revoke' ? ShieldOff : kind === 'suspend' ? Ban : RotateCcw;
  if (!open) {
    return (
      <Button variant={kind === 'reactivate' ? 'glass' : 'outline'} onClick={() => setOpen(true)}>
        <Icon /> {t(`admin.${kind}.button`)}
      </Button>
    );
  }
  return (
    <form
      className="glass w-full space-y-3 rounded-xl p-4"
      onSubmit={(e) => {
        e.preventDefault();
        action.mutate({ path, body: { reason: reason.trim() } }, { onSuccess: () => { setOpen(false); setReason(''); } });
      }}
    >
      <p className="text-sm text-mist/75">{t(`admin.${kind}.explain`)}</p>
      <Input aria-label={t('admin.reason')} placeholder={t('admin.reason')} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} autoFocus />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant={kind === 'reactivate' ? 'primary' : 'danger'} size="sm" disabled={reason.trim().length < 3} loading={action.isPending}>
          {t(`admin.${kind}.confirm`)}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>{t('admin.cancel')}</Button>
      </div>
      {action.isError && <p role="alert" className="text-sm text-red-300">{errorMessage(action.error, t)}</p>}
    </form>
  );
}

function Details() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const locale = currentLocale();
  const me = useMe();
  const canEdit = me.data?.profile.roles.some((r) => STAFF_EDIT_ROLES.includes(r)) ?? false;
  const q = useQuery({ queryKey: ['admin', 'user', id], queryFn: ({ signal }) => api<AdminUserDetails>(`/v1/admin/users/${id}`, { signal }) });

  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const u = q.data;
  return (
    <div className="space-y-6">
      <Card className="rounded-3xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">{u.displayName ?? u.email}</h1>
            <p className="mt-1 text-sm text-mist/60">{u.username && `@${u.username} · `}{u.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge status={u.status} />
              <PlanBadge plan={u.plan} />
              <Badge variant={u.emailVerified ? 'success' : 'default'}>{u.emailVerified ? t('admin.verified') : t('admin.unverified')}</Badge>
              {u.isMinor && <Badge variant="danger">{t('admin.minor')}</Badge>}
              {u.roles.map((r) => <Badge key={r} variant="gold">{r}</Badge>)}
            </div>
          </div>
          <div className="text-right text-sm text-mist/60">
            <p>{t('admin.joined')}: {formatDate(u.createdAt, locale)}</p>
            {u.lastSeenAt && <p>{t('admin.lastSeen')}: {formatDate(u.lastSeenAt, locale)}</p>}
            <p>XP: {u.xpTotal} · {u.country ?? '—'}</p>
            {u.universes.length > 0 && <p>{u.universes.join(', ')}</p>}
          </div>
        </div>
        {u.plan.planCode !== 'free' && u.plan.currentPeriodEnd && (
          <Alert variant="info" className="mt-5">
            {t('admin.planUntil', { plan: t(`dashboard.planNames.${u.plan.planCode}`), date: formatDate(u.plan.currentPeriodEnd, locale) })}
            {u.plan.provider === 'manual' ? ` (${t('admin.manual')})` : ' (InfinitePay)'}
          </Alert>
        )}
      </Card>

      {canEdit ? (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Card className="rounded-3xl p-6"><GrantForm user={u} /></Card>
          <Card className="space-y-4 rounded-3xl p-6">
            <h3 className="font-semibold">{t('admin.access')}</h3>
            <div className="flex flex-wrap gap-3">
              {u.plan.planCode !== 'free' && <DangerAction user={u} kind="revoke" />}
              {u.status === 'active' ? <DangerAction user={u} kind="suspend" /> : <DangerAction user={u} kind="reactivate" />}
            </div>
            <p className="text-xs text-mist/50">{t('admin.revoke.note')}</p>
          </Card>
        </div>
      ) : (
        <Alert variant="info">{t('admin.readOnly')}</Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl p-6">
          <h3 className="font-semibold">{t('subscription.history')}</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {u.payments.length === 0 && <li className="text-mist/50">{t('subscription.noPayments')}</li>}
            {u.payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 border-t border-white/5 pt-2">
                <span>{formatDate(p.paidAt ?? p.createdAt, locale)} · {t(`dashboard.planNames.${p.planCode}`)}</span>
                <span className="text-mist/70">{money(p.amountMinor, p.currency, locale)} · {t(`subscription.paymentStatus.${p.status}`)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="rounded-3xl p-6">
          <h3 className="font-semibold">{t('admin.activity')}</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {u.audit.length === 0 && <li className="text-mist/50">—</li>}
            {u.audit.map((a, i) => (
              <li key={i} className="border-t border-white/5 pt-2">
                <span className="text-mist/80">{t(`admin.actions.${a.action}`, { defaultValue: a.action })}</span>
                <span className="block text-xs text-mist/50">
                  {formatDate(a.at, locale)}{a.actor ? ` · ${a.actor}` : ''}{typeof a.metadata.reason === 'string' ? ` · “${a.metadata.reason}”` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

export default function AdminUserPage() {
  const { t } = useTranslation();
  return (
    <RequireStaff>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Link to="/admin" className="mb-6 inline-flex items-center gap-2 text-sm text-mist/60 hover:text-mist"><ArrowLeft className="size-4" /> {t('admin.back')}</Link>
        <Details />
      </div>
    </RequireStaff>
  );
}
