-- 0012 — Event rooms: external link, linked live quiz, reminders and real-time chat.

ALTER TABLE public.events
  ADD COLUMN external_url text CHECK (external_url IS NULL OR (external_url ~ '^https://' AND char_length(external_url) <= 500)),
  ADD COLUMN quiz_id uuid REFERENCES public.quizzes (id) ON DELETE SET NULL,
  ADD COLUMN created_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER events_set_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Reminder bookkeeping: each reminder is sent once per participant.
ALTER TABLE public.event_participants
  ADD COLUMN reminded_24h_at timestamptz,
  ADD COLUMN reminded_1h_at timestamptz;
CREATE INDEX event_participants_reminders_idx ON public.event_participants (event_id) WHERE reminded_1h_at IS NULL;

-- Event room chat (plain text). Staff can hide messages; authors can delete their own.
CREATE TABLE public.event_messages (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id   uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  status     text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_messages_room_idx ON public.event_messages (event_id, id DESC);
CREATE INDEX event_messages_user_idx ON public.event_messages (user_id, created_at DESC);

-- Quiz nights run the universe's trivia quiz live.
UPDATE public.events e SET quiz_id = q.id
  FROM public.quizzes q
 WHERE e.slug = 'noite-de-quiz' AND q.universe_id = e.universe_id AND q.kind = 'trivia' AND e.quiz_id IS NULL;
