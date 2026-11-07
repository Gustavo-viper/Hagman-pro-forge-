import type { Locale } from './constants.js';

/** BullMQ queue and job names shared by producers (api) and consumers (worker). */
export const QUEUES = {
  maintenance: 'fandom-maintenance',
  email: 'fandom-email',
} as const;

export const JOBS = {
  subscriptionLifecycle: 'subscription-lifecycle',
  authCleanup: 'auth-cleanup',
  renewalReminders: 'renewal-reminders',
  sendEmail: 'send-email',
} as const;

export const EMAIL_TEMPLATES = [
  'email_verification',
  'password_reset',
  'subscription_activated',
  'subscription_renewal_reminder',
] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

export interface EmailJobData {
  to: string;
  template: EmailTemplate;
  locale: Locale;
  /** Absolute link (may contain a single-use token: never log it). */
  link: string;
  /** Link validity, shown in auth emails. */
  expiresInMinutes?: number;
  /** Billing emails: already-formatted, localized values. */
  details?: { plan: string; until: string; amount?: string };
}
