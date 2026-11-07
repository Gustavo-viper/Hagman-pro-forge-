import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env.js';
import { createMailer, mailerHost } from '../src/mailer.js';

const base = { DATABASE_URL: 'postgres://x', REDIS_URL: 'redis://x' };

describe('mailer config', () => {
  it('is disabled without SMTP settings', () => {
    const env = loadEnv(base);
    expect(createMailer(env)).toBeNull();
    expect(mailerHost(env)).toBeNull();
  });
  it('builds an implicit-TLS transport for Gmail on 465 without leaking the password', () => {
    const env = loadEnv({ ...base, SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'a@gmail.com', SMTP_PASSWORD: 'secretpass' });
    const t = createMailer(env)!;
    const opts = t.options as { host: string; port: number; secure: boolean };
    expect(opts).toMatchObject({ host: 'smtp.gmail.com', port: 465, secure: true });
    expect(mailerHost(env)).toBe('smtp.gmail.com:465');
    expect(mailerHost(env)).not.toContain('secretpass');
  });
  it('requires STARTTLS on 587', () => {
    const env = loadEnv({ ...base, SMTP_HOST: 'smtp.x.com', SMTP_PORT: '587', SMTP_USER: 'u', SMTP_PASSWORD: 'p' });
    expect(createMailer(env)!.options).toMatchObject({ secure: false, requireTLS: true });
  });
  it('accepts SMTP_URL and hides credentials in logs', () => {
    const env = loadEnv({ ...base, SMTP_URL: 'smtps://u%40x.com:pw@smtp.x.com:465' });
    expect(createMailer(env)).not.toBeNull();
    expect(mailerHost(env)).toBe('smtp.x.com:465');
  });
});
