import type { BillingInterval, PlanCode } from '@fandom/shared';
import type { PaymentSummary } from '@fandom/types';

/** Columns expected by `toPaymentSummary` (alias `link_expired` is computed in SQL). */
export const PAYMENT_COLUMNS = `id, plan_code, billing_interval, amount_minor, paid_amount_minor, currency, status, capture_method,
  installments, receipt_url, period_start, period_end, created_at, paid_at,
  (status = 'pending' AND checkout_expires_at < now()) AS link_expired`;

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : null);

export function toPaymentSummary(r: Record<string, unknown>): PaymentSummary {
  return {
    id: r.id as string,
    planCode: r.plan_code as PlanCode,
    interval: r.billing_interval as BillingInterval,
    amountMinor: r.amount_minor as number,
    paidAmountMinor: (r.paid_amount_minor as number | null) ?? null,
    currency: r.currency as string,
    status: (r.link_expired ? 'expired' : r.status) as PaymentSummary['status'],
    captureMethod: (r.capture_method as string | null) ?? null,
    installments: (r.installments as number | null) ?? null,
    receiptUrl: (r.receipt_url as string | null) ?? null,
    periodStart: iso(r.period_start),
    periodEnd: iso(r.period_end),
    createdAt: iso(r.created_at)!,
    paidAt: iso(r.paid_at),
  };
}
