-- 0004 — Staff RBAC and audit trail.

CREATE TABLE public.user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN
                ('super_admin', 'admin', 'global_moderator', 'universe_moderator', 'editor', 'support')),
  -- Only universe_moderator is scoped to a universe.
  universe_id uuid REFERENCES public.universes (id) ON DELETE CASCADE,
  granted_by  uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'universe_moderator') = (universe_id IS NOT NULL))
);
CREATE UNIQUE INDEX user_roles_unique_idx
  ON public.user_roles (user_id, role, COALESCE(universe_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Append-only. Never UPDATE or DELETE rows; the API role only INSERTs.
CREATE TABLE public.audit_logs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  action        text NOT NULL CHECK (char_length(action) <= 100),
  target_type   text CHECK (char_length(target_type) <= 50),
  target_id     text CHECK (char_length(target_id) <= 100),
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address    inet,
  request_id    text CHECK (char_length(request_id) <= 100),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON public.audit_logs (created_at DESC);
CREATE INDEX audit_logs_actor_idx ON public.audit_logs (actor_user_id, created_at DESC);
CREATE INDEX audit_logs_target_idx ON public.audit_logs (target_type, target_id);
