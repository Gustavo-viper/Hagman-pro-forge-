import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

/**
 * InfinitePay "Checkout Integrado" client (https://www.infinitepay.io/checkout-documentacao).
 *
 *   POST {base}/links          create a one-off payment link (X-Api-Key header)
 *   POST {base}/payment_check  confirm a payment (handle, order_nsu, transaction_nsu, slug)
 *
 * The API has no recurring billing, no sandbox and unsigned webhooks: payments are always
 * re-confirmed through payment_check before they count.
 */
export interface CreateLinkInput {
  orderNsu: string;
  description: string;
  amountMinor: number;
  redirectUrl: string;
  webhookUrl: string;
  validUntil: Date;
  customer: { email: string; name?: string };
}

export interface PaymentCheckInput {
  orderNsu: string;
  transactionNsu: string;
  slug: string;
}

export interface PaymentCheckResult {
  success: boolean;
  paid: boolean;
  amount: number | null;
  paidAmount: number | null;
  installments: number | null;
  captureMethod: string | null;
}

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class InfinitePayClient {
  private readonly logger = new Logger(InfinitePayClient.name);

  constructor(@Inject(ENV) private readonly env: Env) {}

  get configured(): boolean {
    return Boolean(this.env.INFINITEPAY_HANDLE && this.env.INFINITEPAY_API_KEY);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${this.env.INFINITEPAY_API_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Api-Key': this.env.INFINITEPAY_API_KEY ?? '',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { raw: text.slice(0, 500) };
      }
      if (!res.ok) {
        // Never log the API key; the body has no secrets.
        this.logger.error(`InfinitePay ${path} → ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
        throw new PaymentProviderError(`InfinitePay ${path} failed with ${res.status}`, res.status);
      }
      return data as T;
    } catch (error) {
      if (error instanceof PaymentProviderError) throw error;
      throw new PaymentProviderError(`InfinitePay ${path} unreachable: ${(error as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async createLink(input: CreateLinkInput): Promise<string> {
    const data = await this.post<Record<string, unknown>>('/links', {
      handle: this.env.INFINITEPAY_HANDLE,
      items: [{ quantity: 1, price: input.amountMinor, description: input.description }],
      order_nsu: input.orderNsu,
      redirect_url: input.redirectUrl,
      webhook: { url: input.webhookUrl, events: ['paid', 'refunded', 'canceled', 'payment_failed'] },
      customer: { email: input.customer.email, ...(input.customer.name ? { name: input.customer.name } : {}) },
      options: {
        single_payment: true,
        valid_until: input.validUntil.toISOString(),
        payment_methods_enabled: ['credit_card', 'pix'],
      },
    });
    // Only HTTPS links are accepted (plain http only for localhost, used by the E2E test double).
    const isSafe = (v: unknown): v is string =>
      typeof v === 'string' && (v.startsWith('https://') || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(v));
    const url = [data.url, data.link, data.checkout_url, (data.data as Record<string, unknown> | undefined)?.url].find(isSafe);
    if (!url) {
      this.logger.error(`InfinitePay /links returned no URL: ${JSON.stringify(data).slice(0, 500)}`);
      throw new PaymentProviderError('InfinitePay /links returned no URL');
    }
    return url;
  }

  async paymentCheck(input: PaymentCheckInput): Promise<PaymentCheckResult> {
    const data = await this.post<Record<string, unknown>>('/payment_check', {
      handle: this.env.INFINITEPAY_HANDLE,
      order_nsu: input.orderNsu,
      transaction_nsu: input.transactionNsu,
      slug: input.slug,
    });
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    return {
      success: data.success === true,
      paid: data.paid === true,
      amount: num(data.amount),
      paidAmount: num(data.paid_amount),
      installments: num(data.installments),
      captureMethod: typeof data.capture_method === 'string' ? data.capture_method : null,
    };
  }
}
