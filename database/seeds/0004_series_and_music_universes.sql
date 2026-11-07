-- Reference data: Grey's Anatomy, Station 19 and BTS universes. Idempotent (ON CONFLICT DO
-- NOTHING), so later admin-panel changes are never overwritten.
-- Independent, unofficial fan community: names used descriptively only, original texts.
-- BTS members are real people: the identity system describes how a fan takes part in the
-- fandom (never ranks or "picks" real persons) and the description sets a respect rule.

INSERT INTO public.universes (slug, name, tagline, description, status, sort_order)
VALUES
  ('greys-anatomy',
   '{"pt-BR":"Grey''s Anatomy","en":"Grey''s Anatomy"}',
   '{"pt-BR":"Plantões, cirurgias e dramas que marcaram uma geração.","en":"Shifts, surgeries and drama that defined a generation."}',
   '{"pt-BR":"Escolha sua especialidade, reveja episódios marcantes, discuta casos médicos da ficção e teorias e participe de quizzes e eventos com outros fãs. Comunidade de fãs independente e não oficial.","en":"Pick your specialty, revisit landmark episodes, discuss fictional medical cases and theories, and join quizzes and events with other fans. Independent, unofficial fan community."}',
   'active', 60),
  ('station-19',
   '{"pt-BR":"Station 19","en":"Station 19"}',
   '{"pt-BR":"Bombeiros, resgates e coragem em cada chamado.","en":"Firefighters, rescues and courage on every call."}',
   '{"pt-BR":"Assuma sua função no quartel, acompanhe o guia de episódios, encare missões de resgate e suba no ranking com fãs da série. Comunidade de fãs independente e não oficial.","en":"Take your role at the station, follow the episode guide, take on rescue missions and climb the ranking with fans of the show. Independent, unofficial fan community."}',
   'active', 70),
  ('bts',
   '{"pt-BR":"BTS","en":"BTS"}',
   '{"pt-BR":"Música, coreografias e um fandom que atravessa fronteiras.","en":"Music, choreography and a fandom without borders."}',
   '{"pt-BR":"Mostre como você vive o fandom, explore a discografia, participe de projetos de fãs, traduções, fan arts e eventos. Respeito aos artistas é regra: nada de rumores ou exposição da vida pessoal. Comunidade de fãs independente e não oficial.","en":"Show how you live the fandom, explore the discography, join fan projects, translations, fan art and events. Respect for the artists is the rule: no rumors or exposure of personal lives. Independent, unofficial fan community."}',
   'active', 80)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.universe_settings (universe_id, theme, features, identity_config)
