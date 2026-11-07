-- 0007 — First-party authentication (no external identity provider).
-- Passwords are scrypt hashes; refresh tokens and one-time tokens are stored only as
-- SHA-256 hashes, so a database leak never exposes usable credentials.

CREATE TABLE public.auth_credentials (
  user_id             uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  -- Format: scrypt$N$r$p$<salt b64url>$<hash b64url>
  password_hash       text NOT NULL CHECK (char_length(password_hash) BETWEEN 40 AND 400),
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER auth_credentials_set_updated_at BEFORE UPDATE ON public.auth_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- One row per device/session. Refresh tokens rotate: each use revokes the row and
-- creates a new one in the same family; reusing a revoked token revokes the family.
CREATE TABLE public.auth_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  family_id          uuid NOT NULL,
  refresh_token_hash text NOT NULL UNIQUE CHECK (char_length(refresh_token_hash) = 64),
  user_agent         text CHECK (char_length(user_agent) <= 512),
  ip_address         inet,
  created_at         timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL,
  revoked_at         timestamptz,
  revoked_reason     text CHECK (char_length(revoked_reason) <= 50)
);
CREATE INDEX auth_sessions_user_idx ON public.auth_sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX auth_sessions_family_idx ON public.auth_sessions (family_id);
CREATE INDEX auth_sessions_expires_idx ON public.auth_sessions (expires_at);

-- Email verification and password reset tokens (single use, short-lived).
CREATE TABLE public.auth_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  purpose    text NOT NULL CHECK (purpose IN ('email_verification', 'password_reset')),
  token_hash text NOT NULL UNIQUE CHECK (char_length(token_hash) = 64),
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_tokens_user_purpose_idx ON public.auth_tokens (user_id, purpose) WHERE used_at IS NULL;

-- users.id no longer comes from an external provider.
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();
