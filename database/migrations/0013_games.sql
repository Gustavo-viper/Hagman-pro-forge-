-- 0013 — Universe mini-games: daily challenge, speed round and hangman.
-- Every game is played against the server: answers and hidden words never leave the API
-- before they are earned, and XP is granted once per session through the XP ledger with
-- daily caps (anti-farm).

-- Hangman word bank (proper names are kept as written; matching ignores accents/case).
CREATE TABLE public.game_words (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id uuid NOT NULL REFERENCES public.universes (id) ON DELETE CASCADE,
  word        text NOT NULL CHECK (char_length(word) BETWEEN 3 AND 40 AND word ~ '[A-Za-z]'),
  -- Localized category shown as the hint, e.g. {"pt-BR": "Personagem", "en": "Character"}.
  hint        jsonb NOT NULL CHECK (jsonb_typeof(hint) = 'object'),
  difficulty  text NOT NULL DEFAULT 'normal' CHECK (difficulty IN ('easy', 'normal', 'hard')),
  status      text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'archived')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (universe_id, word)
);
CREATE INDEX game_words_universe_idx ON public.game_words (universe_id, status);

-- One row per game played. `state` is server-only (hidden word, question order, deadline).
CREATE TABLE public.game_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  universe_id uuid NOT NULL REFERENCES public.universes (id) ON DELETE CASCADE,
  game        text NOT NULL CHECK (game IN ('daily', 'speed', 'hangman')),
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'finished')),
  state       jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(state) = 'object'),
  score       integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  total       integer NOT NULL DEFAULT 0 CHECK (total >= 0),
  xp_awarded  integer NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0),
  -- Daily challenge date in America/Sao_Paulo (one play per user, universe and day).
  day         date,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CHECK (game <> 'daily' OR day IS NOT NULL),
  CHECK (status = 'active' OR finished_at IS NOT NULL)
);
CREATE UNIQUE INDEX game_sessions_daily_once ON public.game_sessions (user_id, universe_id, day) WHERE game = 'daily';
CREATE INDEX game_sessions_user_idx ON public.game_sessions (user_id, universe_id, game, started_at DESC);
CREATE INDEX game_sessions_board_idx ON public.game_sessions (universe_id, game, finished_at DESC) WHERE status <> 'active';

-- XP from games gets its own ledger source.
ALTER TABLE public.xp_transactions DROP CONSTRAINT xp_transactions_source_check;
ALTER TABLE public.xp_transactions ADD CONSTRAINT xp_transactions_source_check CHECK (source IN
  ('quiz', 'mission', 'event', 'community_help', 'challenge', 'achievement', 'admin_adjustment', 'onboarding', 'game'));

-- Missions can now target the games.
ALTER TABLE public.missions DROP CONSTRAINT missions_objective_type_check;
ALTER TABLE public.missions ADD CONSTRAINT missions_objective_type_check CHECK (objective_type IN
  ('quiz_complete', 'quiz_perfect', 'forum_topic', 'forum_reply', 'identity_set', 'event_join',
   'hangman_win', 'daily_complete', 'speed_score', 'daily_perfect'));
