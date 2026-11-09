-- 0017 — Fandom VIP: a fourth plan above Ultra (includes every Ultra benefit).
ALTER TABLE public.subscription_plans DROP CONSTRAINT subscription_plans_code_check;
ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_code_check CHECK (code IN ('free', 'plus', 'ultra', 'vip'));
ALTER TABLE public.events DROP CONSTRAINT events_premium_plan_check;
ALTER TABLE public.events ADD CONSTRAINT events_premium_plan_check CHECK (premium_plan IN ('plus', 'ultra', 'vip'));
ALTER TABLE public.missions DROP CONSTRAINT missions_premium_plan_check;
ALTER TABLE public.missions ADD CONSTRAINT missions_premium_plan_check CHECK (premium_plan IN ('plus', 'ultra', 'vip'));
