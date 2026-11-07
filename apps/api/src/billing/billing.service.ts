import { randomUUID, timingSafeEqual } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { formatMoney, type BillingInterval, type Locale, type PlanCode } from '@fandom/shared';
import type { CheckoutInput, ConfirmPaymentInput } from '@fandom/schemas';
import type { BillingConfig, CheckoutResponse, ConfirmPaymentResponse, PaymentSummary, SubscriptionDetails } from '@fandom/types';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DatabaseService, type Queryable } from '../database/database.service.js';
import { MailService } from '../mail/mail.service.js';
import { EntitlementsService, entitledPlan } from '../subscriptions/entitlements.service.js';
import { InfinitePayClient, PaymentProviderError } from './infinitepay.client.js';
import { PAYMENT_COLUMNS, toPaymentSummary } from './payments.mapper.js';

const PLAN_NAMES: Record<Exclude<PlanCode, 'free'>, string> = { plus: 'Fandom Plus', ultra: 'Fandom Ultra' };
const INTERVAL_NAMES: Record<Locale, Record<BillingInterval, string>> = {
  'pt-BR': { month: 'mensal', year: 'anual' },
  en: { month: 'monthly', year: 'yearly' },
};
const MAX_PENDING_PER_HOUR = 5;

interface PaymentRow {
  id: string;
  user_id: string;
  plan_code: Exclude<PlanCode, 'free'>;
  price_id: string;
  billing_interval: BillingInterval;
  amount_minor: number;
  currency: string;
  status: PaymentSummary['status'];
  order_nsu: string;
  checkout_url: string | null;
  checkout_expires_at: Date | null;
}

interface OpenSubscription {
  id: string;
  plan_code: Exclude<PlanCode, 'free'>;
  status: 'pending' | 'active' | 'past_due' | 'cancelled';
  billing_interval: BillingInterval;
  current_period_end: Date | null;
  grace_until: Date | null;
  cancel_at_period_end: boolean;
}

export interface WebhookMeta {
  ip: string | null;
}

