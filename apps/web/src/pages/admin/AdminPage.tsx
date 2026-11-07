import type { AdminStats, AdminUserRow, CursorPage } from '@fandom/types';
import { Badge, Button, Card, Input, Select, Skeleton } from '@fandom/ui';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Crown, Search, ShieldCheck, Users, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { EmptyState, ErrorState } from '@/components/states';
import { api } from '@/lib/api';
import { formatDate, formatNumber, money } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';
import { MODERATION_ROLES, USER_ADMIN_ROLES, useMe } from '@/hooks/data';
import { RequireStaff } from './AdminLayout';
import { ReportsSection } from './ReportsSection';

function useDebounced<T>(v: T, ms = 350): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const id = setTimeout(() => setD(v), ms);
    return () => clearTimeout(id);
  }, [v, ms]);
  return d;
}

export function PlanBadge({ plan }: { plan: AdminUserRow['plan'] }) {
  const { t } = useTranslation();
  if (plan.planCode === 'free') return <Badge>{t('dashboard.planNames.free')}</Badge>;
  return (
    <Badge variant={plan.planCode === 'ultra' ? 'gold' : 'arcane'}>
      <Crown className="size-3" /> {t(`dashboard.planNames.${plan.planCode}`)}
      {plan.provider === 'manual' && ` · ${t('admin.manual')}`}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: AdminUserRow['status'] }) {
  const { t } = useTranslation();
  return <Badge variant={status === 'active' ? 'success' : 'danger'}>{t(`admin.accountStatus.${status}`)}</Badge>;
}

function Stats() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: ({ signal }) => api<AdminStats>('/v1/admin/stats', { signal }) });
  if (stats.isPending) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (stats.isError) return <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />;
  const s = stats.data;
  const cards = [
    { icon: Users, label: t('admin.stats.users'), value: formatNumber(s.users.total, locale), hint: t('admin.stats.new7', { n: s.users.newLast7Days }) },
    { icon: ShieldCheck, label: t('admin.stats.verified'), value: formatNumber(s.users.verified, locale), hint: t('admin.stats.suspended', { n: s.users.suspended }) },
    { icon: Crown, label: t('admin.stats.subscribers'), value: formatNumber(s.subscribers.plus + s.subscribers.ultra, locale), hint: `Plus ${s.subscribers.plus} · Ultra ${s.subscribers.ultra}` },
    { icon: Wallet, label: t('admin.stats.revenueMonth'), value: money(s.revenue.thisMonthMinor, s.revenue.currency, locale), hint: t('admin.stats.revenue30', { v: money(s.revenue.last30DaysMinor, s.revenue.currency, locale) }) },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ icon: Icon, label, value, hint }) => (
        <Card key={label} className="rounded-2xl p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-mist/55"><Icon className="size-4" /> {label}</div>
          <p className="mt-3 font-display text-3xl font-bold">{value}</p>
          <p className="mt-1 text-xs text-mist/55">{hint}</p>
        </Card>
      ))}
    </div>
  );
}

function UsersTable() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');
  const q = useDebounced(search.trim());
  const users = useInfiniteQuery({
    queryKey: ['admin', 'users', q, plan, status],
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) => {
      const p = new URLSearchParams({ limit: '25' });
      if (q) p.set('search', q);
      if (plan) p.set('plan', plan);
      if (status) p.set('status', status);
      if (pageParam) p.set('cursor', pageParam);
      return api<CursorPage<AdminUserRow>>(`/v1/admin/users?${p}`, { signal });
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = users.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-bold tracking-wide">{t('admin.users')}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_180px]">
        <label className="relative">
          <span className="sr-only">{t('admin.search')}</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-mist/40" />
          <Input className="pl-10" placeholder={t('admin.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <Select aria-label={t('dashboard.plan')} value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="">{t('admin.allPlans')}</option>
          <option value="free">Free</option>
          <option value="plus">Fandom Plus</option>
          <option value="ultra">Fandom Ultra</option>
        </Select>
        <Select aria-label={t('subscription.status')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('admin.allStatuses')}</option>
          <option value="active">{t('admin.accountStatus.active')}</option>
          <option value="suspended">{t('admin.accountStatus.suspended')}</option>
        </Select>
      </div>
      <div className="mt-4">
        {users.isPending ? (
          <Skeleton className="h-80" />
        ) : users.isError ? (
          <ErrorState error={users.error} onRetry={() => void users.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState>{t('admin.noUsers')}</EmptyState>
        ) : (
          <div className="glass overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-mist/50">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('admin.user')}</th>
                  <th className="px-4 py-3 font-medium">{t('dashboard.plan')}</th>
                  <th className="px-4 py-3 font-medium">{t('subscription.validUntil')}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.account')}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.joined')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-t border-white/5 transition hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <Link to={`/admin/users/${u.id}`} className="block">
                        <span className="font-semibold text-mist hover:underline">{u.displayName ?? u.email}</span>
                        <span className="block text-xs text-mist/55">
                          {u.username ? `@${u.username} · ` : ''}{u.email}{!u.emailVerified && ` · ${t('admin.unverified')}`}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3"><PlanBadge plan={u.plan} /></td>
                    <td className="px-4 py-3 text-mist/70">{u.plan.planCode !== 'free' && u.plan.currentPeriodEnd ? formatDate(u.plan.currentPeriodEnd, locale) : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                    <td className="px-4 py-3 text-mist/70">{formatDate(u.createdAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {users.hasNextPage && (
          <div className="mt-4 flex justify-center">
            <Button variant="glass" loading={users.isFetchingNextPage} onClick={() => void users.fetchNextPage()}>{t('admin.loadMore')}</Button>
          </div>
        )}
      </div>
    </section>
  );
}

function AdminContent() {
  const { t } = useTranslation();
  const roles = useMe().data?.profile.roles ?? [];
  const usersAccess = roles.some((r) => USER_ADMIN_ROLES.includes(r));
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-300">Forge Studios</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-wide">{t('admin.title')}</h1>
      {usersAccess && <div className="mt-8"><Stats /></div>}
      <ReportsSection canResolve={roles.some((r) => MODERATION_ROLES.includes(r))} />
      {usersAccess && <UsersTable />}
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireStaff>
      <AdminContent />
    </RequireStaff>
  );
}
