-- 0002 — Users, profiles and consent records.
-- users.id is the Supabase Auth user id (auth.users.id). The API creates the row on the
-- first authenticated request, so the platform also works with any Supabase-compatible issuer.

CREATE TABLE public.users (
  id             uuid PRIMARY KEY,
  email          citext NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  status         text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'suspended', 'banned', 'deleted')),
  last_seen_at   timestamptz,
  deleted_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON public.users (email) WHERE deleted_at IS NULL;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.profiles (
  user_id                 uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  username                citext UNIQUE
                          CHECK (username ~ '^(?!\.)(?!.*\.$)(?!.*\.\.)[a-z0-9_.]{3,24}$'),
  display_name            text CHECK (char_length(display_name) BETWEEN 1 AND 50),
  bio                     text CHECK (char_length(bio) <= 500),
  avatar_url              text CHECK (char_length(avatar_url) <= 1024),
  cover_url               text CHECK (char_length(cover_url) <= 1024),
  country                 char(2) CHECK (country ~ '^[A-Z]{2}$'),
  locale                  text NOT NULL DEFAULT 'pt-BR' CHECK (locale IN ('pt-BR', 'en')),
  timezone                text NOT NULL DEFAULT 'America/Sao_Paulo' CHECK (char_length(timezone) <= 64),
  birthdate               date CHECK (birthdate > DATE '1900-01-01'),
  is_minor                boolean NOT NULL DEFAULT false,
  -- Privacy settings. Minors get restrictive defaults applied by the API at onboarding.
  privacy                 jsonb NOT NULL DEFAULT
                          '{"profileVisibility":"public","allowMessagesFrom":"everyone","showOnlineStatus":true}'::jsonb,
  xp_total                bigint NOT NULL DEFAULT 0 CHECK (xp_total >= 0),
  onboarding_completed_at timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profiles_xp_total_idx ON public.profiles (xp_total DESC);
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Append-only consent evidence (LGPD art. 8 — the controller must prove consent).
CREATE TABLE public.user_consents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN ('terms_of_use', 'privacy_policy', 'marketing_email')),
  version      text NOT NULL CHECK (char_length(version) <= 32),
  granted      boolean NOT NULL,
  ip_address   inet,
  user_agent   text CHECK (char_length(user_agent) <= 512),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_consents_user_type_idx ON public.user_consents (user_id, consent_type, created_at DESC);
