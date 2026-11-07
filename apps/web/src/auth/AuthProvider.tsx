import type { AuthSessionResponse, AuthUser } from '@fandom/types';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import i18n from '@/lib/i18n';
import { authRequest, getAccessToken, sessionStore, type StoredSession } from '@/lib/session';

interface AuthState {
  session: StoredSession | null;
  user: AuthUser | null;
  /** Kept for API compatibility: the session is read synchronously from storage. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get, () => null);

  // Drop cached private data whenever the signed-in user changes or signs out.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    queryClient.removeQueries({ queryKey: ['me'] });
  }, [userId, queryClient]);

  // Keep the session warm while the tab is open (refresh happens just before expiry).
  useEffect(() => {
    if (!session) return;
    const ms = Math.max(session.accessExpiresAt - Date.now() - 25_000, 5_000);
    const timer = setTimeout(() => void getAccessToken(), ms);
    return () => clearTimeout(timer);
  }, [session]);

  const signIn = useCallback(async (email: string, password: string) => {
    sessionStore.setFromResponse(await authRequest<AuthSessionResponse>('login', { email, password }));
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    // The UI language localizes the verification email.
    const res = await authRequest<AuthSessionResponse>('register', { email, password }, undefined, { 'Accept-Language': i18n.language });
    sessionStore.setFromResponse(res);
  }, []);

  const signOut = useCallback(async () => {
    const token = sessionStore.get()?.accessToken;
    sessionStore.clear();
    if (token) await authRequest('logout', undefined, token).catch(() => undefined);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ session, user: session?.user ?? null, loading: false, signIn, signUp, signOut }),
    [session, signIn, signUp, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

