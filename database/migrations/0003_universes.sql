-- 0003 — Multi-universe engine. Universes are data, not code: new universes are
-- inserted by the admin panel and rendered dynamically by the web app.

CREATE TABLE public.universes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 64),
  name        jsonb NOT NULL CHECK (jsonb_typeof(name) = 'object'),
  tagline     jsonb NOT NULL CHECK (jsonb_typeof(tagline) = 'object'),
  description jsonb NOT NULL CHECK (jsonb_typeof(description) = 'object'),
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  sort_order  integer NOT NULL DEFAULT 100,
  member_count integer NOT NULL DEFAULT 0 CHECK (member_count >= 0),
  created_by  uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX universes_status_sort_idx ON public.universes (status, sort_order);
CREATE TRIGGER universes_set_updated_at BEFORE UPDATE ON public.universes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.universe_settings (
  universe_id     uuid PRIMARY KEY REFERENCES public.universes (id) ON DELETE CASCADE,
  -- CSS design tokens: {primary, secondary, accent, background, glow}
  theme           jsonb NOT NULL CHECK (jsonb_typeof(theme) = 'object'),
  -- Enabled feature modules, e.g. ["houses","quizzes","bestiary"]
  features        jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(features) = 'array'),
  -- Universe identity system definition (houses, hunter ranks ...).
  identity_config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(identity_config) = 'object'),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER universe_settings_set_updated_at BEFORE UPDATE ON public.universe_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.universe_members (
  universe_id uuid NOT NULL REFERENCES public.universes (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  joined_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (universe_id, user_id)
);
CREATE INDEX universe_members_user_idx ON public.universe_members (user_id);

CREATE TABLE public.universe_profiles (
  universe_id uuid NOT NULL,
  user_id     uuid NOT NULL,
  identity    jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(identity) = 'object'),
  xp          bigint NOT NULL DEFAULT 0 CHECK (xp >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (universe_id, user_id),
  FOREIGN KEY (universe_id, user_id)
    REFERENCES public.universe_members (universe_id, user_id) ON DELETE CASCADE
);
CREATE INDEX universe_profiles_ranking_idx ON public.universe_profiles (universe_id, xp DESC);
CREATE TRIGGER universe_profiles_set_updated_at BEFORE UPDATE ON public.universe_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Keep universes.member_count consistent without COUNT(*) on hot paths.
CREATE OR REPLACE FUNCTION public.universe_member_count() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.universes SET member_count = member_count + 1 WHERE id = NEW.universe_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.universes SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.universe_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER universe_members_count AFTER INSERT OR DELETE ON public.universe_members
  FOR EACH ROW EXECUTE FUNCTION public.universe_member_count();
