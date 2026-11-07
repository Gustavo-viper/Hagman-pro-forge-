import type { Locale } from './constants.js';

/** BullMQ queue and job names shared by producers (api) and consumers (worker). */
export const QUEUES = {
  maintenance: 'fandom-maintenance',
  email: 'fandom-email',
} as const;

export const JOBS = {
  subscriptionLifecycle: 'subscription-lifecycle',
  authCleanup: 'auth-cleanup',
  sendEmail: 'send-email',
} as const;

export const EMAIL_TEMPLATES = ['email_verification', 'password_reset'] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

export interface EmailJobData {
  to: string;
  template: EmailTemplate;
  locale: Locale;
  /** Absolute link containing a single-use token. Never log it. */
  link: string;
  /** Link validity, shown in the email body. */
  expiresInMinutes: number;
}
