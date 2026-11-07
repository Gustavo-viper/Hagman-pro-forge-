import type { ApiErrorBody } from '@fandom/types';
import { env } from './env';
import { getAccessToken, refreshSession, sessionStore } from './session';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Attach the access token (default true). */
  auth?: boolean;
}

const RETRYABLE_AUTH = new Set(['token_expired', 'invalid_token']);

/** Typed fetch wrapper for the Fandom API. Throws ApiError with the server's stable code. */
export async function api<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'network_error', 'Network error');
  }

  if (res.status === 204 || res.status === 202) return undefined as T;
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    const body = (data ?? {}) as Partial<ApiErrorBody>;
    const code = body.code ?? 'http_error';
    if (res.status === 401 && options.auth !== false && sessionStore.get()) {
      // Clock skew or a just-expired token: refresh once and retry.
      if (!retried && RETRYABLE_AUTH.has(code) && (await refreshSession())) return api<T>(path, options, true);
      if (!RETRYABLE_AUTH.has(code) || retried) sessionStore.clear();
    }
    throw new ApiError(res.status, code, body.message ?? res.statusText, body.details, body.requestId);
  }
  return data as T;
}
