-- Reference data: the two launch universes. Idempotent (ON CONFLICT DO NOTHING) so it
-- never overwrites changes made later through the admin panel.
-- Fandom Universe is an independent, unofficial fan community. No official artwork,
-- logos or copyrighted text are stored here — only names used descriptively.

INSERT INTO public.universes (slug, name, tagline, description, status, sort_order)
VALUES
  ('harry-potter',
   '{"pt-BR":"Harry Potter","en":"Harry Potter"}',
   '{"pt-BR":"O mundo bruxo reunido em uma só comunidade.","en":"The wizarding world, gathered in one community."}',
   '{"pt-BR":"Descubra sua casa, dispute a taça entre casas, participe de quizzes, teorias e eventos com fãs do mundo inteiro. Comunidade de fãs independente e não oficial.","en":"Find your house, compete for the house cup, join quizzes, theories and events with fans worldwide. Independent, unofficial fan community."}',
   'active', 10),
  ('supernatural',
   '{"pt-BR":"Supernatural","en":"Supernatural"}',
   '{"pt-BR":"Caçadores, lendas e investigações sem fim.","en":"Hunters, lore and never-ending investigations."}',
   '{"pt-BR":"Crie sua identidade de caçador, investigue casos, complete missões e suba no ranking de caçadores. Comunidade de fãs independente e não oficial.","en":"Build your hunter identity, investigate cases, complete missions and climb the hunter ranking. Independent, unofficial fan community."}',
   'active', 20)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.universe_settings (universe_id, theme, features, identity_config)
SELECT u.id, s.theme::jsonb, s.features::jsonb, s.identity_config::jsonb
FROM public.universes u
JOIN (VALUES
  ('harry-potter',
   '{"primary":"#7c1d2b","secondary":"#1d2a5c","accent":"#d4a843","background":"#0b0a12","glow":"#e9c46a"}',
   '["house_sorting","common_rooms","quizzes","rankings","library","creatures","spells","discussions","theories","events","house_cup"]',
   '{"type":"house","label":{"pt-BR":"Casa","en":"House"},"options":[
      {"key":"gryffindor","name":{"pt-BR":"Grifinória","en":"Gryffindor"},"color":"#a4262c","traits":{"pt-BR":["coragem","ousadia"],"en":["courage","daring"]}},
      {"key":"slytherin","name":{"pt-BR":"Sonserina","en":"Slytherin"},"color":"#1f6f4a","traits":{"pt-BR":["ambição","astúcia"],"en":["ambition","cunning"]}},
      {"key":"ravenclaw","name":{"pt-BR":"Corvinal","en":"Ravenclaw"},"color":"#2a4d9b","traits":{"pt-BR":["sabedoria","criatividade"],"en":["wisdom","creativity"]}},
      {"key":"hufflepuff","name":{"pt-BR":"Lufa-Lufa","en":"Hufflepuff"},"color":"#d9a520","traits":{"pt-BR":["lealdade","dedicação"],"en":["loyalty","dedication"]}}
   ]}'),
  ('supernatural',
   '{"primary":"#8a3b12","secondary":"#2b2f36","accent":"#e0a458","background":"#0c0b0a","glow":"#f4a261"}',
   '["hunter_identity","bestiary","creature_archive","investigations","missions","quizzes","hunter_ranking","discussion_groups","theories","library","events","challenges"]',
   '{"type":"hunter_rank","label":{"pt-BR":"Patente de caçador","en":"Hunter rank"},"options":[
      {"key":"rookie","name":{"pt-BR":"Novato","en":"Rookie"},"minLevel":1},
      {"key":"tracker","name":{"pt-BR":"Rastreador","en":"Tracker"},"minLevel":5},
      {"key":"hunter","name":{"pt-BR":"Caçador","en":"Hunter"},"minLevel":10},
      {"key":"veteran","name":{"pt-BR":"Veterano","en":"Veteran"},"minLevel":20},
      {"key":"legend","name":{"pt-BR":"Lenda","en":"Legend"},"minLevel":40}
   ]}')
) AS s(slug, theme, features, identity_config) ON s.slug = u.slug
ON CONFLICT (universe_id) DO NOTHING;
