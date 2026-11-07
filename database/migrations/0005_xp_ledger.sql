-- 0005 — XP ledger. Every XP change is a row with a UNIQUE idempotency key, so a
-- retried or replayed request can never award XP twice. Totals in profiles.xp_total
-- and universe_profiles.xp are updated in the same transaction by the API.

CREATE TABLE public.xp_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  universe_id     uuid REFERENCES public.universes (id) ON DELETE SET NULL,
  amount          integer NOT NULL CHECK (amount <> 0 AND amount BETWEEN -100000 AND 100000),
  source          text NOT NULL CHECK (source IN
                    ('quiz', 'mission', 'event', 'community_help', 'challenge', 'achievement',
                     'admin_adjustment', 'onboarding')),
  source_ref      text CHECK (char_length(source_ref) <= 200),
  idempotency_key text NOT NULL UNIQUE CHECK (char_length(idempotency_key) <= 200),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX xp_transactions_user_idx ON public.xp_transactions (user_id, created_at DESC);
-- Weekly/monthly rankings aggregate by period and universe.
CREATE INDEX xp_transactions_ranking_idx ON public.xp_transactions (universe_id, created_at, user_id);
