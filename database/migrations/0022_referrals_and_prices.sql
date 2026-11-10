-- 0022 — Invite-a-friend program and new plan prices.
--
-- Every user gets a personal invite code. A referral is recorded when someone registers
-- through that link; it only COUNTS (qualifies) once the friend verified the email and joined
-- at least one universe — computed on read, so nothing has to be kept in sync. Staff can revoke
-- fraudulent referrals. The resulting discount tier is applied server-side at checkout.

CREATE TABLE public.referral_codes (
  user_id    uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  code       text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{6,12}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.referrals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id    uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  -- A person can only ever be referred once.
  referred_id    uuid NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  revoked_at     timestamptz,
  revoked_by     uuid REFERENCES public.users (id) ON DELETE SET NULL,
  revoked_reason text CHECK (char_length(revoked_reason) <= 300),
  CHECK (referrer_id <> referred_id)
);
CREATE INDEX referrals_referrer_idx ON public.referrals (referrer_id, created_at DESC);

-- Checkout keeps the list price and the referral discount that produced amount_minor.
ALTER TABLE public.payment_transactions
  ADD COLUMN list_amount_minor integer CHECK (list_amount_minor IS NULL OR list_amount_minor >= 0),
  ADD COLUMN discount_percent  integer NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 90);

-- New prices (BRL cents). Only rows still at the previous official price are changed, so a
-- price adjusted by staff is never overwritten. Paid periods keep the amount actually paid.
UPDATE public.plan_prices SET amount_minor = 2990  WHERE plan_code = 'plus'  AND billing_interval = 'month' AND currency = 'BRL' AND amount_minor = 1490;
UPDATE public.plan_prices SET amount_minor = 29900 WHERE plan_code = 'plus'  AND billing_interval = 'year'  AND currency = 'BRL' AND amount_minor = 14990;
UPDATE public.plan_prices SET amount_minor = 5990  WHERE plan_code = 'ultra' AND billing_interval = 'month' AND currency = 'BRL' AND amount_minor = 2990;
UPDATE public.plan_prices SET amount_minor = 59900 WHERE plan_code = 'ultra' AND billing_interval = 'year'  AND currency = 'BRL' AND amount_minor = 29990;
UPDATE public.plan_prices SET amount_minor = 7990  WHERE plan_code = 'vip'   AND billing_interval = 'month' AND currency = 'BRL' AND amount_minor = 6990;
