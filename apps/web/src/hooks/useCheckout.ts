import { useMutation } from '@tanstack/react-query';
import type { BillingInterval, PlanCode } from '@fandom/shared';
import type { CheckoutResponse } from '@fandom/types';
import { api } from '@/lib/api';

/**
 * Starts an InfinitePay checkout and sends the browser to the hosted payment page.
 * Activation happens only after the API confirms the payment with the provider.
 */
export function useCheckout() {
  return useMutation({
    mutationFn: (input: { planCode: Exclude<PlanCode, 'free'>; interval: BillingInterval }) =>
      api<CheckoutResponse>('/v1/billing/checkout', { method: 'POST', body: input }),
    onSuccess: (res) => {
      // The URL comes from our API (which got it from the provider); still, only follow HTTPS
      // (plain HTTP is accepted for localhost, used by the E2E test double).
      const url = new URL(res.checkoutUrl);
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
        throw new Error('Unexpected checkout URL');
      }
      window.location.assign(url.toString());
    },
  });
}