/**
 * Fandom Premium billing on InfinitePay. Periods are prepaid (the provider has no recurring
 * API). The ONLY way a subscription becomes active is `applyVerifiedPayment`, which runs
 * after the provider's /payment_check confirmed the payment and the expected amount.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly client: InfinitePayClient,
    private readonly entitlements: EntitlementsService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  get enabled(): boolean {
    return this.client.configured && Boolean(this.env.INFINITEPAY_WEBHOOK_TOKEN && this.env.API_PUBLIC_URL);
  }

  config(): BillingConfig {
    return { enabled: this.enabled, provider: this.enabled ? 'infinitepay' : null, currency: 'BRL', autoRenew: false };
  }

  private async openSubscription(userId: string, lock = false, q: Queryable = this.db.pool): Promise<OpenSubscription | null> {
    const { rows } = await q.query<OpenSubscription>(
      `SELECT s.id, s.plan_code, s.status, p.billing_interval, s.current_period_end, s.grace_until, s.cancel_at_period_end
         FROM subscriptions s JOIN plan_prices p ON p.id = s.price_id
        WHERE s.user_id = $1 AND s.status IN ('pending','active','past_due','cancelled')
        LIMIT 1 ${lock ? 'FOR UPDATE OF s' : ''}`,
      [userId],
    );
    return rows[0] ?? null;
  }

  // ------------------------------------------------------------------ eligibility

  private async eligibility(user: AuthenticatedUser): Promise<{ ok: true; locale: Locale; name: string | null } | { ok: false; error: AppError }> {
    const p = await this.db.one<{ done: boolean; is_minor: boolean; locale: Locale; display_name: string | null }>(
      'SELECT onboarding_completed_at IS NOT NULL AS done, is_minor, locale, display_name FROM profiles WHERE user_id = $1',
      [user.id],
    );
    if (!p?.done) return { ok: false, error: AppError.forbidden('onboarding_required', 'Complete onboarding first') };
    // Protection of minors: no paid purchases by users under 18.
    if (p.is_minor) return { ok: false, error: AppError.forbidden('minor_purchase_blocked', 'Purchases are not available for minors') };
    if (!user.emailVerified) return { ok: false, error: AppError.forbidden('email_not_verified', 'Verify your email first') };
    return { ok: true, locale: p.locale, name: p.display_name };
  }

  // ------------------------------------------------------------------ checkout

  async checkout(user: AuthenticatedUser, input: CheckoutInput): Promise<CheckoutResponse> {
    if (!this.enabled) throw new AppError('billing_unavailable', 'Payments are not available yet', HttpStatus.SERVICE_UNAVAILABLE);
    const elig = await this.eligibility(user);
    if (!elig.ok) throw elig.error;

    const price = await this.db.one<{ id: string; amount_minor: number; currency: string }>(
      `SELECT id, amount_minor, currency FROM plan_prices
        WHERE plan_code = $1 AND billing_interval = $2 AND currency = 'BRL' AND is_active AND amount_minor >= 100`,
      [input.planCode, input.interval],
    );
    if (!price) throw AppError.notFound('price_not_found', 'Price not available');

    // Plan changes take effect when the current paid period ends (no proration on InfinitePay).
    const open = await this.openSubscription(user.id);
    if (open && open.plan_code !== input.planCode && entitledPlan(open, new Date()) !== 'free') {
      throw AppError.conflict('plan_change_unavailable', 'You can switch plans when the current period ends');
    }

    // Re-use a still-valid pending link for the same plan/interval instead of creating duplicates.
    const reusable = await this.db.one<PaymentRow>(
      `SELECT * FROM payment_transactions
        WHERE user_id = $1 AND plan_code = $2 AND billing_interval = $3 AND status = 'pending'
          AND checkout_url IS NOT NULL AND checkout_expires_at > now() + interval '1 hour'
        ORDER BY created_at DESC LIMIT 1`,
      [user.id, input.planCode, input.interval],
    );
    if (reusable?.checkout_url) {
      return { checkoutUrl: reusable.checkout_url, orderNsu: reusable.order_nsu, expiresAt: reusable.checkout_expires_at!.toISOString() };
    }
    const recent = await this.db.one<{ n: number }>(
      "SELECT count(*)::int AS n FROM payment_transactions WHERE user_id = $1 AND created_at > now() - interval '1 hour'",
      [user.id],
    );
    if ((recent?.n ?? 0) >= MAX_PENDING_PER_HOUR) {
      throw new AppError('too_many_checkouts', 'Too many checkout attempts', HttpStatus.TOO_MANY_REQUESTS);
    }

    const orderNsu = `fu_${randomUUID().replace(/-/g, '')}`;
    const expiresAt = new Date(Date.now() + this.env.CHECKOUT_LINK_TTL_HOURS * 3_600_000);
    const { rows } = await this.db.query<{ id: string }>(
      `INSERT INTO payment_transactions
         (user_id, provider, plan_code, price_id, billing_interval, amount_minor, currency, order_nsu, checkout_expires_at)
       VALUES ($1, 'infinitepay', $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [user.id, input.planCode, price.id, input.interval, price.amount_minor, price.currency, orderNsu, expiresAt],
    );
    const paymentId = rows[0]!.id;

    const app = this.env.APP_PUBLIC_URL.replace(/\/+$/, '');
    const api = this.env.API_PUBLIC_URL!.replace(/\/+$/, '');
    try {
      const url = await this.client.createLink({
        orderNsu,
        description: `${PLAN_NAMES[input.planCode]} — ${INTERVAL_NAMES[elig.locale][input.interval]}`,
        amountMinor: price.amount_minor,
        redirectUrl: `${app}/account/subscription`,
        webhookUrl: `${api}/v1/billing/webhooks/infinitepay?token=${encodeURIComponent(this.env.INFINITEPAY_WEBHOOK_TOKEN!)}`,
        validUntil: expiresAt,
        customer: { email: user.email, ...(elig.name ? { name: elig.name } : {}) },
      });
      await this.db.query('UPDATE payment_transactions SET checkout_url = $2 WHERE id = $1', [paymentId, url]);
      return { checkoutUrl: url, orderNsu, expiresAt: expiresAt.toISOString() };
    } catch (error) {
      await this.db.query("UPDATE payment_transactions SET status = 'failed' WHERE id = $1", [paymentId]);
      if (error instanceof PaymentProviderError) {
        throw new AppError('payment_provider_error', 'Payment provider unavailable, try again', HttpStatus.BAD_GATEWAY);
      }
      throw error;
    }
  }

  // ------------------------------------------------------------------ confirmation

  /** Return from the checkout (redirect_url params). Verified with the provider, never trusted as-is. */
  async confirm(user: AuthenticatedUser, input: ConfirmPaymentInput): Promise<ConfirmPaymentResponse> {
    const payment = await this.db.one<PaymentRow>('SELECT * FROM payment_transactions WHERE order_nsu = $1 AND user_id = $2', [
      input.orderNsu,
      user.id,
    ]);
    if (!payment) throw AppError.notFound('payment_not_found', 'Payment not found');
    let status: 'paid' | 'pending' = payment.status === 'paid' ? 'paid' : 'pending';
    if (status !== 'paid') {
      try {
        status = await this.verifyAndApply(payment, input.transactionNsu, input.slug, null);
      } catch (error) {
        if (!(error instanceof PaymentProviderError)) throw error;
        this.logger.warn(`confirm: provider unreachable for ${payment.order_nsu}; webhook will settle it`);
      }
    }
    return { status, subscription: await this.entitlements.snapshot(user.id) };
  }

  /** Provider notification. Unsigned by design: authenticated by URL token + /payment_check. */
  async handleWebhook(token: string | undefined, payload: Record<string, unknown>, meta: WebhookMeta): Promise<string> {
    const expected = this.env.INFINITEPAY_WEBHOOK_TOKEN;
    if (!expected || !token || token.length !== expected.length || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      throw AppError.unauthorized('invalid_webhook_token', 'Invalid webhook token');
    }
    const str = (v: unknown) => (typeof v === 'string' && v.length <= 200 ? v : null);
    const orderNsu = str(payload.order_nsu);
    const transactionNsu = str(payload.transaction_nsu);
    const slug = str(payload.invoice_slug) ?? str(payload.slug);
    const receiptUrl = str(payload.receipt_url);
    const { rows } = await this.db.query<{ id: string }>(
      `INSERT INTO payment_webhook_events (provider, order_nsu, transaction_nsu, payload, ip_address)
       VALUES ('infinitepay', $1, $2, $3, $4) RETURNING id`,
      [orderNsu, transactionNsu, JSON.stringify(payload).slice(0, 20_000), meta.ip],
    );
    const eventId = rows[0]!.id;
    const finish = async (outcome: string) => {
      await this.db.query('UPDATE payment_webhook_events SET processed_at = now(), outcome = $2 WHERE id = $1', [eventId, outcome]);
      return outcome;
    };

    if (!orderNsu || !transactionNsu || !slug) return finish('ignored_missing_fields');
    const payment = await this.db.one<PaymentRow>('SELECT * FROM payment_transactions WHERE order_nsu = $1', [orderNsu]);
    if (!payment) return finish('unknown_order');
    if (payment.status === 'paid') return finish('already_paid');
    // Provider errors propagate (5xx) so InfinitePay retries the notification.
    const status = await this.verifyAndApply(payment, transactionNsu, slug, receiptUrl);
    return finish(status === 'paid' ? 'paid' : 'not_paid');
  }

  private async verifyAndApply(payment: PaymentRow, transactionNsu: string, slug: string, receiptUrl: string | null): Promise<'paid' | 'pending'> {
    const check = await this.client.paymentCheck({ orderNsu: payment.order_nsu, transactionNsu, slug });
    if (!check.success || !check.paid) return 'pending';
    if (check.amount !== payment.amount_minor) {
      this.logger.error(`amount mismatch on ${payment.order_nsu}: expected ${payment.amount_minor}, provider ${check.amount}`);
      await this.audit.log(this.db.pool, {
        actorUserId: null, action: 'billing.amount_mismatch', targetType: 'payment', targetId: payment.id,
        metadata: { expected: payment.amount_minor, provider: check.amount },
      });
      return 'pending';
    }

    const applied = await this.db.transaction(async (tx) => {
      const locked = await tx.query<{ status: string }>('SELECT status FROM payment_transactions WHERE id = $1 FOR UPDATE', [payment.id]);
      if (locked.rows[0]?.status === 'paid') return null; // concurrent webhook + confirm: idempotent
      const open = await this.openSubscription(payment.user_id, true, tx);
      const intervalSql = payment.billing_interval === 'year' ? "interval '1 year'" : "interval '1 month'";
      let subscriptionId: string;
      let fromStatus: string | null = null;

      const stillPaid = open && open.current_period_end && open.current_period_end > new Date() && open.status !== 'pending';
      if (open && open.plan_code === payment.plan_code) {
        // Renewal: extend from the end of the paid period (or from now if it already lapsed).
        fromStatus = open.status;
        await tx.query(
          `UPDATE subscriptions SET status = 'active', price_id = $2,
                  current_period_start = CASE WHEN current_period_end > now() THEN current_period_start ELSE now() END,
                  current_period_end = GREATEST(COALESCE(current_period_end, now()), now()) + ${intervalSql},
                  grace_until = NULL, cancel_at_period_end = false, cancelled_at = NULL, renewal_reminder_sent_for = NULL
            WHERE id = $1`,
          [open.id, payment.price_id],
        );
        subscriptionId = open.id;
      } else {
        if (open) {
          // Different plan: only reachable after the old period ended (checkout blocks it before).
          await tx.query("UPDATE subscriptions SET status = 'expired' WHERE id = $1", [open.id]);
          await tx.query(
            `INSERT INTO subscription_status_history (subscription_id, from_status, to_status, reason, actor)
             VALUES ($1, $2, 'expired', $3, 'billing')`,
            [open.id, open.status, stillPaid ? 'replaced_by_new_plan_early' : 'replaced_by_new_plan'],
          );
        }
        const { rows } = await tx.query<{ id: string }>(
          `INSERT INTO subscriptions (user_id, plan_code, price_id, status, provider, provider_customer_id,
                                      current_period_start, current_period_end)
           VALUES ($1, $2, $3, 'active', 'infinitepay', NULL, now(), now() + ${intervalSql}) RETURNING id`,
          [payment.user_id, payment.plan_code, payment.price_id],
        );
        subscriptionId = rows[0]!.id;
      }
      await tx.query(
        `INSERT INTO subscription_status_history (subscription_id, from_status, to_status, reason, actor)
         VALUES ($1, $2, 'active', 'payment_confirmed', 'billing:infinitepay')`,
        [subscriptionId, fromStatus],
      );
      const { rows: subRows } = await tx.query<{ current_period_start: Date; current_period_end: Date }>(
        'SELECT current_period_start, current_period_end FROM subscriptions WHERE id = $1',
        [subscriptionId],
      );
      await tx.query(
        `UPDATE payment_transactions SET status = 'paid', paid_at = now(), subscription_id = $2,
                provider_transaction_nsu = $3, provider_invoice_slug = $4, paid_amount_minor = $5,
                installments = $6, capture_method = $7, receipt_url = COALESCE($8, receipt_url),
                period_start = $9, period_end = $10
          WHERE id = $1`,
        [payment.id, subscriptionId, transactionNsu, slug, check.paidAmount, check.installments, check.captureMethod,
         receiptUrl, subRows[0]!.current_period_start, subRows[0]!.current_period_end],
      );
      await this.audit.log(tx, {
        actorUserId: payment.user_id, action: 'billing.payment_confirmed', targetType: 'payment', targetId: payment.id,
        metadata: { plan: payment.plan_code, interval: payment.billing_interval, amount: payment.amount_minor, method: check.captureMethod },
      });
      return { until: subRows[0]!.current_period_end };
    });

    if (applied) await this.sendActivationEmail(payment, applied.until);
    return 'paid';
  }

  private async sendActivationEmail(payment: PaymentRow, until: Date): Promise<void> {
    const u = await this.db.one<{ email: string; locale: Locale; timezone: string }>(
      'SELECT u.email, p.locale, p.timezone FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = $1',
      [payment.user_id],
    );
    if (!u) return;
    try {
      await this.mail.send({
        to: u.email,
        template: 'subscription_activated',
        locale: u.locale,
        link: `${this.env.APP_PUBLIC_URL.replace(/\/+$/, '')}/account/subscription`,
        details: {
          plan: `${PLAN_NAMES[payment.plan_code]} (${INTERVAL_NAMES[u.locale][payment.billing_interval]})`,
          until: new Intl.DateTimeFormat(u.locale, { dateStyle: 'long', timeZone: u.timezone }).format(until),
          amount: formatMoney(payment.amount_minor, payment.currency, u.locale),
        },
      });
    } catch (error) {
      this.logger.error(`activation email failed for ${payment.id}: ${(error as Error).message}`);
    }
  }

  // ------------------------------------------------------------------ management

  async details(user: AuthenticatedUser): Promise<SubscriptionDetails> {
    const [snapshot, open, payments, elig] = await Promise.all([
      this.entitlements.snapshot(user.id),
      this.openSubscription(user.id),
      this.db.query<Record<string, unknown>>(
        `SELECT ${PAYMENT_COLUMNS} FROM payment_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [user.id],
      ),
      this.eligibility(user),
    ]);
    const price = open
      ? await this.db.one<{ amount_minor: number; currency: string }>(
          'SELECT p.amount_minor, p.currency FROM subscriptions s JOIN plan_prices p ON p.id = s.price_id WHERE s.id = $1',
          [open.id],
        )
      : null;
    return {
      subscription: snapshot,
      currentPrice: price ? { amountMinor: price.amount_minor, currency: price.currency } : null,
      payments: payments.rows.map(toPaymentSummary),
      canCheckout: this.enabled && elig.ok,
      renewablePlan: open && snapshot.planCode !== 'free' ? open.plan_code : null,
    };
  }

  /** Prepaid model: cancelling stops renewal reminders; benefits last until the paid period ends. */
  async cancel(user: AuthenticatedUser): Promise<SubscriptionDetails> {
    await this.db.transaction(async (tx) => {
      const open = await this.openSubscription(user.id, true, tx);
      if (!open || !['active', 'past_due'].includes(open.status)) throw AppError.notFound('no_active_subscription', 'No active subscription');
      await tx.query("UPDATE subscriptions SET status = 'cancelled', cancel_at_period_end = true, cancelled_at = now() WHERE id = $1", [open.id]);
      await tx.query(
        "INSERT INTO subscription_status_history (subscription_id, from_status, to_status, reason, actor) VALUES ($1, $2, 'cancelled', 'user_cancelled', $3)",
        [open.id, open.status, `user:${user.id}`],
      );
      await this.audit.log(tx, { actorUserId: user.id, action: 'billing.subscription_cancelled', targetType: 'subscription', targetId: open.id });
    });
    return this.details(user);
  }

  async reactivate(user: AuthenticatedUser): Promise<SubscriptionDetails> {
    await this.db.transaction(async (tx) => {
      const open = await this.openSubscription(user.id, true, tx);
      if (!open || open.status !== 'cancelled' || !open.current_period_end || open.current_period_end <= new Date()) {
        throw AppError.conflict('cannot_reactivate', 'Nothing to reactivate: start a new subscription instead');
      }
      await tx.query("UPDATE subscriptions SET status = 'active', cancel_at_period_end = false, cancelled_at = NULL WHERE id = $1", [open.id]);
      await tx.query(
        "INSERT INTO subscription_status_history (subscription_id, from_status, to_status, reason, actor) VALUES ($1, 'cancelled', 'active', 'user_reactivated', $2)",
        [open.id, `user:${user.id}`],
      );
    });
    return this.details(user);
  }
}
