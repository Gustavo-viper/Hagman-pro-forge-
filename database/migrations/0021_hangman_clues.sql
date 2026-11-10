-- Hangman: extra clues per word (scenes, what the character did, trivia), revealed one at a
-- time by the player. Array of localized objects: [{"pt-BR": "...", "en": "..."}, ...].
ALTER TABLE public.game_words
  ADD COLUMN clues jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(clues) = 'array' AND jsonb_array_length(clues) <= 8);
