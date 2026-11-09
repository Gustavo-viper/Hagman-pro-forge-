-- 0019 — Cultural wallpaper contests. Free to enter and judged on merit (community vote +
-- final decision by the staff jury), with no link to any purchase or plan: the format the law
-- exempts from authorization (Lei 5.768/71, art. 3º, II). Entries are moderated before showing.
CREATE TABLE public.contests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 80),
  title                jsonb NOT NULL CHECK (jsonb_typeof(title) = 'object'),
  description          jsonb NOT NULL CHECK (jsonb_typeof(description) = 'object'),
  rules                jsonb NOT NULL CHECK (jsonb_typeof(rules) = 'object'),
  prize                jsonb NOT NULL CHECK (jsonb_typeof(prize) = 'object'),
  universe_id          uuid REFERENCES public.universes (id) ON DELETE SET NULL,
  submissions_open_at  timestamptz NOT NULL,
  submissions_close_at timestamptz NOT NULL,
  voting_close_at      timestamptz NOT NULL,
  status               text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'finished', 'cancelled')),
  winner_entry_id      uuid,
  created_by           uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (submissions_close_at > submissions_open_at AND voting_close_at > submissions_close_at)
);
CREATE TRIGGER contests_set_updated_at BEFORE UPDATE ON public.contests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.contest_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id  uuid NOT NULL REFERENCES public.contests (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  title       text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  description text CHECK (char_length(description) <= 300),
  image       bytea NOT NULL,
  thumb       bytea NOT NULL,
  width       integer NOT NULL CHECK (width > 0),
  height      integer NOT NULL CHECK (height > 0),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  vote_count  integer NOT NULL DEFAULT 0 CHECK (vote_count >= 0),
  reviewed_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- One active entry per person and contest (a withdrawn or rejected entry can be replaced).
CREATE UNIQUE INDEX contest_entries_one_per_user ON public.contest_entries (contest_id, user_id) WHERE status IN ('pending', 'approved');
CREATE INDEX contest_entries_contest_idx ON public.contest_entries (contest_id, status, vote_count DESC);
ALTER TABLE public.contests ADD CONSTRAINT contests_winner_fk FOREIGN KEY (winner_entry_id) REFERENCES public.contest_entries (id) ON DELETE SET NULL;

-- One vote per person and contest (can be moved to another entry while voting is open).
CREATE TABLE public.contest_votes (
  contest_id uuid NOT NULL REFERENCES public.contests (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  entry_id   uuid NOT NULL REFERENCES public.contest_entries (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)
);
