import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { EmailJobData } from '@fandom/shared';
import request from 'supertest';
import { vi } from 'vitest';

export const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long!!';
export const PASSWORD = 'Senha123forte';

export function configureTestEnv(overrides: Record<string, string> = {}): void {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: process.env.TEST_DATABASE_URL,
    REDIS_URL: process.env.TEST_REDIS_URL ?? '',
    AUTH_JWT_SECRET: TEST_JWT_SECRET,
    APP_PUBLIC_URL: 'https://fandom.test',
    RATE_LIMIT_MAX: '10000',
    AUTH_RATE_LIMIT_MAX: '10000',
    BOOTSTRAP_SUPER_ADMIN_EMAILS: 'founder@forge.test',
    ...overrides,
  });
  if (!process.env.REDIS_URL) delete process.env.REDIS_URL;
}

/** Captures every queued email instead of sending it. */
export async function captureMail(app: INestApplication): Promise<EmailJobData[]> {
  const { MailService } = await import('../src/mail/mail.service.js');
  const sent: EmailJobData[] = [];
  vi.spyOn(app.get(MailService), 'send').mockImplementation(async (job) => {
    sent.push(job);
  });
  return sent;
}

export const tokenFrom = (link: string) => new URL(link).searchParams.get('token')!;

export interface TestUser {
  id: string;
  email: string;
  token: string;
  refreshToken: string;
}

export async function register(app: INestApplication, email = `user-${randomUUID().slice(0, 8)}@example.test`): Promise<TestUser> {
  const res = await request(app.getHttpServer()).post('/v1/auth/register').send({ email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { id: res.body.user.id, email, token: res.body.accessToken, refreshToken: res.body.refreshToken };
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
