-- Official theme song of each universe, played from the rights holder's platform (YouTube
-- embed, click-to-play). Nothing is hosted here. NULL = not set yet (seed may fill it);
-- '{}' = removed by the staff (seed leaves it alone).
ALTER TABLE public.universe_settings
  ADD COLUMN official_theme jsonb CHECK (
    official_theme IS NULL OR official_theme = '{}'::jsonb OR (
      jsonb_typeof(official_theme) = 'object'
      AND official_theme->>'youtubeId' ~ '^[A-Za-z0-9_-]{11}$'
      AND char_length(official_theme->>'title') BETWEEN 1 AND 120
      AND char_length(COALESCE(official_theme->>'artist', '')) <= 120
    )
  );
