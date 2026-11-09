-- 0018 — VIP prize draws (Steam keys). Promotional draws in Brazil require prior authorization
-- (Lei 5.768/71): a draw can only be opened with the authorization certificate number and the
-- published rules. Winner selection is verifiable: the server commits to a secret seed
-- (sha256 published when the draw opens) and combines it with an external value informed at
-- draw time (e.g. a Loteria Federal result); the seed is revealed after the draw.
CREATE TABLE public.draws (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title              jsonb NOT NULL CHECK (jsonb_typeof(title) = 'object'),
  description        jsonb NOT NULL CHECK (jsonb_typeof(description) = 'object'),
  prize              jsonb NOT NULL CHECK (jsonb_typeof(prize) = 'object'),
  prize_count        integer NOT NULL DEFAULT 1 CHECK (prize_count BETWEEN 1 AND 100),
  required_plan      text NOT NULL DEFAULT 'vip' CHECK (required_plan IN ('plus', 'ultra', 'vip')),
  certificate_number text CHECK (char_length(certificate_number) BETWEEN 3 AND 100),
  regulation_url     text CHECK (regulation_url ~ '^https://' AND char_length(regulation_url) <= 500),
  entries_close_at   timestamptz NOT NULL,
  status             text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'drawn', 'cancelled')),
  seed_hash          text CHECK (seed_hash ~ '^[0-9a-f]{64}$'),
  seed_sealed        text,
  seed               text,
  external_value     text CHECK (char_length(external_value) <= 100),
  opened_at          timestamptz,
  drawn_at           timestamptz,
  created_by         uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  -- The authorization lock, enforced by the database too.
  CHECK (status IN ('draft', 'cancelled') OR (certificate_number IS NOT NULL AND regulation_url IS NOT NULL AND seed_hash IS NOT NULL))
);
CREATE TRIGGER draws_set_updated_at BEFORE UPDATE ON public.draws FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.draw_entries (
  draw_id      uuid NOT NULL REFERENCES public.draws (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  lucky_number integer NOT NULL CHECK (lucky_number >= 1),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (draw_id, user_id),
  UNIQUE (draw_id, lucky_number)
);

-- Prizes won (draws and contests), with the code sealed at rest.
CREATE TABLE public.prizes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  source       text NOT NULL CHECK (source IN ('draw', 'contest')),
  source_id    uuid NOT NULL,
  position     integer NOT NULL DEFAULT 1 CHECK (position >= 1),
  lucky_number integer,
  description  jsonb NOT NULL CHECK (jsonb_typeof(description) = 'object'),
  code_sealed  text,
  delivered_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_id, position)
);
CREATE INDEX prizes_user_idx ON public.prizes (user_id, created_at DESC);
