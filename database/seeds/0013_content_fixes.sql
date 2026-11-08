-- Content fixes for databases seeded before the correction (idempotent, guarded by the old text).
-- Star Wars: the "Rebelião" quiz repeated a question from "Academia Jedi" (duplicate in the game pools).
UPDATE public.questions x
   SET prompt = '{"pt-BR": "Quem treina Rey em \"Os Últimos Jedi\"?", "en": "Who trains Rey in \"The Last Jedi\"?"}',
       options = '[{"key": "a", "text": {"pt-BR": "Leia Organa", "en": "Leia Organa"}}, {"key": "b", "text": {"pt-BR": "Maz Kanata", "en": "Maz Kanata"}}, {"key": "c", "text": {"pt-BR": "Luke Skywalker", "en": "Luke Skywalker"}}, {"key": "d", "text": {"pt-BR": "Han Solo", "en": "Han Solo"}}]',
       correct_key = 'c', explanation = NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE x.quiz_id = q.id AND u.slug = 'star-wars' AND q.slug = 'rebeliao' AND x.prompt->>'pt-BR' = 'Quem é o pai de Luke Skywalker?';
