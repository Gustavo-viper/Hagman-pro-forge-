import { useQuery } from '@tanstack/react-query';
import type { DashboardResponse, SubscriptionPlanSummary, UniverseSummary } from '@fandom/types';
import { useAuth } from '@/auth/AuthProvider';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query';

export type UniverseDetail = UniverseSummary & { identityConfig: IdentityConfig };

export interface IdentityOption {
  key: string;
  name: Record<string, string>;
  color?: string;
  traits?: Record<string, string[]>;
  minLevel?: number;
}
export interface IdentityConfig {
  type?: string;
  label?: Record<string, string>;
  options?: IdentityOption[];
}

export function useUniverses() {
  return useQuery({
    queryKey: queryKeys.universes,
    queryFn: ({ signal }) => api<{ items: UniverseSummary[] }>('/v1/universes', { signal, auth: false }).then((r) => r.items),
    staleTime: 60_000,
  });
}

export function useUniverse(slug: string) {
  return useQuery({
    queryKey: queryKeys.universe(slug),
    queryFn: ({ signal }) => api<UniverseDetail>(`/v1/universes/${encodeURIComponent(slug)}`, { signal, auth: false }),
  });
}

export function usePlans(currency = 'BRL') {
  return useQuery({
    queryKey: queryKeys.plans(currency),
    queryFn: ({ signal }) =>
      api<{ items: SubscriptionPlanSummary[] }>(`/v1/subscription-plans?currency=${currency}`, { signal, auth: false }).then((r) => r.items),
    staleTime: 5 * 60_000,
  });
}

export function useDashboard() {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: ({ signal }) => api<DashboardResponse>('/v1/me/dashboard', { signal }),
    enabled: Boolean(session),
  });
}

export function useBillingConfig() {
  return useQuery({
    queryKey: ['billing', 'config'],
    queryFn: ({ signal }) => api<import('@fandom/types').BillingConfig>('/v1/billing/config', { signal, auth: false }),
    staleTime: 5 * 60_000,
  });
}

export function useSubscriptionDetails() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['me', 'billing'],
    queryFn: ({ signal }) => api<import('@fandom/types').SubscriptionDetails>('/v1/billing/subscription', { signal }),
    enabled: Boolean(session),
  });
}

export function useMe() {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => api<import('@fandom/types').MeResponse>('/v1/me', { signal }),
    enabled: Boolean(session),
    staleTime: 60_000,
  });
}

export const STAFF_VIEW_ROLES = ['super_admin', 'admin', 'support'];
export const STAFF_EDIT_ROLES = ['super_admin', 'admin'];
