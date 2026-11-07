-- 0009 — Manual plan grants from the admin panel.
-- Staff can grant (or revoke) a plan for a user, e.g. courtesy access or payments received
-- outside the checkout. Every grant records who granted it and why (also in audit_logs).

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_provider_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_provider_check CHECK (provider IN ('infinitepay', 'manual', 'mercadopago', 'stripe'));

ALTER TABLE public.subscriptions ADD COLUMN granted_by uuid REFERENCES public.users (id) ON DELETE SET NULL;
ALTER TABLE public.subscriptions ADD COLUMN grant_note text CHECK (char_length(grant_note) <= 500);

-- Admin user list: newest first with stable cursor, and email/username search.
CREATE INDEX users_created_idx ON public.users (created_at DESC, id DESC);
CREATE INDEX profiles_display_name_idx ON public.profiles (lower(display_name));
