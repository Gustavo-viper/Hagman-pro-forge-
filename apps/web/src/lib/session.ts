import type { AuthSessionResponse, AuthUser } from '@fandom/types';
import { env } from './env';

/**
 * Client-side session for the platform's own authentication (fandom-api).
 *
 * - Access tokens live 15 minutes; they are refreshed shortly before expiry.
 * - Refresh tokens rotate on every use; the API revokes the whole session family
 *   if an old one is replayed. Concurrent refreshes are de-duplicated (single flight)
 *   so a rotation never races itself.
 * - Persisted in localStorage and synchronized across tabs. The strict CSP served by
 *   fandom-web (script-src 'self') is the main mitigation for token theft via XSS.
 */
export interface StoredSession {
  accessToken: string;
  /** epoch ms */
  accessExpiresAt: number;
  refreshToken: string;
  user: AuthUser;
}

const KEY = 'fandom.session';
const REFRESH_MARGIN_MS = 30_000;
const listeners = new Set<() => void>();

function read(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

let current: StoredSession | null = read();

function emit() {
  for (const l of listeners) l();
}

function write(next: StoredSession | null) {
  current = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: session lives in memory only */
  }
  emit();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      current = read();
      emit();
    }
  });
}

export const sessionStore = {
  get: () => current,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setFromResponse(res: AuthSessionResponse) {
    write({
      accessToken: res.accessToken,
      accessExpiresAt: Date.now() + res.expiresIn * 1000,
      refreshToken: res.refreshToken,
      user: res.user,
    });
  },
  updateUser(patch: Partial<AuthUser>) {
    if (current) write({ ...current, user: { ...current.user, ...patch } });
  },
  clear: () => write(null),
};

export class AuthRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

/** Raw call to the auth endpoints (no automatic token handling, to avoid recursion). */
export async function authRequest<T>(
  path: string,
  body?: unknown,
  accessToken?: string,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}/v1/auth/${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new AuthRequestError(0, 'network_error');
  }
  if (res.status === 204 || res.status === 202) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { code?: string };
  if (!res.ok) throw new AuthRequestError(res.status, data.code ?? 'http_error');
  return data as T;
}

let inflight: Promise<StoredSession | null> | null = null;

/** Exchanges the refresh token for a new session. Clears the session if it was rejected. */
export function refreshSession(): Promise<StoredSession | null> {
  inflight ??= (async () => {
    const s = current;
    if (!s) return null;
    try {
      sessionStore.setFromResponse(await authRequest<AuthSessionResponse>('refresh', { refreshToken: s.refreshToken }));
      return current;
    } catch (error) {
      // Network errors keep the session (offline); auth rejections end it.
      if (error instanceof AuthRequestError && error.status !== 0) sessionStore.clear();
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** A valid access token, refreshing first when it is about to expire. */
export async function getAccessToken(): Promise<string | null> {
  const s = current;
  if (!s) return null;
  if (s.accessExpiresAt - Date.now() > REFRESH_MARGIN_MS) return s.accessToken;
  return (await refreshSession())?.accessToken ?? null;
}