SELECT u.id, s.theme::jsonb, s.features::jsonb, s.identity_config::jsonb
FROM public.universes u
JOIN (VALUES
  ('greys-anatomy',
   '{"primary":"#0e7c86","secondary":"#1d3557","accent":"#9be7dc","background":"#05090c","glow":"#5ee6d0"}',
   '["specialty_identity","character_archive","episode_guide","medical_cases","quizzes","rankings","theories","discussions","events"]',
   '{"type":"specialty","label":{"pt-BR":"Especialidade","en":"Specialty"},"options":[
      {"key":"general_surgery","name":{"pt-BR":"Cirurgia geral","en":"General surgery"},"color":"#0e9aa7","traits":{"pt-BR":["versatilidade","resistência"],"en":["versatility","stamina"]}},
      {"key":"cardio","name":{"pt-BR":"Cardiotorácica","en":"Cardiothoracic"},"color":"#d62839","traits":{"pt-BR":["precisão","coragem"],"en":["precision","courage"]}},
      {"key":"neuro","name":{"pt-BR":"Neurocirurgia","en":"Neurosurgery"},"color":"#6a4c93","traits":{"pt-BR":["foco","paciência"],"en":["focus","patience"]}},
      {"key":"ortho","name":{"pt-BR":"Ortopedia","en":"Orthopedics"},"color":"#e9a03b","traits":{"pt-BR":["força","praticidade"],"en":["strength","practicality"]}},
      {"key":"peds","name":{"pt-BR":"Pediatria","en":"Pediatrics"},"color":"#57cc99","traits":{"pt-BR":["empatia","cuidado"],"en":["empathy","care"]}},
      {"key":"plastics","name":{"pt-BR":"Cirurgia plástica","en":"Plastic surgery"},"color":"#ff8fab","traits":{"pt-BR":["detalhe","criatividade"],"en":["detail","creativity"]}},
      {"key":"trauma","name":{"pt-BR":"Trauma","en":"Trauma"},"color":"#f25c54","traits":{"pt-BR":["agilidade","sangue-frio"],"en":["speed","composure"]}}
   ]}'),
  ('station-19',
   '{"primary":"#b81d24","secondary":"#3a2618","accent":"#f77f00","background":"#0b0605","glow":"#ffb703"}',
   '["station_role","character_archive","episode_guide","rescue_missions","quizzes","rankings","theories","discussions","events"]',
   '{"type":"station_role","label":{"pt-BR":"Função no quartel","en":"Station role"},"options":[
      {"key":"firefighter","name":{"pt-BR":"Bombeiro(a)","en":"Firefighter"},"color":"#d62828","traits":{"pt-BR":["coragem","trabalho em equipe"],"en":["courage","teamwork"]}},
      {"key":"lieutenant","name":{"pt-BR":"Tenente","en":"Lieutenant"},"color":"#f77f00","traits":{"pt-BR":["liderança","decisão"],"en":["leadership","decisiveness"]}},
      {"key":"captain","name":{"pt-BR":"Capitão(ã)","en":"Captain"},"color":"#fcbf49","traits":{"pt-BR":["responsabilidade","visão"],"en":["responsibility","vision"]}},
      {"key":"paramedic","name":{"pt-BR":"Paramédico(a)","en":"Paramedic"},"color":"#2a9d8f","traits":{"pt-BR":["cuidado","rapidez"],"en":["care","speed"]}},
      {"key":"rescue","name":{"pt-BR":"Equipe de resgate","en":"Rescue team"},"color":"#e76f51","traits":{"pt-BR":["técnica","ousadia"],"en":["technique","daring"]}},
      {"key":"investigator","name":{"pt-BR":"Investigador(a) de incêndio","en":"Fire investigator"},"color":"#6c757d","traits":{"pt-BR":["observação","método"],"en":["observation","method"]}}
   ]}'),
  ('bts',
   '{"primary":"#7b2cbf","secondary":"#240046","accent":"#e0aaff","background":"#07030d","glow":"#c77dff"}',
   '["fandom_role","discography","fan_projects","translations","fan_art","quizzes","rankings","discussions","events"]',
   '{"type":"fandom_role","label":{"pt-BR":"Seu jeito de ser ARMY","en":"Your ARMY style"},"options":[
      {"key":"dancer","name":{"pt-BR":"Dançarino(a) de covers","en":"Cover dancer"},"color":"#9d4edd","traits":{"pt-BR":["ritmo","dedicação"],"en":["rhythm","dedication"]}},
      {"key":"translator","name":{"pt-BR":"Tradutor(a)","en":"Translator"},"color":"#5a189a","traits":{"pt-BR":["idiomas","precisão"],"en":["languages","precision"]}},
      {"key":"artist","name":{"pt-BR":"Artista de fan art","en":"Fan artist"},"color":"#e0aaff","traits":{"pt-BR":["criatividade","sensibilidade"],"en":["creativity","sensitivity"]}},
      {"key":"collector","name":{"pt-BR":"Colecionador(a)","en":"Collector"},"color":"#c77dff","traits":{"pt-BR":["paciência","organização"],"en":["patience","organization"]}},
      {"key":"streamer","name":{"pt-BR":"Streamer de lançamentos","en":"Release streamer"},"color":"#7b2cbf","traits":{"pt-BR":["constância","energia"],"en":["consistency","energy"]}},
      {"key":"lyricist","name":{"pt-BR":"Analista de letras","en":"Lyrics analyst"},"color":"#b5179e","traits":{"pt-BR":["interpretação","escuta atenta"],"en":["interpretation","close listening"]}}
   ]}')
) AS s(slug, theme, features, identity_config) ON s.slug = u.slug
ON CONFLICT (universe_id) DO NOTHING;
