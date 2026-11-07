import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { FullPageLoader } from '@/components/states';
import { useAuth } from './AuthProvider';

/** Client-side redirect only for UX. Every protected API call is authorized by the backend. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
