-- Link each universe's quiz night to its trivia quiz (only where not set yet).
UPDATE public.events e SET quiz_id = q.id
  FROM public.quizzes q
 WHERE e.slug = 'noite-de-quiz' AND q.universe_id = e.universe_id AND q.kind = 'trivia' AND e.quiz_id IS NULL;
