import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { SignJWT } from 'jose';
import { E2E_JWT_SECRET } from '../playwright.config.js';

/** Storage key supabase-js derives from VITE_SUPABASE_URL (http://supabase.e2e.invalid). */
const STORAGE_KEY = 'sb-supabase-auth-token';

export async function signIn(page: Page): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = `e2e-${id.slice(0, 8)}@example.test`;
  const now = Math.floor(Date.now() / 1000);
  const accessToken = await new SignJWT({
    email,
    role: 'authenticated',
    aal: 'aal1',
    session_id: randomUUID(),
    is_anonymous: false,
    user_metadata: { email_verified: true },
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(id)
    .setAudience('authenticated')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(new TextEncoder().encode(E2E_JWT_SECRET));

  const session = {
    access_token: accessToken,
    refresh_token: 'e2e-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    user: {
      id, aud: 'authenticated', role: 'authenticated', email,
      email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email' },
      user_metadata: { email_verified: true }, created_at: new Date().toISOString(),
    },
  };
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value);
      localStorage.setItem('fandom.locale', 'pt-BR');
    },
    [STORAGE_KEY, JSON.stringify(session)] as const,
  );
  return { id, email };
}
