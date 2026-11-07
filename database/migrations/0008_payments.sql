-- 0008 — Payments (InfinitePay Checkout Integrado).
-- InfinitePay only issues one-off payment links (no recurring API), so Fandom Premium is
-- sold as prepaid periods: each confirmed payment activates or extends a subscription by one
-- month/year. A subscription is NEVER activated from the browser redirect alone: every
-- payment is confirmed server-side with the provider's /payment_check before it counts.

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_provider_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_provider_check CHECK (provider IN ('infinitepay', 'mercadopago', 'stripe'));
ALTER TABLE public.plan_prices DROP CONSTRAINT IF EXISTS plan_prices_provider_check;
ALTER TABLE public.plan_prices
  ADD CONSTRAINT plan_prices_provider_check CHECK (provider IN ('infinitepay', 'mercadopago', 'stripe'));

-- Renewal reminder bookkeeping (one reminder per paid period).
ALTER TABLE public.subscriptions ADD COLUMN renewal_reminder_sent_for timestamptz;

CREATE TABLE public.payment_transactions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  subscription_id          uuid REFERENCES public.subscriptions (id) ON DELETE SET NULL,
  provider                 text NOT NULL CHECK (provider IN ('infinitepay', 'mercadopago', 'stripe')),
  plan_code                text NOT NULL REFERENCES public.subscription_plans (code),
  price_id                 uuid NOT NULL REFERENCES public.plan_prices (id),
  billing_interval         text NOT NULL CHECK (billing_interval IN ('month', 'year')),
  amount_minor             integer NOT NULL CHECK (amount_minor >= 100),
  currency                 char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status                   text NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'refunded')),
  -- Our order reference sent to the provider (order_nsu). Unique and unguessable.
  order_nsu                text NOT NULL UNIQUE CHECK (char_length(order_nsu) <= 100),
  checkout_url             text CHECK (char_length(checkout_url) <= 1000),
  checkout_expires_at      timestamptz,
  provider_invoice_slug    text CHECK (char_length(provider_invoice_slug) <= 200),
  provider_transaction_nsu text CHECK (char_length(provider_transaction_nsu) <= 200),
  paid_amount_minor        integer CHECK (paid_amount_minor >= 0),
  installments             integer CHECK (installments BETWEEN 1 AND 24),
  capture_method           text CHECK (char_length(capture_method) <= 30),
  receipt_url              text CHECK (char_length(receipt_url) <= 1000),
  -- Period this payment granted (set when it was applied to the subscription).
  period_start             timestamptz,
  period_end               timestamptz,
  paid_at                  timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_transaction_nsu)
);
CREATE INDEX payment_transactions_user_idx ON public.payment_transactions (user_id, created_at DESC);
CREATE INDEX payment_transactions_status_idx ON public.payment_transactions (status, created_at);
CREATE TRIGGER payment_transactions_set_updated_at BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Raw provider notifications, kept for audit and replay. Processing is idempotent.
CREATE TABLE public.payment_webhook_events (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider         text NOT NULL,
  order_nsu        text,
  transaction_nsu  text,
  payload          jsonb NOT NULL,
  ip_address       inet,
  received_at      timestamptz NOT NULL DEFAULT now(),
  processed_at     timestamptz,
  outcome          text CHECK (char_length(outcome) <= 60)
);
CREATE INDEX payment_webhook_events_order_idx ON public.payment_webhook_events (provider, order_nsu);
CREATE INDEX payment_webhook_events_received_idx ON public.payment_webhook_events (received_at DESC);
