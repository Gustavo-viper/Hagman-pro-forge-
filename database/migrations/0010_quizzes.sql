-- 0010 — Quizzes inside universes (trivia and personality/sorting quizzes).
-- Grading happens ONLY on the server; the API never sends correct answers before an
-- attempt. XP is granted once per quiz per user through the idempotent XP ledger.

CREATE TABLE public.quizzes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id uuid NOT NULL REFERENCES public.universes (id) ON DELETE CASCADE,
  slug        text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 80),
  kind        text NOT NULL CHECK (kind IN ('trivia', 'personality')),
  title       jsonb NOT NULL CHECK (jsonb_typeof(title) = 'object'),
  description jsonb NOT NULL CHECK (jsonb_typeof(description) = 'object'),
  difficulty  text NOT NULL DEFAULT 'normal' CHECK (difficulty IN ('easy', 'normal', 'hard')),
  -- XP for a perfect first completion (trivia scales with the score).
  xp_reward   integer NOT NULL DEFAULT 50 CHECK (xp_reward BETWEEN 0 AND 1000),
  -- Personality quizzes set this identity type in universe_profiles.identity (e.g. "house").
  sets_identity boolean NOT NULL DEFAULT false,
  status      text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order  integer NOT NULL DEFAULT 100,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (universe_id, slug)
);
CREATE INDEX quizzes_universe_idx ON public.quizzes (universe_id, status, sort_order);
CREATE TRIGGER quizzes_set_updated_at BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id     uuid NOT NULL REFERENCES public.quizzes (id) ON DELETE CASCADE,
  position    integer NOT NULL CHECK (position >= 1),
  prompt      jsonb NOT NULL CHECK (jsonb_typeof(prompt) = 'object'),
  -- [{ "key": "a", "text": {"pt-BR": "...", "en": "..."}, "identity": "gryffindor"? }]
  options     jsonb NOT NULL CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) BETWEEN 2 AND 6),
  -- Trivia only. NULL for personality questions.
  correct_key text CHECK (char_length(correct_key) <= 10),
  explanation jsonb CHECK (explanation IS NULL OR jsonb_typeof(explanation) = 'object'),
  UNIQUE (quiz_id, position)
);

CREATE TABLE public.quiz_attempts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  quiz_id      uuid NOT NULL REFERENCES public.quizzes (id) ON DELETE CASCADE,
  answers      jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
  score        integer NOT NULL CHECK (score >= 0),
  total        integer NOT NULL CHECK (total >= 1),
  xp_awarded   integer NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0),
  result_identity text CHECK (char_length(result_identity) <= 50),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quiz_attempts_user_quiz_idx ON public.quiz_attempts (user_id, quiz_id, created_at DESC);
