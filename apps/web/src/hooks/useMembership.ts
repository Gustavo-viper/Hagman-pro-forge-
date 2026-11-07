import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UniverseMembership } from '@fandom/types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query';

export function useMembershipMutations() {
  const qc = useQueryClient();
  const refresh = (slug: string) => {
    void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    void qc.invalidateQueries({ queryKey: queryKeys.universes });
    void qc.invalidateQueries({ queryKey: queryKeys.universe(slug) });
  };
  const join = useMutation({
    mutationFn: (slug: string) => api<UniverseMembership>(`/v1/universes/${encodeURIComponent(slug)}/membership`, { method: 'POST' }),
    onSuccess: (_, slug) => refresh(slug),
  });
  const leave = useMutation({
    mutationFn: (slug: string) => api<void>(`/v1/universes/${encodeURIComponent(slug)}/membership`, { method: 'DELETE' }),
    onSuccess: (_, slug) => refresh(slug),
  });
  return { join, leave };
}
