import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runAuthCleanup } from '../src/jobs/auth-cleanup.js';
import { renderEmail } from '../src/jobs/email.js';

describe('email templates', () => {
  const job = {
    to: 'a@b.test',
    template: 'password_reset' as const,
    locale: 'pt-BR' as const,
    link: 'https://fandom.test/reset-password?token=abc"<x>',
    expiresInMinutes: 60,
  };
  it('renders localized subject, text and escaped html', () => {
    const r = renderEmail(job);
    expect(r.subject).toBe('Redefinição de senha — Fandom Universe');
    expect(r.text).toContain('60 minutos');
    expect(r.html).toContain('token=abc&quot;&lt;x&gt;');
    expect(r.html).not.toContain('"<x>');
    expect(renderEmail({ ...job, template: 'email_verification', locale: 'en', expiresInMinutes: 2880 }).text).toContain('48 hours');
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.runIf(Boolean(url))('auth cleanup job', () => {
  const client = new pg.Client({ connectionString: url });
  beforeAll(() => client.connect());
  afterAll(() => client.end());

  it('removes only old revoked/expired sessions and used/expired tokens', async () => {
    const { rows } = await client.query<{ id: string }>("INSERT INTO users (email) VALUES ($1) RETURNING id", [`${randomUUID()}@t.test`]);
    const uid = rows[0]!.id;
    const h = () => randomUUID().replace(/-/g, '').padEnd(64, '0');
    await client.query(
      `INSERT INTO auth_sessions (user_id, family_id, refresh_token_hash, expires_at, revoked_at) VALUES
        ($1, gen_random_uuid(), $2, now() + interval '10 days', now() - interval '40 days'),
        ($1, gen_random_uuid(), $3, now() - interval '40 days', NULL),
        ($1, gen_random_uuid(), $4, now() + interval '10 days', NULL)`,
      [uid, h(), h(), h()],
    );
    await client.query(
      `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at, used_at, created_at) VALUES
        ($1, 'password_reset', $2, now() - interval '39 days', now() - interval '39 days', now() - interval '40 days'),
        ($1, 'email_verification', $3, now() + interval '1 day', NULL, now())`,
      [uid, h(), h()],
    );
    expect(await runAuthCleanup(client)).toEqual({ sessions: 2, tokens: 1 });
    expect((await client.query('SELECT 1 FROM auth_sessions WHERE user_id = $1', [uid])).rowCount).toBe(1);
    expect((await client.query('SELECT 1 FROM auth_tokens WHERE user_id = $1', [uid])).rowCount).toBe(1);
  });
});
