import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';

export const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long!!';

export function configureTestEnv(overrides: Record<string, string> = {}): void {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: process.env.TEST_DATABASE_URL,
    REDIS_URL: process.env.TEST_REDIS_URL ?? '',
    SUPABASE_JWT_SECRET: TEST_JWT_SECRET,
    SUPABASE_URL: '',
    RATE_LIMIT_MAX: '1000',
    BOOTSTRAP_SUPER_ADMIN_EMAILS: 'founder@forge.test',
    ...overrides,
  });
  for (const k of ['REDIS_URL', 'SUPABASE_URL']) if (!process.env[k]) delete process.env[k];
}

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

/** Signs an HS256 token shaped exactly like a Supabase Auth access token. */
export async function makeUser(
  opts: { email?: string; verified?: boolean; expiresIn?: string; role?: string; secret?: string } = {},
): Promise<TestUser> {
  const id = randomUUID();
  const email = opts.email ?? `user-${id.slice(0, 8)}@example.test`;
  const token = await new SignJWT({
    email,
    role: opts.role ?? 'authenticated',
    aal: 'aal1',
    session_id: randomUUID(),
    is_anonymous: false,
    user_metadata: { email_verified: opts.verified ?? true },
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(id)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? '1h')
    .sign(new TextEncoder().encode(opts.secret ?? TEST_JWT_SECRET));
  return { id, email, token };
}

export const onboardingBody = (overrides: Record<string, unknown> = {}) => ({
  username: `fan_${Math.random().toString(36).slice(2, 10)}`,
  displayName: 'Fã de Teste',
  birthdate: '1995-06-15',
  country: 'BR',
  locale: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  acceptTerms: true,
  acceptPrivacy: true,
  marketingEmail: true,
  ...overrides,
});
