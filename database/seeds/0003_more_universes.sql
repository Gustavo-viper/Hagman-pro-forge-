-- Reference data: Marvel, DC and Star Wars universes. Idempotent (ON CONFLICT DO NOTHING),
-- so changes made later through the admin panel are never overwritten.
-- Independent, unofficial fan community: names are used descriptively only; no official
-- artwork, logos or copyrighted text are stored.

INSERT INTO public.universes (slug, name, tagline, description, status, sort_order)
VALUES
  ('marvel',
   '{"pt-BR":"Marvel","en":"Marvel"}',
   '{"pt-BR":"Heróis, equipes e sagas que atravessam gerações.","en":"Heroes, teams and sagas spanning generations."}',
   '{"pt-BR":"Escolha seu lado, debata linhas do tempo e teorias, monte o arquivo de personagens e dispute quizzes e desafios com fãs do mundo inteiro. Comunidade de fãs independente e não oficial.","en":"Pick your side, debate timelines and theories, build the character archive and compete in quizzes and challenges with fans worldwide. Independent, unofficial fan community."}',
   'active', 30),
  ('dc',
   '{"pt-BR":"DC","en":"DC"}',
   '{"pt-BR":"Lendas, vigilantes e um multiverso inteiro para explorar.","en":"Legends, vigilantes and a whole multiverse to explore."}',
   '{"pt-BR":"Defina sua identidade, explore o guia do multiverso, discuta teorias e participe de eventos e rankings ao lado de outros fãs. Comunidade de fãs independente e não oficial.","en":"Define your identity, explore the multiverse guide, discuss theories and join events and rankings with other fans. Independent, unofficial fan community."}',
   'active', 40),
  ('star-wars',
   '{"pt-BR":"Star Wars","en":"Star Wars"}',
   '{"pt-BR":"Uma galáxia muito, muito distante — e uma comunidade bem pertinho.","en":"A galaxy far, far away — and a community right here."}',
   '{"pt-BR":"Escolha sua facção, explore o atlas da galáxia, catalogue naves e espécies, cumpra missões e suba nos rankings. Comunidade de fãs independente e não oficial.","en":"Choose your faction, explore the galaxy atlas, catalog starships and species, complete missions and climb the rankings. Independent, unofficial fan community."}',
   'active', 50)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.universe_settings (universe_id, theme, features, identity_config)
SELECT u.id, s.theme::jsonb, s.features::jsonb, s.identity_config::jsonb
FROM public.universes u
JOIN (VALUES
  ('marvel',
   '{"primary":"#b3141f","secondary":"#1b2a4a","accent":"#f2b134","background":"#0b0709","glow":"#ff5a66"}',
   '["faction_identity","character_archive","timelines","quizzes","rankings","theories","discussions","events","challenges"]',
   '{"type":"alignment","label":{"pt-BR":"Lado","en":"Side"},"options":[
      {"key":"hero","name":{"pt-BR":"Herói","en":"Hero"},"color":"#d92b3a","traits":{"pt-BR":["coragem","responsabilidade"],"en":["courage","responsibility"]}},
      {"key":"antihero","name":{"pt-BR":"Anti-herói","en":"Antihero"},"color":"#8e44ad","traits":{"pt-BR":["independência","métodos próprios"],"en":["independence","own methods"]}},
      {"key":"mutant","name":{"pt-BR":"Mutante","en":"Mutant"},"color":"#f2b134","traits":{"pt-BR":["dons únicos","resiliência"],"en":["unique gifts","resilience"]}},
      {"key":"agent","name":{"pt-BR":"Agente","en":"Agent"},"color":"#2e86de","traits":{"pt-BR":["estratégia","discrição"],"en":["strategy","discretion"]}},
      {"key":"villain","name":{"pt-BR":"Vilão","en":"Villain"},"color":"#4a4a4a","traits":{"pt-BR":["ambição","poder"],"en":["ambition","power"]}}
   ]}'),
  ('dc',
   '{"primary":"#0b4fb3","secondary":"#1c1c24","accent":"#c9d2e0","background":"#06080f","glow":"#4da3ff"}',
   '["faction_identity","character_archive","multiverse_guide","quizzes","rankings","theories","discussions","events","challenges"]',
   '{"type":"alignment","label":{"pt-BR":"Identidade","en":"Identity"},"options":[
      {"key":"hero","name":{"pt-BR":"Herói","en":"Hero"},"color":"#1f6fe5","traits":{"pt-BR":["esperança","justiça"],"en":["hope","justice"]}},
      {"key":"vigilante","name":{"pt-BR":"Vigilante","en":"Vigilante"},"color":"#3d3d4f","traits":{"pt-BR":["determinação","sombras"],"en":["determination","shadows"]}},
      {"key":"mystic","name":{"pt-BR":"Místico","en":"Mystic"},"color":"#7d3cff","traits":{"pt-BR":["magia","conhecimento oculto"],"en":["magic","hidden knowledge"]}},
      {"key":"antihero","name":{"pt-BR":"Anti-herói","en":"Antihero"},"color":"#2a9d8f","traits":{"pt-BR":["pragmatismo","segundas chances"],"en":["pragmatism","second chances"]}},
      {"key":"villain","name":{"pt-BR":"Vilão","en":"Villain"},"color":"#6b1f2a","traits":{"pt-BR":["caos","ambição"],"en":["chaos","ambition"]}}
   ]}'),
  ('star-wars',
   '{"primary":"#2b2f3a","secondary":"#0f3b5c","accent":"#ffe81f","background":"#030305","glow":"#7fd3ff"}',
   '["faction_identity","galaxy_atlas","starship_archive","species_archive","missions","quizzes","rankings","theories","discussions","events"]',
   '{"type":"faction","label":{"pt-BR":"Facção","en":"Faction"},"options":[
      {"key":"jedi","name":{"pt-BR":"Jedi","en":"Jedi"},"color":"#4fa3ff","traits":{"pt-BR":["serenidade","equilíbrio"],"en":["serenity","balance"]}},
      {"key":"sith","name":{"pt-BR":"Sith","en":"Sith"},"color":"#e0282e","traits":{"pt-BR":["paixão","poder"],"en":["passion","power"]}},
      {"key":"rebel","name":{"pt-BR":"Rebelde","en":"Rebel"},"color":"#f28c28","traits":{"pt-BR":["esperança","ousadia"],"en":["hope","daring"]}},
      {"key":"imperial","name":{"pt-BR":"Imperial","en":"Imperial"},"color":"#8a8f98","traits":{"pt-BR":["disciplina","ordem"],"en":["discipline","order"]}},
      {"key":"bounty_hunter","name":{"pt-BR":"Caçador de recompensas","en":"Bounty hunter"},"color":"#7a6a4f","traits":{"pt-BR":["astúcia","independência"],"en":["cunning","independence"]}},
      {"key":"smuggler","name":{"pt-BR":"Contrabandista","en":"Smuggler"},"color":"#c2a35a","traits":{"pt-BR":["sorte","improviso"],"en":["luck","improvisation"]}}
   ]}')
) AS s(slug, theme, features, identity_config) ON s.slug = u.slug
ON CONFLICT (universe_id) DO NOTHING;
