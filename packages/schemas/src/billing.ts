import { z } from 'zod';

export const checkoutSchema = z.object({
  planCode: z.enum(['plus', 'ultra', 'vip']),
  interval: z.enum(['month', 'year']),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

const ref = z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9_.:-]+$/, 'invalid_reference');

/** Parameters InfinitePay appends to redirect_url; verified server-side with /payment_check. */
export const confirmPaymentSchema = z.object({
  orderNsu: ref,
  transactionNsu: ref,
  slug: ref,
});
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
