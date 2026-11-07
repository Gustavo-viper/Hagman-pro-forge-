import { useEffect, useRef } from 'react';
import { env } from '@/lib/env';
import { getAccessToken } from '@/lib/session';

/**
 * Subscribes to a Server-Sent Events endpoint with the Authorization header (fetch streaming,
 * so the token never goes in the URL). Reconnects with backoff while `enabled`.
 */
export function useEventStream(path: string, enabled: boolean, onEvent: (data: Record<string, unknown>) => void): void {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let attempt = 0;

    const run = async () => {
      while (!controller.signal.aborted) {
        try {
          const token = await getAccessToken();
          const res = await fetch(`${env.apiUrl}${path}`, {
            headers: { Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            signal: controller.signal,
          });
          if (!res.ok || !res.body) {
            if (res.status === 403 || res.status === 404 || res.status === 409) return; // no access / closed: stop
            throw new Error(`stream ${res.status}`);
          }
          attempt = 0;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n\n');
            buffer = parts.pop() ?? '';
            for (const part of parts) {
              const data = part.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5)).join('\n');
              if (data) {
                try {
                  handler.current(JSON.parse(data) as Record<string, unknown>);
                } catch {
                  /* ignore malformed */
                }
              }
            }
          }
        } catch {
          if (controller.signal.aborted) return;
        }
        attempt++;
        await new Promise((r) => setTimeout(r, Math.min(30_000, 1000 * 2 ** attempt)));
      }
    };
    void run();
    return () => controller.abort();
  }, [path, enabled]);
}
