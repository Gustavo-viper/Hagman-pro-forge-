import nodemailer, { type Transporter } from 'nodemailer';
import type { WorkerEnv } from './env.js';

/**
 * Builds the SMTP transport from SMTP_HOST/PORT/USER/PASSWORD (preferred) or SMTP_URL.
 * Port 465 uses implicit TLS; other ports upgrade with STARTTLS, which is required.
 * Returns null when email delivery is not configured.
 */
export function createMailer(env: WorkerEnv): Transporter | null {
  if (env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      requireTLS: env.SMTP_PORT !== 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? '' } : undefined,
      pool: true,
      maxConnections: 3,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
  }
  if (env.SMTP_URL) return nodemailer.createTransport(env.SMTP_URL);
  return null;
}

/** Host shown in logs — never the credentials. */
export function mailerHost(env: WorkerEnv): string | null {
  if (env.SMTP_HOST) return `${env.SMTP_HOST}:${env.SMTP_PORT}`;
  if (env.SMTP_URL) {
    try {
      const u = new URL(env.SMTP_URL);
      return `${u.hostname}:${u.port || (u.protocol === 'smtps:' ? '465' : '587')}`;
    } catch {
      return 'invalid SMTP_URL';
    }
  }
  return null;
}
