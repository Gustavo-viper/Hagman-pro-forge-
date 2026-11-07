-- 0006 — Fandom Premium catalog and subscription state.
-- Payment provider tables (payment_transactions, payment_webhook_events) arrive in stage 10.

CREATE TABLE public.subscription_plans (
  code        text PRIMARY KEY CHECK (code IN ('free', 'plus', 'ultra')),
  name        jsonb NOT NULL CHECK (jsonb_typeof(name) = 'object'),
  description jsonb NOT NULL CHECK (jsonb_typeof(description) = 'object'),
  benefits    jsonb NOT NULL CHECK (jsonb_typeof(benefits) = 'object'),
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER subscription_plans_set_updated_at BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Prices are configured per currency. No currency conversion is ever computed.
CREATE TABLE public.plan_prices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code         text NOT NULL REFERENCES public.subscription_plans (code) ON DELETE RESTRICT,
  billing_interval  text NOT NULL CHECK (billing_interval IN ('month', 'year')),
  currency          char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  amount_minor      integer NOT NULL CHECK (amount_minor >= 0),
  provider          text CHECK (provider IN ('mercadopago', 'stripe')),
  provider_price_id text CHECK (char_length(provider_price_id) <= 200),
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_code, billing_interval, currency)
);
CREATE TRIGGER plan_prices_set_updated_at BEFORE UPDATE ON public.plan_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  plan_code                text NOT NULL REFERENCES public.subscription_plans (code),
  price_id                 uuid NOT NULL REFERENCES public.plan_prices (id),
  status                   text NOT NULL CHECK (status IN ('pending', 'active', 'past_due', 'cancelled', 'expired')),
  provider                 text NOT NULL CHECK (provider IN ('mercadopago', 'stripe')),
  provider_subscription_id text CHECK (char_length(provider_subscription_id) <= 200),
  provider_customer_id     text CHECK (char_length(provider_customer_id) <= 200),
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  grace_until              timestamptz,
  cancel_at_period_end     boolean NOT NULL DEFAULT false,
  cancelled_at             timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CHECK (plan_code <> 'free'),
  UNIQUE (provider, provider_subscription_id)
);
-- A user can have at most one subscription that is not finished.
CREATE UNIQUE INDEX subscriptions_one_open_per_user
  ON public.subscriptions (user_id) WHERE status IN ('pending', 'active', 'past_due', 'cancelled');
CREATE INDEX subscriptions_status_period_idx ON public.subscriptions (status, current_period_end);
CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- History of every status change (who/what changed it and why).
CREATE TABLE public.subscription_status_history (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions (id) ON DELETE CASCADE,
  from_status     text,
  to_status       text NOT NULL,
  reason          text NOT NULL CHECK (char_length(reason) <= 200),
  actor           text NOT NULL CHECK (char_length(actor) <= 100),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscription_status_history_sub_idx
  ON public.subscription_status_history (subscription_id, created_at DESC);
