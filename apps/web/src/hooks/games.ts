import type { GameKind, GameLeaderboardEntry, GamesOverview } from '@fandom/types';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useGamesOverview(slug: string, enabled: boolean) {
  return useQuery({
    queryKey: ['me', 'games', slug],
    queryFn: ({ signal }) => api<GamesOverview>(`/v1/universes/${encodeURIComponent(slug)}/games/me`, { signal }),
    enabled,
  });
}

export function useGameLeaderboard(slug: string, game: GameKind) {
  return useQuery({
    queryKey: ['universes', slug, 'games', 'leaderboard', game],
    queryFn: ({ signal }) =>
      api<{ items: GameLeaderboardEntry[] }>(`/v1/universes/${encodeURIComponent(slug)}/games/leaderboard?game=${game}`, { signal, auth: false }).then((r) => r.items),
    staleTime: 10_000,
  });
}
