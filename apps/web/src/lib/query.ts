import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => {
        // Never retry client errors (auth, validation, not found).
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return count < 2;
      },
    },
  },
});

export const queryKeys = {
  universes: ['universes'] as const,
  universe: (slug: string) => ['universes', slug] as const,
  plans: (currency: string) => ['plans', currency] as const,
  me: ['me'] as const,
  dashboard: ['me', 'dashboard'] as const,
};
