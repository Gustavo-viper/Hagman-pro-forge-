-- 0011 — Universe sections: knowledge archive, community forum (with moderation),
-- missions/challenges and events. Section keys come from universe_settings.features and
-- are mapped to engines in packages/shared/src/sections.ts.

-- Knowledge archive (curated by staff; original texts only).
CREATE TABLE public.lore_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id uuid NOT NULL REFERENCES public.universes (id) ON DELETE CASCADE,
  section     text NOT NULL CHECK (section ~ '^[a-z_]{2,40}$'),
  slug        text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 80),
  title       jsonb NOT NULL CHECK (jsonb_typeof(title) = 'object'),
  subtitle    jsonb CHECK (subtitle IS NULL OR jsonb_typeof(subtitle) = 'object'),
  summary     jsonb NOT NULL CHECK (jsonb_typeof(summary) = 'object'),
  tags        text[] NOT NULL DEFAULT '{}',
  status      text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order  integer NOT NULL DEFAULT 100,
  created_by  uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (universe_id, section, slug)
);
CREATE INDEX lore_entries_section_idx ON public.lore_entries (universe_id, section, status, sort_order);
CREATE TRIGGER lore_entries_set_updated_at BEFORE UPDATE ON public.lore_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Community forum. Bodies are plain text (rendered escaped). identity_scope restricts a
-- topic to members with that identity (e.g. a house common room).
CREATE TABLE public.forum_topics (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id      uuid NOT NULL REFERENCES public.universes (id) ON DELETE CASCADE,
  category         text NOT NULL CHECK (category ~ '^[a-z_]{2,40}$'),
  identity_scope   text CHECK (char_length(identity_scope) <= 50),
  author_id        uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  title            text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 140),
  body             text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  status           text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'deleted')),
  reply_count      integer NOT NULL DEFAULT 0 CHECK (reply_count >= 0),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX forum_topics_listing_idx ON public.forum_topics (universe_id, category, status, last_activity_at DESC, id DESC);
CREATE INDEX forum_topics_author_idx ON public.forum_topics (author_id, created_at DESC);

CREATE TABLE public.forum_replies (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id   uuid NOT NULL REFERENCES public.forum_topics (id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 3000),
  status     text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX forum_replies_topic_idx ON public.forum_replies (topic_id, created_at, id);
CREATE INDEX forum_replies_author_idx ON public.forum_replies (author_id, created_at DESC);

-- User reports on community content, reviewed in /admin.
CREATE TABLE public.reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('topic', 'reply')),
  target_id   uuid NOT NULL,
  reason      text NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate', 'sexual', 'violence', 'personal_data', 'spoiler', 'other')),
  details     text CHECK (char_length(details) <= 500),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_type, target_id)
);
CREATE INDEX reports_open_idx ON public.reports (status, created_at DESC);

-- Missions / challenges: progress is computed from real activity; completion is claimed once.
CREATE TABLE public.missions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id     uuid NOT NULL REFERENCES public.universes (id) ON DELETE CASCADE,
  section         text NOT NULL CHECK (section ~ '^[a-z_]{2,40}$'),
  slug            text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 80),
  title           jsonb NOT NULL CHECK (jsonb_typeof(title) = 'object'),
  description     jsonb NOT NULL CHECK (jsonb_typeof(description) = 'object'),
  objective_type  text NOT NULL CHECK (objective_type IN ('quiz_complete', 'quiz_perfect', 'forum_topic', 'forum_reply', 'identity_set', 'event_join')),
  objective_count integer NOT NULL DEFAULT 1 CHECK (objective_count BETWEEN 1 AND 1000),
  xp_reward       integer NOT NULL CHECK (xp_reward BETWEEN 1 AND 1000),
  starts_at       timestamptz,
  ends_at         timestamptz,
  status          text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order      integer NOT NULL DEFAULT 100,
  UNIQUE (universe_id, slug)
);
CREATE INDEX missions_universe_idx ON public.missions (universe_id, status, sort_order);

CREATE TABLE public.mission_completions (
  mission_id   uuid NOT NULL REFERENCES public.missions (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mission_id, user_id)
);

-- Events calendar with registration. premium_plan restricts registration server-side.
CREATE TABLE public.events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id  uuid NOT NULL REFERENCES public.universes (id) ON DELETE CASCADE,
  slug         text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 80),
  title        jsonb NOT NULL CHECK (jsonb_typeof(title) = 'object'),
  description  jsonb NOT NULL CHECK (jsonb_typeof(description) = 'object'),
  kind         text NOT NULL DEFAULT 'community' CHECK (kind IN ('community', 'tournament', 'watch_party', 'challenge')),
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  premium_plan text CHECK (premium_plan IN ('plus', 'ultra')),
  capacity     integer CHECK (capacity > 0),
  participant_count integer NOT NULL DEFAULT 0 CHECK (participant_count >= 0),
  status       text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'cancelled')),
  CHECK (ends_at > starts_at),
  UNIQUE (universe_id, slug)
);
CREATE INDEX events_universe_idx ON public.events (universe_id, status, starts_at);

CREATE TABLE public.event_participants (
  event_id      uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  registered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX event_participants_user_idx ON public.event_participants (user_id);

CREATE OR REPLACE FUNCTION public.event_participant_count() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.events SET participant_count = participant_count + 1 WHERE id = NEW.event_id;
  ELSE
    UPDATE public.events SET participant_count = GREATEST(participant_count - 1, 0) WHERE id = OLD.event_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER event_participants_count AFTER INSERT OR DELETE ON public.event_participants
  FOR EACH ROW EXECUTE FUNCTION public.event_participant_count();
