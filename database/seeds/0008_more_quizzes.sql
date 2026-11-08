-- Reference data: normal and hard quizzes for every universe (generated, original questions).
-- Idempotent: existing quizzes/questions are never overwritten (admin edits are kept).

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'corredores-de-hogwarts', 'trivia', '{"pt-BR": "Corredores de Hogwarts", "en": "Hogwarts corridors"}', '{"pt-BR": "Oito perguntas para quem já passou do básico.", "en": "Eight questions for those past the basics."}', 'normal', 80, false, 30
  FROM public.universes WHERE slug = 'harry-potter'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Qual elfo doméstico Harry ajuda a libertar?", "en": "Which house-elf does Harry help set free?"}', '[{"key": "a", "text": {"pt-BR": "Dobby", "en": "Dobby"}}, {"key": "b", "text": {"pt-BR": "Monstro", "en": "Kreacher"}}, {"key": "c", "text": {"pt-BR": "Winky", "en": "Winky"}}, {"key": "d", "text": {"pt-BR": "Hokey", "en": "Hokey"}}]', 'a', '{"pt-BR": "Harry engana Lúcio Malfoy para que ele entregue uma meia a Dobby.", "en": "Harry tricks Lucius Malfoy into handing Dobby a sock."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'corredores-de-hogwarts'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Quem é o fantasma da Grifinória?", "en": "Who is the Gryffindor house ghost?"}', '[{"key": "a", "text": {"pt-BR": "Barão Sangrento", "en": "Bloody Baron"}}, {"key": "b", "text": {"pt-BR": "Nick Quase Sem Cabeça", "en": "Nearly Headless Nick"}}, {"key": "c", "text": {"pt-BR": "Frei Gorducho", "en": "Fat Friar"}}, {"key": "d", "text": {"pt-BR": "Dama Cinzenta", "en": "Grey Lady"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'corredores-de-hogwarts'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Quem guarda a entrada da sala comunal da Grifinória?", "en": "Who guards the entrance to the Gryffindor common room?"}', '[{"key": "a", "text": {"pt-BR": "Uma gárgula de pedra", "en": "A stone gargoyle"}}, {"key": "b", "text": {"pt-BR": "Um cavaleiro de armadura", "en": "A suit of armour"}}, {"key": "c", "text": {"pt-BR": "O retrato da Mulher Gorda", "en": "The portrait of the Fat Lady"}}, {"key": "d", "text": {"pt-BR": "Pirraça, o poltergeist", "en": "Peeves the poltergeist"}}]', 'c', '{"pt-BR": "É preciso dizer a senha à Mulher Gorda para entrar.", "en": "You must give the Fat Lady the password to get in."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'corredores-de-hogwarts'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Como se chama o cão de três cabeças que guardava a Pedra Filosofal?", "en": "What is the three-headed dog guarding the Philosopher''s Stone called?"}', '[{"key": "a", "text": {"pt-BR": "Canino", "en": "Fang"}}, {"key": "b", "text": {"pt-BR": "Norberto", "en": "Norbert"}}, {"key": "c", "text": {"pt-BR": "Bicuço", "en": "Buckbeak"}}, {"key": "d", "text": {"pt-BR": "Fofo", "en": "Fluffy"}}]', 'd', '{"pt-BR": "Fofo pertence a Hagrid e adormece ao ouvir música.", "en": "Fluffy belongs to Hagrid and falls asleep to music."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'corredores-de-hogwarts'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Qual matéria Severo Snape ensina durante a maior parte da saga?", "en": "Which subject does Severus Snape teach for most of the saga?"}', '[{"key": "a", "text": {"pt-BR": "Poções", "en": "Potions"}}, {"key": "b", "text": {"pt-BR": "Transfiguração", "en": "Transfiguration"}}, {"key": "c", "text": {"pt-BR": "Herbologia", "en": "Herbology"}}, {"key": "d", "text": {"pt-BR": "Feitiços", "en": "Charms"}}]', 'a', '{"pt-BR": "Só no sexto ano ele passa a ensinar Defesa Contra as Artes das Trevas.", "en": "Only in the sixth year does he move to Defence Against the Dark Arts."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'corredores-de-hogwarts'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "Qual destas é uma das Relíquias da Morte?", "en": "Which of these is one of the Deathly Hallows?"}', '[{"key": "a", "text": {"pt-BR": "O Vira-Tempo", "en": "The Time-Turner"}}, {"key": "b", "text": {"pt-BR": "A Varinha das Varinhas", "en": "The Elder Wand"}}, {"key": "c", "text": {"pt-BR": "O Mapa do Maroto", "en": "The Marauder''s Map"}}, {"key": "d", "text": {"pt-BR": "A Penseira", "en": "The Pensieve"}}]', 'b', '{"pt-BR": "As três relíquias são a Varinha das Varinhas, a Pedra da Ressurreição e a Capa da Invisibilidade.", "en": "The three Hallows are the Elder Wand, the Resurrection Stone and the Cloak of Invisibility."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'corredores-de-hogwarts'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 7, '{"pt-BR": "Quem é o Príncipe Mestiço?", "en": "Who is the Half-Blood Prince?"}', '[{"key": "a", "text": {"pt-BR": "Tom Riddle", "en": "Tom Riddle"}}, {"key": "b", "text": {"pt-BR": "Sirius Black", "en": "Sirius Black"}}, {"key": "c", "text": {"pt-BR": "Severo Snape", "en": "Severus Snape"}}, {"key": "d", "text": {"pt-BR": "Remo Lupin", "en": "Remus Lupin"}}]', 'c', '{"pt-BR": "Snape assinava assim o livro de Poções que Harry encontra.", "en": "Snape signed the Potions book Harry finds that way."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'corredores-de-hogwarts'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 8, '{"pt-BR": "Qual vila bruxa os alunos podem visitar a partir do terceiro ano?", "en": "Which wizarding village may students visit from third year on?"}', '[{"key": "a", "text": {"pt-BR": "Hogsmeade", "en": "Hogsmeade"}}, {"key": "b", "text": {"pt-BR": "Godric''s Hollow", "en": "Godric''s Hollow"}}, {"key": "c", "text": {"pt-BR": "Little Whinging", "en": "Little Whinging"}}, {"key": "d", "text": {"pt-BR": "Ottery St. Catchpole", "en": "Ottery St. Catchpole"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'corredores-de-hogwarts'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'mestre-em-artes-magicas', 'trivia', '{"pt-BR": "Mestre em artes mágicas", "en": "Master of the magical arts"}', '{"pt-BR": "Oito perguntas difíceis. Só para especialistas.", "en": "Eight hard questions. Experts only."}', 'hard', 120, false, 40
  FROM public.universes WHERE slug = 'harry-potter'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Qual é o núcleo da varinha de Harry?", "en": "What is the core of Harry''s wand?"}', '[{"key": "a", "text": {"pt-BR": "Pelo de unicórnio", "en": "Unicorn hair"}}, {"key": "b", "text": {"pt-BR": "Fibra de coração de dragão", "en": "Dragon heartstring"}}, {"key": "c", "text": {"pt-BR": "Pena de fênix", "en": "Phoenix feather"}}, {"key": "d", "text": {"pt-BR": "Pelo de testrálio", "en": "Thestral hair"}}]', 'c', '{"pt-BR": "A pena é de Fawkes, que forneceu outra para a varinha de Voldemort.", "en": "The feather is Fawkes''s, who gave another for Voldemort''s wand."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'mestre-em-artes-magicas'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Qual é o nome verdadeiro de Lorde Voldemort?", "en": "What is Lord Voldemort''s real name?"}', '[{"key": "a", "text": {"pt-BR": "Tom Servolo Riddle", "en": "Tom Marvolo Riddle"}}, {"key": "b", "text": {"pt-BR": "Morfino Gaunt", "en": "Morfin Gaunt"}}, {"key": "c", "text": {"pt-BR": "Bartô Crouch", "en": "Barty Crouch"}}, {"key": "d", "text": {"pt-BR": "Gerardo Grindelwald", "en": "Gellert Grindelwald"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'mestre-em-artes-magicas'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Qual destes NÃO é uma Horcrux?", "en": "Which of these is NOT a Horcrux?"}', '[{"key": "a", "text": {"pt-BR": "O diário de Tom Riddle", "en": "Tom Riddle''s diary"}}, {"key": "b", "text": {"pt-BR": "O medalhão de Slytherin", "en": "Slytherin''s locket"}}, {"key": "c", "text": {"pt-BR": "A taça de Hufflepuff", "en": "Hufflepuff''s cup"}}, {"key": "d", "text": {"pt-BR": "A espada de Gryffindor", "en": "Gryffindor''s sword"}}]', 'd', '{"pt-BR": "A espada foi usada para destruir Horcruxes.", "en": "The sword was used to destroy Horcruxes."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'mestre-em-artes-magicas'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Quantos pontos vale capturar o pomo de ouro?", "en": "How many points is catching the Golden Snitch worth?"}', '[{"key": "a", "text": {"pt-BR": "50", "en": "50"}}, {"key": "b", "text": {"pt-BR": "100", "en": "100"}}, {"key": "c", "text": {"pt-BR": "150", "en": "150"}}, {"key": "d", "text": {"pt-BR": "200", "en": "200"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'mestre-em-artes-magicas'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Qual é a forma do patrono de Hermione?", "en": "What form does Hermione''s Patronus take?"}', '[{"key": "a", "text": {"pt-BR": "Gato", "en": "Cat"}}, {"key": "b", "text": {"pt-BR": "Lontra", "en": "Otter"}}, {"key": "c", "text": {"pt-BR": "Cisne", "en": "Swan"}}, {"key": "d", "text": {"pt-BR": "Coruja", "en": "Owl"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'mestre-em-artes-magicas'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "Qual feitiço, criado pelo Príncipe Mestiço, causa cortes profundos?", "en": "Which spell, invented by the Half-Blood Prince, causes deep cuts?"}', '[{"key": "a", "text": {"pt-BR": "Reducto", "en": "Reducto"}}, {"key": "b", "text": {"pt-BR": "Confringo", "en": "Confringo"}}, {"key": "c", "text": {"pt-BR": "Diffindo", "en": "Diffindo"}}, {"key": "d", "text": {"pt-BR": "Sectumsempra", "en": "Sectumsempra"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'mestre-em-artes-magicas'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 7, '{"pt-BR": "Qual poção dá sorte a quem a bebe?", "en": "Which potion makes the drinker lucky?"}', '[{"key": "a", "text": {"pt-BR": "Felix Felicis", "en": "Felix Felicis"}}, {"key": "b", "text": {"pt-BR": "Amortentia", "en": "Amortentia"}}, {"key": "c", "text": {"pt-BR": "Veritaserum", "en": "Veritaserum"}}, {"key": "d", "text": {"pt-BR": "Poção Polissuco", "en": "Polyjuice Potion"}}]', 'a', '{"pt-BR": "Harry a ganha de Slughorn e a usa para obter uma memória importante.", "en": "Harry wins it from Slughorn and uses it to obtain a key memory."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'mestre-em-artes-magicas'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 8, '{"pt-BR": "Quem destrói o medalhão de Slytherin?", "en": "Who destroys Slytherin''s locket?"}', '[{"key": "a", "text": {"pt-BR": "Harry", "en": "Harry"}}, {"key": "b", "text": {"pt-BR": "Hermione", "en": "Hermione"}}, {"key": "c", "text": {"pt-BR": "Rony Weasley", "en": "Ron Weasley"}}, {"key": "d", "text": {"pt-BR": "Neville", "en": "Neville"}}]', 'c', '{"pt-BR": "Rony usa a espada de Gryffindor em \"Relíquias da Morte\".", "en": "Ron uses Gryffindor''s sword in \"Deathly Hallows\"."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'mestre-em-artes-magicas'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'na-estrada', 'trivia', '{"pt-BR": "Na estrada", "en": "On the road"}', '{"pt-BR": "Oito perguntas para quem já passou do básico.", "en": "Eight questions for those past the basics."}', 'normal', 80, false, 30
  FROM public.universes WHERE slug = 'supernatural'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Qual caçador é uma figura paterna para Sam e Dean?", "en": "Which hunter is a father figure to Sam and Dean?"}', '[{"key": "a", "text": {"pt-BR": "Rufus Turner", "en": "Rufus Turner"}}, {"key": "b", "text": {"pt-BR": "Bobby Singer", "en": "Bobby Singer"}}, {"key": "c", "text": {"pt-BR": "Ash", "en": "Ash"}}, {"key": "d", "text": {"pt-BR": "Garth", "en": "Garth"}}]', 'b', '{"pt-BR": "\"Família não termina no sangue\" — Bobby.", "en": "\"Family don''t end with blood\" — Bobby."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'na-estrada'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Que tipo de bala é usada contra lobisomens?", "en": "What kind of bullet is used against werewolves?"}', '[{"key": "a", "text": {"pt-BR": "Chumbo", "en": "Lead"}}, {"key": "b", "text": {"pt-BR": "Ferro", "en": "Iron"}}, {"key": "c", "text": {"pt-BR": "Prata", "en": "Silver"}}, {"key": "d", "text": {"pt-BR": "Ouro", "en": "Gold"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'na-estrada'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Que arma lendária, criada por Samuel Colt, pode matar quase qualquer coisa?", "en": "Which legendary gun, made by Samuel Colt, can kill almost anything?"}', '[{"key": "a", "text": {"pt-BR": "O Colt", "en": "The Colt"}}, {"key": "b", "text": {"pt-BR": "A Lança do Destino", "en": "The Spear of Destiny"}}, {"key": "c", "text": {"pt-BR": "A Primeira Lâmina", "en": "The First Blade"}}, {"key": "d", "text": {"pt-BR": "A Espada de Miguel", "en": "Michael''s Sword"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'na-estrada'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Qual símbolo impede um demônio de sair de onde está?", "en": "Which symbol stops a demon from leaving where it stands?"}', '[{"key": "a", "text": {"pt-BR": "Pentagrama invertido", "en": "Inverted pentagram"}}, {"key": "b", "text": {"pt-BR": "Armadilha do diabo", "en": "Devil''s Trap"}}, {"key": "c", "text": {"pt-BR": "Olho de Hórus", "en": "Eye of Horus"}}, {"key": "d", "text": {"pt-BR": "Runa nórdica", "en": "Norse rune"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'na-estrada'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Qual organização deixou aos irmãos um bunker cheio de arquivos?", "en": "Which organization left the brothers a bunker full of archives?"}', '[{"key": "a", "text": {"pt-BR": "Sociedade Thule", "en": "Thule Society"}}, {"key": "b", "text": {"pt-BR": "Ordem dos Caçadores", "en": "Order of Hunters"}}, {"key": "c", "text": {"pt-BR": "Homens de Letras", "en": "Men of Letters"}}, {"key": "d", "text": {"pt-BR": "Guarda Celestial", "en": "Heavenly Guard"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'na-estrada'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "Quem é o filho de Lúcifer que se torna parte da família?", "en": "Who is Lucifer''s son that becomes part of the family?"}', '[{"key": "a", "text": {"pt-BR": "Adam Milligan", "en": "Adam Milligan"}}, {"key": "b", "text": {"pt-BR": "Ben Braeden", "en": "Ben Braeden"}}, {"key": "c", "text": {"pt-BR": "Kevin Tran", "en": "Kevin Tran"}}, {"key": "d", "text": {"pt-BR": "Jack Kline", "en": "Jack Kline"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'na-estrada'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 7, '{"pt-BR": "Qual profeta traduz as tábuas da Palavra de Deus?", "en": "Which prophet translates the tablets of the Word of God?"}', '[{"key": "a", "text": {"pt-BR": "Kevin Tran", "en": "Kevin Tran"}}, {"key": "b", "text": {"pt-BR": "Chuck Shurley", "en": "Chuck Shurley"}}, {"key": "c", "text": {"pt-BR": "Garth Fitzgerald", "en": "Garth Fitzgerald"}}, {"key": "d", "text": {"pt-BR": "Ash", "en": "Ash"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'na-estrada'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 8, '{"pt-BR": "Como é conhecida a faca que mata demônios, trazida por uma demônia aliada?", "en": "What is the demon-killing knife brought by a demon ally known as?"}', '[{"key": "a", "text": {"pt-BR": "Lâmina de anjo", "en": "Angel blade"}}, {"key": "b", "text": {"pt-BR": "Faca de Ruby", "en": "Ruby''s knife"}}, {"key": "c", "text": {"pt-BR": "Adaga de Lilith", "en": "Lilith''s dagger"}}, {"key": "d", "text": {"pt-BR": "Lâmina de Caim", "en": "Cain''s blade"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'na-estrada'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'arquivos-dos-homens-de-letras', 'trivia', '{"pt-BR": "Arquivos dos Homens de Letras", "en": "Men of Letters archives"}', '{"pt-BR": "Oito perguntas difíceis. Só para especialistas.", "en": "Eight hard questions. Experts only."}', 'hard', 120, false, 40
  FROM public.universes WHERE slug = 'supernatural'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Em que ano Supernatural estreou?", "en": "In which year did Supernatural premiere?"}', '[{"key": "a", "text": {"pt-BR": "2003", "en": "2003"}}, {"key": "b", "text": {"pt-BR": "2005", "en": "2005"}}, {"key": "c", "text": {"pt-BR": "2007", "en": "2007"}}, {"key": "d", "text": {"pt-BR": "2009", "en": "2009"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'arquivos-dos-homens-de-letras'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Quantas temporadas a série teve?", "en": "How many seasons did the show have?"}', '[{"key": "a", "text": {"pt-BR": "10", "en": "10"}}, {"key": "b", "text": {"pt-BR": "12", "en": "12"}}, {"key": "c", "text": {"pt-BR": "15", "en": "15"}}, {"key": "d", "text": {"pt-BR": "17", "en": "17"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'arquivos-dos-homens-de-letras'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Qual é o nome do demônio de olhos amarelos?", "en": "What is the name of the yellow-eyed demon?"}', '[{"key": "a", "text": {"pt-BR": "Alastair", "en": "Alastair"}}, {"key": "b", "text": {"pt-BR": "Abaddon", "en": "Abaddon"}}, {"key": "c", "text": {"pt-BR": "Asmodeus", "en": "Asmodeus"}}, {"key": "d", "text": {"pt-BR": "Azazel", "en": "Azazel"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'arquivos-dos-homens-de-letras'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "De qual Cavaleiro do Apocalipse Dean obtém o último anel?", "en": "From which Horseman of the Apocalypse does Dean get the last ring?"}', '[{"key": "a", "text": {"pt-BR": "Morte", "en": "Death"}}, {"key": "b", "text": {"pt-BR": "Guerra", "en": "War"}}, {"key": "c", "text": {"pt-BR": "Fome", "en": "Famine"}}, {"key": "d", "text": {"pt-BR": "Peste", "en": "Pestilence"}}]', 'a', '{"pt-BR": "Com os quatro anéis os irmãos abrem a Jaula de Lúcifer.", "en": "With all four rings the brothers open Lucifer''s Cage."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'arquivos-dos-homens-de-letras'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Quem é o escritor \"Carver Edlund\" na vida real da série?", "en": "Who is the writer \"Carver Edlund\" within the show?"}', '[{"key": "a", "text": {"pt-BR": "Metatron", "en": "Metatron"}}, {"key": "b", "text": {"pt-BR": "Chuck Shurley", "en": "Chuck Shurley"}}, {"key": "c", "text": {"pt-BR": "Kevin Tran", "en": "Kevin Tran"}}, {"key": "d", "text": {"pt-BR": "Gabriel", "en": "Gabriel"}}]', 'b', '{"pt-BR": "Chuck é revelado, mais tarde, como Deus.", "en": "Chuck is later revealed to be God."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'arquivos-dos-homens-de-letras'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "Que marca Dean recebe para empunhar a Primeira Lâmina?", "en": "Which mark does Dean take to wield the First Blade?"}', '[{"key": "a", "text": {"pt-BR": "Selo de Salomão", "en": "Seal of Solomon"}}, {"key": "b", "text": {"pt-BR": "Marca da Besta", "en": "Mark of the Beast"}}, {"key": "c", "text": {"pt-BR": "Marca de Caim", "en": "Mark of Cain"}}, {"key": "d", "text": {"pt-BR": "Selo de Lilith", "en": "Lilith''s Seal"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'arquivos-dos-homens-de-letras'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 7, '{"pt-BR": "Qual arcanjo se disfarçava de Trapaceiro?", "en": "Which archangel was disguised as the Trickster?"}', '[{"key": "a", "text": {"pt-BR": "Rafael", "en": "Raphael"}}, {"key": "b", "text": {"pt-BR": "Miguel", "en": "Michael"}}, {"key": "c", "text": {"pt-BR": "Lúcifer", "en": "Lucifer"}}, {"key": "d", "text": {"pt-BR": "Gabriel", "en": "Gabriel"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'arquivos-dos-homens-de-letras'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 8, '{"pt-BR": "Em qual cidade fica o ferro-velho de Bobby?", "en": "Which town is Bobby''s salvage yard in?"}', '[{"key": "a", "text": {"pt-BR": "Sioux Falls", "en": "Sioux Falls"}}, {"key": "b", "text": {"pt-BR": "Lawrence", "en": "Lawrence"}}, {"key": "c", "text": {"pt-BR": "Lebanon", "en": "Lebanon"}}, {"key": "d", "text": {"pt-BR": "Stull", "en": "Stull"}}]', 'a', '{"pt-BR": "Lawrence é a cidade natal dos Winchester; o bunker fica em Lebanon.", "en": "Lawrence is the Winchesters'' hometown; the bunker is in Lebanon."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'arquivos-dos-homens-de-letras'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'iniciativa-vingadores', 'trivia', '{"pt-BR": "Iniciativa Vingadores", "en": "Avengers Initiative"}', '{"pt-BR": "Oito perguntas para quem já passou do básico.", "en": "Eight questions for those past the basics."}', 'normal', 80, false, 30
  FROM public.universes WHERE slug = 'marvel'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Qual é o nome verdadeiro do Capitão América?", "en": "What is Captain America''s real name?"}', '[{"key": "a", "text": {"pt-BR": "Bucky Barnes", "en": "Bucky Barnes"}}, {"key": "b", "text": {"pt-BR": "Steve Rogers", "en": "Steve Rogers"}}, {"key": "c", "text": {"pt-BR": "Sam Wilson", "en": "Sam Wilson"}}, {"key": "d", "text": {"pt-BR": "Clint Barton", "en": "Clint Barton"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'iniciativa-vingadores'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Qual Joia do Infinito estava dentro do Tesseract?", "en": "Which Infinity Stone was inside the Tesseract?"}', '[{"key": "a", "text": {"pt-BR": "Joia do Espaço", "en": "Space Stone"}}, {"key": "b", "text": {"pt-BR": "Joia da Mente", "en": "Mind Stone"}}, {"key": "c", "text": {"pt-BR": "Joia do Tempo", "en": "Time Stone"}}, {"key": "d", "text": {"pt-BR": "Joia da Realidade", "en": "Reality Stone"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'iniciativa-vingadores'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Qual inteligência artificial ajuda Tony Stark nos primeiros filmes?", "en": "Which AI assists Tony Stark in the early films?"}', '[{"key": "a", "text": {"pt-BR": "F.R.I.D.A.Y.", "en": "F.R.I.D.A.Y."}}, {"key": "b", "text": {"pt-BR": "Karen", "en": "Karen"}}, {"key": "c", "text": {"pt-BR": "J.A.R.V.I.S.", "en": "J.A.R.V.I.S."}}, {"key": "d", "text": {"pt-BR": "Ultron", "en": "Ultron"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'iniciativa-vingadores'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Quem é o irmão adotivo de Thor?", "en": "Who is Thor''s adoptive brother?"}', '[{"key": "a", "text": {"pt-BR": "Heimdall", "en": "Heimdall"}}, {"key": "b", "text": {"pt-BR": "Balder", "en": "Balder"}}, {"key": "c", "text": {"pt-BR": "Odin", "en": "Odin"}}, {"key": "d", "text": {"pt-BR": "Loki", "en": "Loki"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'iniciativa-vingadores'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Em qual bairro de Nova York Peter Parker cresceu?", "en": "Which New York borough did Peter Parker grow up in?"}', '[{"key": "a", "text": {"pt-BR": "Brooklyn", "en": "Brooklyn"}}, {"key": "b", "text": {"pt-BR": "Queens", "en": "Queens"}}, {"key": "c", "text": {"pt-BR": "Harlem", "en": "Harlem"}}, {"key": "d", "text": {"pt-BR": "Bronx", "en": "Bronx"}}]', 'b', '{"pt-BR": "Steve Rogers é que vem do Brooklyn.", "en": "It''s Steve Rogers who comes from Brooklyn."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'iniciativa-vingadores'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "Qual Vingador luta com arco e flecha?", "en": "Which Avenger fights with a bow and arrows?"}', '[{"key": "a", "text": {"pt-BR": "Gavião Arqueiro", "en": "Hawkeye"}}, {"key": "b", "text": {"pt-BR": "Falcão", "en": "Falcon"}}, {"key": "c", "text": {"pt-BR": "Viúva Negra", "en": "Black Widow"}}, {"key": "d", "text": {"pt-BR": "Máquina de Combate", "en": "War Machine"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'iniciativa-vingadores'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 7, '{"pt-BR": "Quem estala os dedos com a Manopla do Infinito em \"Guerra Infinita\"?", "en": "Who snaps his fingers with the Infinity Gauntlet in \"Infinity War\"?"}', '[{"key": "a", "text": {"pt-BR": "Loki", "en": "Loki"}}, {"key": "b", "text": {"pt-BR": "Ultron", "en": "Ultron"}}, {"key": "c", "text": {"pt-BR": "Thanos", "en": "Thanos"}}, {"key": "d", "text": {"pt-BR": "Caveira Vermelha", "en": "Red Skull"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'iniciativa-vingadores'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 8, '{"pt-BR": "Qual agência de espionagem é dirigida por Nick Fury?", "en": "Which spy agency is run by Nick Fury?"}', '[{"key": "a", "text": {"pt-BR": "H.I.D.R.A.", "en": "HYDRA"}}, {"key": "b", "text": {"pt-BR": "A.I.M.", "en": "A.I.M."}}, {"key": "c", "text": {"pt-BR": "S.W.O.R.D.", "en": "S.W.O.R.D."}}, {"key": "d", "text": {"pt-BR": "S.H.I.E.L.D.", "en": "S.H.I.E.L.D."}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'iniciativa-vingadores'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'arquivos-da-torre-stark', 'trivia', '{"pt-BR": "Arquivos da Torre Stark", "en": "Stark Tower archives"}', '{"pt-BR": "Oito perguntas difíceis. Só para especialistas.", "en": "Eight hard questions. Experts only."}', 'hard', 120, false, 40
  FROM public.universes WHERE slug = 'marvel'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Qual foi o primeiro filme do Universo Cinematográfico Marvel?", "en": "What was the first Marvel Cinematic Universe film?"}', '[{"key": "a", "text": {"pt-BR": "O Incrível Hulk", "en": "The Incredible Hulk"}}, {"key": "b", "text": {"pt-BR": "Thor", "en": "Thor"}}, {"key": "c", "text": {"pt-BR": "Homem de Ferro", "en": "Iron Man"}}, {"key": "d", "text": {"pt-BR": "Capitão América: O Primeiro Vingador", "en": "Captain America: The First Avenger"}}]', 'c', '{"pt-BR": "Homem de Ferro estreou em 2008.", "en": "Iron Man was released in 2008."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'arquivos-da-torre-stark'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Em qual planeta fica a Joia da Alma?", "en": "On which planet is the Soul Stone?"}', '[{"key": "a", "text": {"pt-BR": "Vormir", "en": "Vormir"}}, {"key": "b", "text": {"pt-BR": "Xandar", "en": "Xandar"}}, {"key": "c", "text": {"pt-BR": "Morag", "en": "Morag"}}, {"key": "d", "text": {"pt-BR": "Sakaar", "en": "Sakaar"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'arquivos-da-torre-stark'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Qual arma é forjada em Nidavellir para Thor em \"Guerra Infinita\"?", "en": "Which weapon is forged in Nidavellir for Thor in \"Infinity War\"?"}', '[{"key": "a", "text": {"pt-BR": "Gungnir", "en": "Gungnir"}}, {"key": "b", "text": {"pt-BR": "Rompe-Tormentas", "en": "Stormbreaker"}}, {"key": "c", "text": {"pt-BR": "Jarnbjorn", "en": "Jarnbjorn"}}, {"key": "d", "text": {"pt-BR": "Mjölnir", "en": "Mjölnir"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'arquivos-da-torre-stark'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Qual é o nome do Pantera Negra em \"Pantera Negra\" (2018)?", "en": "What is Black Panther''s name in \"Black Panther\" (2018)?"}', '[{"key": "a", "text": {"pt-BR": "N''Jadaka", "en": "N''Jadaka"}}, {"key": "b", "text": {"pt-BR": "M''Baku", "en": "M''Baku"}}, {"key": "c", "text": {"pt-BR": "T''Chaka", "en": "T''Chaka"}}, {"key": "d", "text": {"pt-BR": "T''Challa", "en": "T''Challa"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'arquivos-da-torre-stark'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Qual cientista criou o soro que transformou Steve Rogers?", "en": "Which scientist created the serum that transformed Steve Rogers?"}', '[{"key": "a", "text": {"pt-BR": "Abraham Erskine", "en": "Abraham Erskine"}}, {"key": "b", "text": {"pt-BR": "Howard Stark", "en": "Howard Stark"}}, {"key": "c", "text": {"pt-BR": "Arnim Zola", "en": "Arnim Zola"}}, {"key": "d", "text": {"pt-BR": "Hank Pym", "en": "Hank Pym"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'arquivos-da-torre-stark'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "O que permite ao Homem-Formiga mudar de tamanho?", "en": "What lets Ant-Man change size?"}', '[{"key": "a", "text": {"pt-BR": "Raios gama", "en": "Gamma rays"}}, {"key": "b", "text": {"pt-BR": "Vibranium", "en": "Vibranium"}}, {"key": "c", "text": {"pt-BR": "Partículas Pym", "en": "Pym Particles"}}, {"key": "d", "text": {"pt-BR": "Éter", "en": "Aether"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'arquivos-da-torre-stark'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 7, '{"pt-BR": "Quantas Joias do Infinito existem?", "en": "How many Infinity Stones are there?"}', '[{"key": "a", "text": {"pt-BR": "4", "en": "4"}}, {"key": "b", "text": {"pt-BR": "5", "en": "5"}}, {"key": "c", "text": {"pt-BR": "6", "en": "6"}}, {"key": "d", "text": {"pt-BR": "7", "en": "7"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'arquivos-da-torre-stark'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 8, '{"pt-BR": "Quem é o pai biológico de Peter Quill em \"Guardiões da Galáxia Vol. 2\"?", "en": "Who is Peter Quill''s biological father in \"Guardians of the Galaxy Vol. 2\"?"}', '[{"key": "a", "text": {"pt-BR": "Yondu", "en": "Yondu"}}, {"key": "b", "text": {"pt-BR": "Ronan", "en": "Ronan"}}, {"key": "c", "text": {"pt-BR": "Thanos", "en": "Thanos"}}, {"key": "d", "text": {"pt-BR": "Ego", "en": "Ego"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'arquivos-da-torre-stark'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'liga-da-justica', 'trivia', '{"pt-BR": "Liga da Justiça", "en": "Justice League"}', '{"pt-BR": "Oito perguntas para quem já passou do básico.", "en": "Eight questions for those past the basics."}', 'normal', 80, false, 30
  FROM public.universes WHERE slug = 'dc'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Qual é a identidade secreta da Mulher-Maravilha?", "en": "What is Wonder Woman''s secret identity?"}', '[{"key": "a", "text": {"pt-BR": "Diana Prince", "en": "Diana Prince"}}, {"key": "b", "text": {"pt-BR": "Barbara Gordon", "en": "Barbara Gordon"}}, {"key": "c", "text": {"pt-BR": "Selina Kyle", "en": "Selina Kyle"}}, {"key": "d", "text": {"pt-BR": "Kara Danvers", "en": "Kara Danvers"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'liga-da-justica'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Qual é a ilha natal da Mulher-Maravilha?", "en": "What is Wonder Woman''s home island?"}', '[{"key": "a", "text": {"pt-BR": "Atlântida", "en": "Atlantis"}}, {"key": "b", "text": {"pt-BR": "Themyscira", "en": "Themyscira"}}, {"key": "c", "text": {"pt-BR": "Apokolips", "en": "Apokolips"}}, {"key": "d", "text": {"pt-BR": "Oa", "en": "Oa"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'liga-da-justica'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Quem é conhecido como o homem mais rápido do mundo?", "en": "Who is known as the fastest man alive?"}', '[{"key": "a", "text": {"pt-BR": "Superman", "en": "Superman"}}, {"key": "b", "text": {"pt-BR": "Lanterna Verde", "en": "Green Lantern"}}, {"key": "c", "text": {"pt-BR": "Flash", "en": "The Flash"}}, {"key": "d", "text": {"pt-BR": "Aquaman", "en": "Aquaman"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'liga-da-justica'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Qual é o nome kryptoniano do Superman?", "en": "What is Superman''s Kryptonian name?"}', '[{"key": "a", "text": {"pt-BR": "Jor-El", "en": "Jor-El"}}, {"key": "b", "text": {"pt-BR": "Zod", "en": "Zod"}}, {"key": "c", "text": {"pt-BR": "Kara Zor-El", "en": "Kara Zor-El"}}, {"key": "d", "text": {"pt-BR": "Kal-El", "en": "Kal-El"}}]', 'd', '{"pt-BR": "Jor-El é o pai dele.", "en": "Jor-El is his father."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'liga-da-justica'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Qual vilão é chamado de Palhaço do Crime?", "en": "Which villain is called the Clown Prince of Crime?"}', '[{"key": "a", "text": {"pt-BR": "Coringa", "en": "Joker"}}, {"key": "b", "text": {"pt-BR": "Charada", "en": "Riddler"}}, {"key": "c", "text": {"pt-BR": "Pinguim", "en": "Penguin"}}, {"key": "d", "text": {"pt-BR": "Duas-Caras", "en": "Two-Face"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'liga-da-justica'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "Qual reino submarino é governado por Aquaman?", "en": "Which undersea kingdom does Aquaman rule?"}', '[{"key": "a", "text": {"pt-BR": "Lemúria", "en": "Lemuria"}}, {"key": "b", "text": {"pt-BR": "Atlântida", "en": "Atlantis"}}, {"key": "c", "text": {"pt-BR": "Themyscira", "en": "Themyscira"}}, {"key": "d", "text": {"pt-BR": "Cidade dos Gorilas", "en": "Gorilla City"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'liga-da-justica'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 7, '{"pt-BR": "Como se chama o mordomo de Bruce Wayne?", "en": "What is the name of Bruce Wayne''s butler?"}', '[{"key": "a", "text": {"pt-BR": "Lucius Fox", "en": "Lucius Fox"}}, {"key": "b", "text": {"pt-BR": "James Gordon", "en": "James Gordon"}}, {"key": "c", "text": {"pt-BR": "Alfred Pennyworth", "en": "Alfred Pennyworth"}}, {"key": "d", "text": {"pt-BR": "Edwin Jarvis", "en": "Edwin Jarvis"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'liga-da-justica'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 8, '{"pt-BR": "Qual é a fonte de poder do Lanterna Verde?", "en": "What is the source of Green Lantern''s power?"}', '[{"key": "a", "text": {"pt-BR": "Um amuleto antigo", "en": "An ancient amulet"}}, {"key": "b", "text": {"pt-BR": "Raios solares", "en": "Solar rays"}}, {"key": "c", "text": {"pt-BR": "Um soro químico", "en": "A chemical serum"}}, {"key": "d", "text": {"pt-BR": "Um anel de poder", "en": "A power ring"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'liga-da-justica'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'arquivos-da-torre-de-vigilancia', 'trivia', '{"pt-BR": "Arquivos da Torre de Vigilância", "en": "Watchtower archives"}', '{"pt-BR": "Oito perguntas difíceis. Só para especialistas.", "en": "Eight hard questions. Experts only."}', 'hard', 120, false, 40
  FROM public.universes WHERE slug = 'dc'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Em qual jornal Clark Kent trabalha?", "en": "Which newspaper does Clark Kent work for?"}', '[{"key": "a", "text": {"pt-BR": "Planeta Diário", "en": "Daily Planet"}}, {"key": "b", "text": {"pt-BR": "Clarim Diário", "en": "Daily Bugle"}}, {"key": "c", "text": {"pt-BR": "Gotham Gazette", "en": "Gotham Gazette"}}, {"key": "d", "text": {"pt-BR": "Central City Citizen", "en": "Central City Citizen"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'arquivos-da-torre-de-vigilancia'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Qual Lanterna Verde da Terra é piloto de testes?", "en": "Which Earth Green Lantern is a test pilot?"}', '[{"key": "a", "text": {"pt-BR": "John Stewart", "en": "John Stewart"}}, {"key": "b", "text": {"pt-BR": "Hal Jordan", "en": "Hal Jordan"}}, {"key": "c", "text": {"pt-BR": "Guy Gardner", "en": "Guy Gardner"}}, {"key": "d", "text": {"pt-BR": "Kyle Rayner", "en": "Kyle Rayner"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'arquivos-da-torre-de-vigilancia'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Quem foi o primeiro Robin?", "en": "Who was the first Robin?"}', '[{"key": "a", "text": {"pt-BR": "Jason Todd", "en": "Jason Todd"}}, {"key": "b", "text": {"pt-BR": "Tim Drake", "en": "Tim Drake"}}, {"key": "c", "text": {"pt-BR": "Dick Grayson", "en": "Dick Grayson"}}, {"key": "d", "text": {"pt-BR": "Damian Wayne", "en": "Damian Wayne"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'arquivos-da-torre-de-vigilancia'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Qual vilão governa Apokolips?", "en": "Which villain rules Apokolips?"}', '[{"key": "a", "text": {"pt-BR": "Brainiac", "en": "Brainiac"}}, {"key": "b", "text": {"pt-BR": "Lex Luthor", "en": "Lex Luthor"}}, {"key": "c", "text": {"pt-BR": "Sinestro", "en": "Sinestro"}}, {"key": "d", "text": {"pt-BR": "Darkseid", "en": "Darkseid"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'arquivos-da-torre-de-vigilancia'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Em que ano o Superman estreou nos quadrinhos, em Action Comics #1?", "en": "In which year did Superman debut in Action Comics #1?"}', '[{"key": "a", "text": {"pt-BR": "1938", "en": "1938"}}, {"key": "b", "text": {"pt-BR": "1939", "en": "1939"}}, {"key": "c", "text": {"pt-BR": "1941", "en": "1941"}}, {"key": "d", "text": {"pt-BR": "1945", "en": "1945"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'arquivos-da-torre-de-vigilancia'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "Em qual cidade Barry Allen vive?", "en": "Which city does Barry Allen live in?"}', '[{"key": "a", "text": {"pt-BR": "Keystone City", "en": "Keystone City"}}, {"key": "b", "text": {"pt-BR": "Central City", "en": "Central City"}}, {"key": "c", "text": {"pt-BR": "Coast City", "en": "Coast City"}}, {"key": "d", "text": {"pt-BR": "Star City", "en": "Star City"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'arquivos-da-torre-de-vigilancia'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 7, '{"pt-BR": "Quem foi Batgirl e depois se tornou Oráculo?", "en": "Who was Batgirl and later became Oracle?"}', '[{"key": "a", "text": {"pt-BR": "Cassandra Cain", "en": "Cassandra Cain"}}, {"key": "b", "text": {"pt-BR": "Stephanie Brown", "en": "Stephanie Brown"}}, {"key": "c", "text": {"pt-BR": "Barbara Gordon", "en": "Barbara Gordon"}}, {"key": "d", "text": {"pt-BR": "Selina Kyle", "en": "Selina Kyle"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'arquivos-da-torre-de-vigilancia'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 8, '{"pt-BR": "Em qual cidade o Arqueiro Verde atua?", "en": "Which city does Green Arrow protect?"}', '[{"key": "a", "text": {"pt-BR": "Gotham", "en": "Gotham"}}, {"key": "b", "text": {"pt-BR": "Metrópolis", "en": "Metropolis"}}, {"key": "c", "text": {"pt-BR": "Blüdhaven", "en": "Blüdhaven"}}, {"key": "d", "text": {"pt-BR": "Star City", "en": "Star City"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'arquivos-da-torre-de-vigilancia'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'rebeliao', 'trivia', '{"pt-BR": "Rebelião", "en": "Rebellion"}', '{"pt-BR": "Oito perguntas para quem já passou do básico.", "en": "Eight questions for those past the basics."}', 'normal', 80, false, 30
  FROM public.universes WHERE slug = 'star-wars'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Quem treina Rey em \"Os Últimos Jedi\"?", "en": "Who trains Rey in \"The Last Jedi\"?"}', '[{"key": "a", "text": {"pt-BR": "Leia Organa", "en": "Leia Organa"}}, {"key": "b", "text": {"pt-BR": "Maz Kanata", "en": "Maz Kanata"}}, {"key": "c", "text": {"pt-BR": "Luke Skywalker", "en": "Luke Skywalker"}}, {"key": "d", "text": {"pt-BR": "Han Solo", "en": "Han Solo"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'rebeliao'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Qual é o droide astromecânico azul e branco?", "en": "Which astromech droid is blue and white?"}', '[{"key": "a", "text": {"pt-BR": "R2-D2", "en": "R2-D2"}}, {"key": "b", "text": {"pt-BR": "C-3PO", "en": "C-3PO"}}, {"key": "c", "text": {"pt-BR": "BB-8", "en": "BB-8"}}, {"key": "d", "text": {"pt-BR": "K-2SO", "en": "K-2SO"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'rebeliao'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "De qual espécie é Chewbacca?", "en": "What species is Chewbacca?"}', '[{"key": "a", "text": {"pt-BR": "Ewok", "en": "Ewok"}}, {"key": "b", "text": {"pt-BR": "Wookiee", "en": "Wookiee"}}, {"key": "c", "text": {"pt-BR": "Jawa", "en": "Jawa"}}, {"key": "d", "text": {"pt-BR": "Twi''lek", "en": "Twi''lek"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'rebeliao'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Qual planeta gelado abriga a base rebelde em \"O Império Contra-Ataca\"?", "en": "Which ice planet hosts the rebel base in \"The Empire Strikes Back\"?"}', '[{"key": "a", "text": {"pt-BR": "Endor", "en": "Endor"}}, {"key": "b", "text": {"pt-BR": "Dagobah", "en": "Dagobah"}}, {"key": "c", "text": {"pt-BR": "Bespin", "en": "Bespin"}}, {"key": "d", "text": {"pt-BR": "Hoth", "en": "Hoth"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'rebeliao'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Qual é a profissão de Han Solo quando conhece Luke?", "en": "What is Han Solo''s job when he meets Luke?"}', '[{"key": "a", "text": {"pt-BR": "Contrabandista", "en": "Smuggler"}}, {"key": "b", "text": {"pt-BR": "Senador", "en": "Senator"}}, {"key": "c", "text": {"pt-BR": "Piloto imperial", "en": "Imperial pilot"}}, {"key": "d", "text": {"pt-BR": "Caçador de recompensas", "en": "Bounty hunter"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'rebeliao'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "Quem é a irmã gêmea de Luke?", "en": "Who is Luke''s twin sister?"}', '[{"key": "a", "text": {"pt-BR": "Padmé", "en": "Padmé"}}, {"key": "b", "text": {"pt-BR": "Rey", "en": "Rey"}}, {"key": "c", "text": {"pt-BR": "Leia", "en": "Leia"}}, {"key": "d", "text": {"pt-BR": "Ahsoka", "en": "Ahsoka"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'rebeliao'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 7, '{"pt-BR": "Em qual lua florestal vivem os Ewoks?", "en": "On which forest moon do the Ewoks live?"}', '[{"key": "a", "text": {"pt-BR": "Yavin 4", "en": "Yavin 4"}}, {"key": "b", "text": {"pt-BR": "Endor", "en": "Endor"}}, {"key": "c", "text": {"pt-BR": "Naboo", "en": "Naboo"}}, {"key": "d", "text": {"pt-BR": "Kashyyyk", "en": "Kashyyyk"}}]', 'b', '{"pt-BR": "Kashyyyk é o planeta natal dos Wookiees.", "en": "Kashyyyk is the Wookiee homeworld."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'rebeliao'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 8, '{"pt-BR": "Qual é a cor do sabre de luz de Mace Windu?", "en": "What color is Mace Windu''s lightsaber?"}', '[{"key": "a", "text": {"pt-BR": "Azul", "en": "Blue"}}, {"key": "b", "text": {"pt-BR": "Verde", "en": "Green"}}, {"key": "c", "text": {"pt-BR": "Vermelho", "en": "Red"}}, {"key": "d", "text": {"pt-BR": "Roxo", "en": "Purple"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'rebeliao'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'arquivos-jedi', 'trivia', '{"pt-BR": "Arquivos Jedi", "en": "Jedi archives"}', '{"pt-BR": "Oito perguntas difíceis. Só para especialistas.", "en": "Eight hard questions. Experts only."}', 'hard', 120, false, 40
  FROM public.universes WHERE slug = 'star-wars'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Quem foi o mestre de Obi-Wan Kenobi?", "en": "Who was Obi-Wan Kenobi''s master?"}', '[{"key": "a", "text": {"pt-BR": "Yoda", "en": "Yoda"}}, {"key": "b", "text": {"pt-BR": "Mace Windu", "en": "Mace Windu"}}, {"key": "c", "text": {"pt-BR": "Conde Dookan", "en": "Count Dooku"}}, {"key": "d", "text": {"pt-BR": "Qui-Gon Jinn", "en": "Qui-Gon Jinn"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'arquivos-jedi'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Qual é o nome Sith de Palpatine?", "en": "What is Palpatine''s Sith name?"}', '[{"key": "a", "text": {"pt-BR": "Darth Sidious", "en": "Darth Sidious"}}, {"key": "b", "text": {"pt-BR": "Darth Plagueis", "en": "Darth Plagueis"}}, {"key": "c", "text": {"pt-BR": "Darth Maul", "en": "Darth Maul"}}, {"key": "d", "text": {"pt-BR": "Darth Tyranus", "en": "Darth Tyranus"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'arquivos-jedi'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Qual caçador de recompensas leva Han Solo congelado em carbonita?", "en": "Which bounty hunter takes Han Solo frozen in carbonite?"}', '[{"key": "a", "text": {"pt-BR": "Jango Fett", "en": "Jango Fett"}}, {"key": "b", "text": {"pt-BR": "Boba Fett", "en": "Boba Fett"}}, {"key": "c", "text": {"pt-BR": "Bossk", "en": "Bossk"}}, {"key": "d", "text": {"pt-BR": "IG-88", "en": "IG-88"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'arquivos-jedi'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Em qual planeta Obi-Wan e Anakin duelam em \"A Vingança dos Sith\"?", "en": "On which planet do Obi-Wan and Anakin duel in \"Revenge of the Sith\"?"}', '[{"key": "a", "text": {"pt-BR": "Geonosis", "en": "Geonosis"}}, {"key": "b", "text": {"pt-BR": "Utapau", "en": "Utapau"}}, {"key": "c", "text": {"pt-BR": "Mustafar", "en": "Mustafar"}}, {"key": "d", "text": {"pt-BR": "Kamino", "en": "Kamino"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'arquivos-jedi'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Em qual planeta são criados os clones da República?", "en": "On which planet are the Republic''s clones made?"}', '[{"key": "a", "text": {"pt-BR": "Kamino", "en": "Kamino"}}, {"key": "b", "text": {"pt-BR": "Geonosis", "en": "Geonosis"}}, {"key": "c", "text": {"pt-BR": "Coruscant", "en": "Coruscant"}}, {"key": "d", "text": {"pt-BR": "Mandalore", "en": "Mandalore"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'arquivos-jedi'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "Qual é o número do episódio \"Uma Nova Esperança\"?", "en": "Which episode number is \"A New Hope\"?"}', '[{"key": "a", "text": {"pt-BR": "I", "en": "I"}}, {"key": "b", "text": {"pt-BR": "III", "en": "III"}}, {"key": "c", "text": {"pt-BR": "VI", "en": "VI"}}, {"key": "d", "text": {"pt-BR": "IV", "en": "IV"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'arquivos-jedi'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 7, '{"pt-BR": "Quem é a aprendiz de Anakin em \"The Clone Wars\"?", "en": "Who is Anakin''s apprentice in \"The Clone Wars\"?"}', '[{"key": "a", "text": {"pt-BR": "Barriss Offee", "en": "Barriss Offee"}}, {"key": "b", "text": {"pt-BR": "Ahsoka Tano", "en": "Ahsoka Tano"}}, {"key": "c", "text": {"pt-BR": "Asajj Ventress", "en": "Asajj Ventress"}}, {"key": "d", "text": {"pt-BR": "Sabine Wren", "en": "Sabine Wren"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'arquivos-jedi'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 8, '{"pt-BR": "O que Padmé Amidala foi antes de se tornar senadora?", "en": "What was Padmé Amidala before becoming a senator?"}', '[{"key": "a", "text": {"pt-BR": "General da República", "en": "Republic general"}}, {"key": "b", "text": {"pt-BR": "Cavaleira Jedi", "en": "Jedi Knight"}}, {"key": "c", "text": {"pt-BR": "Rainha de Naboo", "en": "Queen of Naboo"}}, {"key": "d", "text": {"pt-BR": "Piloto de caça", "en": "Fighter pilot"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'arquivos-jedi'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'residencia-no-grey-sloan', 'trivia', '{"pt-BR": "Residência no Grey Sloan", "en": "Residency at Grey Sloan"}', '{"pt-BR": "Oito perguntas para quem já passou do básico.", "en": "Eight questions for those past the basics."}', 'normal', 80, false, 30
  FROM public.universes WHERE slug = 'greys-anatomy'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Qual é o nome atual do hospital, depois que os médicos o compram?", "en": "What is the hospital''s current name after the doctors buy it?"}', '[{"key": "a", "text": {"pt-BR": "Seattle Grace", "en": "Seattle Grace"}}, {"key": "b", "text": {"pt-BR": "Mercy West", "en": "Mercy West"}}, {"key": "c", "text": {"pt-BR": "Grey Sloan Memorial", "en": "Grey Sloan Memorial"}}, {"key": "d", "text": {"pt-BR": "Pac North", "en": "Pac North"}}]', 'c', '{"pt-BR": "Antes ele se chamava Seattle Grace e depois Seattle Grace Mercy West.", "en": "It was Seattle Grace and later Seattle Grace Mercy West."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'residencia-no-grey-sloan'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Qual é o primeiro nome da Dra. Bailey?", "en": "What is Dr. Bailey''s first name?"}', '[{"key": "a", "text": {"pt-BR": "Maggie", "en": "Maggie"}}, {"key": "b", "text": {"pt-BR": "Miranda", "en": "Miranda"}}, {"key": "c", "text": {"pt-BR": "Callie", "en": "Callie"}}, {"key": "d", "text": {"pt-BR": "April", "en": "April"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'residencia-no-grey-sloan'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Quem é o chefe de cirurgia no início da série?", "en": "Who is chief of surgery at the start of the show?"}', '[{"key": "a", "text": {"pt-BR": "Richard Webber", "en": "Richard Webber"}}, {"key": "b", "text": {"pt-BR": "Derek Shepherd", "en": "Derek Shepherd"}}, {"key": "c", "text": {"pt-BR": "Owen Hunt", "en": "Owen Hunt"}}, {"key": "d", "text": {"pt-BR": "Preston Burke", "en": "Preston Burke"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'residencia-no-grey-sloan'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Qual é a especialidade de Callie Torres?", "en": "What is Callie Torres''s specialty?"}', '[{"key": "a", "text": {"pt-BR": "Neurocirurgia", "en": "Neurosurgery"}}, {"key": "b", "text": {"pt-BR": "Cirurgia plástica", "en": "Plastic surgery"}}, {"key": "c", "text": {"pt-BR": "Pediatria", "en": "Pediatrics"}}, {"key": "d", "text": {"pt-BR": "Ortopedia", "en": "Orthopedics"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'residencia-no-grey-sloan'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Qual é a especialidade de Arizona Robbins?", "en": "What is Arizona Robbins''s specialty?"}', '[{"key": "a", "text": {"pt-BR": "Cirurgia pediátrica", "en": "Pediatric surgery"}}, {"key": "b", "text": {"pt-BR": "Cardiologia", "en": "Cardiology"}}, {"key": "c", "text": {"pt-BR": "Trauma", "en": "Trauma"}}, {"key": "d", "text": {"pt-BR": "Ginecologia", "en": "Gynecology"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'residencia-no-grey-sloan'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "Quem Meredith chama de \"minha pessoa\"?", "en": "Who does Meredith call \"my person\"?"}', '[{"key": "a", "text": {"pt-BR": "Izzie Stevens", "en": "Izzie Stevens"}}, {"key": "b", "text": {"pt-BR": "Lexie Grey", "en": "Lexie Grey"}}, {"key": "c", "text": {"pt-BR": "Cristina Yang", "en": "Cristina Yang"}}, {"key": "d", "text": {"pt-BR": "Amelia Shepherd", "en": "Amelia Shepherd"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'residencia-no-grey-sloan'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 7, '{"pt-BR": "Qual atriz interpreta Meredith Grey?", "en": "Which actress plays Meredith Grey?"}', '[{"key": "a", "text": {"pt-BR": "Sandra Oh", "en": "Sandra Oh"}}, {"key": "b", "text": {"pt-BR": "Ellen Pompeo", "en": "Ellen Pompeo"}}, {"key": "c", "text": {"pt-BR": "Katherine Heigl", "en": "Katherine Heigl"}}, {"key": "d", "text": {"pt-BR": "Chandra Wilson", "en": "Chandra Wilson"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'residencia-no-grey-sloan'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 8, '{"pt-BR": "Qual é a especialidade de Owen Hunt, ex-cirurgião do exército?", "en": "What is the specialty of Owen Hunt, a former army surgeon?"}', '[{"key": "a", "text": {"pt-BR": "Neurologia", "en": "Neurology"}}, {"key": "b", "text": {"pt-BR": "Oncologia", "en": "Oncology"}}, {"key": "c", "text": {"pt-BR": "Urologia", "en": "Urology"}}, {"key": "d", "text": {"pt-BR": "Trauma", "en": "Trauma"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'residencia-no-grey-sloan'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'casos-complexos', 'trivia', '{"pt-BR": "Casos complexos", "en": "Complex cases"}', '{"pt-BR": "Oito perguntas difíceis. Só para especialistas.", "en": "Eight hard questions. Experts only."}', 'hard', 120, false, 40
  FROM public.universes WHERE slug = 'greys-anatomy'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Em que ano Grey''s Anatomy estreou?", "en": "In which year did Grey''s Anatomy premiere?"}', '[{"key": "a", "text": {"pt-BR": "2003", "en": "2003"}}, {"key": "b", "text": {"pt-BR": "2005", "en": "2005"}}, {"key": "c", "text": {"pt-BR": "2007", "en": "2007"}}, {"key": "d", "text": {"pt-BR": "2009", "en": "2009"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'casos-complexos'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Quem criou a série?", "en": "Who created the show?"}', '[{"key": "a", "text": {"pt-BR": "Shonda Rhimes", "en": "Shonda Rhimes"}}, {"key": "b", "text": {"pt-BR": "Ryan Murphy", "en": "Ryan Murphy"}}, {"key": "c", "text": {"pt-BR": "Dick Wolf", "en": "Dick Wolf"}}, {"key": "d", "text": {"pt-BR": "J.J. Abrams", "en": "J.J. Abrams"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'casos-complexos'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Qual é a especialidade de Mark Sloan?", "en": "What is Mark Sloan''s specialty?"}', '[{"key": "a", "text": {"pt-BR": "Ortopedia", "en": "Orthopedics"}}, {"key": "b", "text": {"pt-BR": "Trauma", "en": "Trauma"}}, {"key": "c", "text": {"pt-BR": "Cirurgia plástica", "en": "Plastic surgery"}}, {"key": "d", "text": {"pt-BR": "Cardiotorácica", "en": "Cardiothoracic"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'casos-complexos'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Qual meia-irmã de Meredith é chamada de \"Little Grey\"?", "en": "Which of Meredith''s half-sisters is called \"Little Grey\"?"}', '[{"key": "a", "text": {"pt-BR": "Maggie Pierce", "en": "Maggie Pierce"}}, {"key": "b", "text": {"pt-BR": "Molly Thompson", "en": "Molly Thompson"}}, {"key": "c", "text": {"pt-BR": "Amelia Shepherd", "en": "Amelia Shepherd"}}, {"key": "d", "text": {"pt-BR": "Lexie Grey", "en": "Lexie Grey"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'casos-complexos'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Qual interno ganha o apelido de \"007\" na primeira temporada?", "en": "Which intern earns the nickname \"007\" in season one?"}', '[{"key": "a", "text": {"pt-BR": "George O''Malley", "en": "George O''Malley"}}, {"key": "b", "text": {"pt-BR": "Alex Karev", "en": "Alex Karev"}}, {"key": "c", "text": {"pt-BR": "Jackson Avery", "en": "Jackson Avery"}}, {"key": "d", "text": {"pt-BR": "Ben Warren", "en": "Ben Warren"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'casos-complexos'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "O título da série é um trocadilho com o quê?", "en": "The show''s title is a pun on what?"}', '[{"key": "a", "text": {"pt-BR": "Uma peça de teatro", "en": "A stage play"}}, {"key": "b", "text": {"pt-BR": "Um clássico livro de anatomia", "en": "A classic anatomy textbook"}}, {"key": "c", "text": {"pt-BR": "Uma música dos anos 60", "en": "A 1960s song"}}, {"key": "d", "text": {"pt-BR": "Um romance policial", "en": "A crime novel"}}]', 'b', '{"pt-BR": "\"Gray''s Anatomy\", de Henry Gray, é um livro de anatomia de 1858.", "en": "\"Gray''s Anatomy\" by Henry Gray is an 1858 anatomy textbook."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'casos-complexos'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 7, '{"pt-BR": "Qual é a especialidade de Amelia Shepherd?", "en": "What is Amelia Shepherd''s specialty?"}', '[{"key": "a", "text": {"pt-BR": "Cardiotorácica", "en": "Cardiothoracic"}}, {"key": "b", "text": {"pt-BR": "Cirurgia geral", "en": "General surgery"}}, {"key": "c", "text": {"pt-BR": "Neurocirurgia", "en": "Neurosurgery"}}, {"key": "d", "text": {"pt-BR": "Obstetrícia", "en": "Obstetrics"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'casos-complexos'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 8, '{"pt-BR": "Qual é o bar em frente ao hospital que os médicos frequentam?", "en": "Which bar across from the hospital do the doctors frequent?"}', '[{"key": "a", "text": {"pt-BR": "Central Perk", "en": "Central Perk"}}, {"key": "b", "text": {"pt-BR": "MacLaren''s", "en": "MacLaren''s"}}, {"key": "c", "text": {"pt-BR": "Paddy''s", "en": "Paddy''s"}}, {"key": "d", "text": {"pt-BR": "Joe''s", "en": "Joe''s"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'casos-complexos'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'turno-no-quartel', 'trivia', '{"pt-BR": "Turno no quartel", "en": "Shift at the station"}', '{"pt-BR": "Oito perguntas para quem já passou do básico.", "en": "Eight questions for those past the basics."}', 'normal', 80, false, 30
  FROM public.universes WHERE slug = 'station-19'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Qual cirurgião de Grey''s Anatomy vira bombeiro em Station 19?", "en": "Which Grey''s Anatomy surgeon becomes a firefighter on Station 19?"}', '[{"key": "a", "text": {"pt-BR": "Jack Gibson", "en": "Jack Gibson"}}, {"key": "b", "text": {"pt-BR": "Ben Warren", "en": "Ben Warren"}}, {"key": "c", "text": {"pt-BR": "Dean Miller", "en": "Dean Miller"}}, {"key": "d", "text": {"pt-BR": "Travis Montgomery", "en": "Travis Montgomery"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'turno-no-quartel'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Qual bombeira foi atleta olímpica?", "en": "Which firefighter was an Olympic athlete?"}', '[{"key": "a", "text": {"pt-BR": "Maya Bishop", "en": "Maya Bishop"}}, {"key": "b", "text": {"pt-BR": "Vic Hughes", "en": "Vic Hughes"}}, {"key": "c", "text": {"pt-BR": "Andy Herrera", "en": "Andy Herrera"}}, {"key": "d", "text": {"pt-BR": "Natasha Ross", "en": "Natasha Ross"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'turno-no-quartel'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Com quem Ben Warren é casado?", "en": "Who is Ben Warren married to?"}', '[{"key": "a", "text": {"pt-BR": "Meredith Grey", "en": "Meredith Grey"}}, {"key": "b", "text": {"pt-BR": "Carina DeLuca", "en": "Carina DeLuca"}}, {"key": "c", "text": {"pt-BR": "Teddy Altman", "en": "Teddy Altman"}}, {"key": "d", "text": {"pt-BR": "Miranda Bailey", "en": "Miranda Bailey"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'turno-no-quartel'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Qual é a profissão de Carina DeLuca?", "en": "What is Carina DeLuca''s profession?"}', '[{"key": "a", "text": {"pt-BR": "Bombeira", "en": "Firefighter"}}, {"key": "b", "text": {"pt-BR": "Policial", "en": "Police officer"}}, {"key": "c", "text": {"pt-BR": "Obstetra", "en": "Obstetrician"}}, {"key": "d", "text": {"pt-BR": "Paramédica", "en": "Paramedic"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'turno-no-quartel'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Em que ano Station 19 estreou?", "en": "In which year did Station 19 premiere?"}', '[{"key": "a", "text": {"pt-BR": "2016", "en": "2016"}}, {"key": "b", "text": {"pt-BR": "2018", "en": "2018"}}, {"key": "c", "text": {"pt-BR": "2020", "en": "2020"}}, {"key": "d", "text": {"pt-BR": "2022", "en": "2022"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'turno-no-quartel'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "Quantas temporadas Station 19 teve?", "en": "How many seasons did Station 19 have?"}', '[{"key": "a", "text": {"pt-BR": "5", "en": "5"}}, {"key": "b", "text": {"pt-BR": "6", "en": "6"}}, {"key": "c", "text": {"pt-BR": "7", "en": "7"}}, {"key": "d", "text": {"pt-BR": "9", "en": "9"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'turno-no-quartel'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 7, '{"pt-BR": "Qual é a profissão de Ryan Tanner, amigo de infância de Andy?", "en": "What is the job of Ryan Tanner, Andy''s childhood friend?"}', '[{"key": "a", "text": {"pt-BR": "Policial", "en": "Police officer"}}, {"key": "b", "text": {"pt-BR": "Médico", "en": "Doctor"}}, {"key": "c", "text": {"pt-BR": "Bombeiro", "en": "Firefighter"}}, {"key": "d", "text": {"pt-BR": "Advogado", "en": "Lawyer"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'turno-no-quartel'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 8, '{"pt-BR": "Qual é a primeira atitude ao perceber um incêndio em casa?", "en": "What is the first thing to do when you notice a fire at home?"}', '[{"key": "a", "text": {"pt-BR": "Abrir todas as janelas", "en": "Open every window"}}, {"key": "b", "text": {"pt-BR": "Pegar os objetos de valor", "en": "Grab your valuables"}}, {"key": "c", "text": {"pt-BR": "Jogar água em tudo", "en": "Throw water on everything"}}, {"key": "d", "text": {"pt-BR": "Sair com segurança e chamar os bombeiros (193)", "en": "Get out safely and call the fire department"}}]', 'd', '{"pt-BR": "Vidas primeiro: saia, feche portas atrás de você e ligue 193.", "en": "Lives first: get out, close doors behind you and call for help."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'turno-no-quartel'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'seguranca-e-resgate', 'trivia', '{"pt-BR": "Segurança e resgate", "en": "Safety and rescue"}', '{"pt-BR": "Oito perguntas difíceis. Só para especialistas.", "en": "Eight hard questions. Experts only."}', 'hard', 120, false, 40
  FROM public.universes WHERE slug = 'station-19'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Qual chefe dos bombeiros namorou Vic Hughes?", "en": "Which fire chief dated Vic Hughes?"}', '[{"key": "a", "text": {"pt-BR": "Robert Sullivan", "en": "Robert Sullivan"}}, {"key": "b", "text": {"pt-BR": "Lucas Ripley", "en": "Lucas Ripley"}}, {"key": "c", "text": {"pt-BR": "Michael Dixon", "en": "Michael Dixon"}}, {"key": "d", "text": {"pt-BR": "Pruitt Herrera", "en": "Pruitt Herrera"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'seguranca-e-resgate'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "No Brasil, incêndios em líquidos inflamáveis são de qual classe?", "en": "In Brazil, fires in flammable liquids are which class?"}', '[{"key": "a", "text": {"pt-BR": "Classe A", "en": "Class A"}}, {"key": "b", "text": {"pt-BR": "Classe B", "en": "Class B"}}, {"key": "c", "text": {"pt-BR": "Classe C", "en": "Class C"}}, {"key": "d", "text": {"pt-BR": "Classe D", "en": "Class D"}}]', 'b', '{"pt-BR": "Gasolina, óleo e álcool formam incêndios classe B.", "en": "Gasoline, oil and alcohol make class B fires."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'seguranca-e-resgate'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Madeira, papel e tecido em chamas formam incêndio de qual classe?", "en": "Burning wood, paper and fabric make which class of fire?"}', '[{"key": "a", "text": {"pt-BR": "Classe A", "en": "Class A"}}, {"key": "b", "text": {"pt-BR": "Classe B", "en": "Class B"}}, {"key": "c", "text": {"pt-BR": "Classe C", "en": "Class C"}}, {"key": "d", "text": {"pt-BR": "Classe K", "en": "Class K"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'seguranca-e-resgate'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Qual agente NUNCA deve ser usado em equipamento elétrico energizado?", "en": "Which agent must NEVER be used on energized electrical equipment?"}', '[{"key": "a", "text": {"pt-BR": "CO₂", "en": "CO₂"}}, {"key": "b", "text": {"pt-BR": "Pó químico", "en": "Dry chemical"}}, {"key": "c", "text": {"pt-BR": "Água", "en": "Water"}}, {"key": "d", "text": {"pt-BR": "Desligar a energia", "en": "Cutting the power"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'seguranca-e-resgate'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Como sair de um ambiente com fumaça?", "en": "How should you leave a smoke-filled room?"}', '[{"key": "a", "text": {"pt-BR": "Correndo de pé", "en": "Running upright"}}, {"key": "b", "text": {"pt-BR": "Pela janela mais alta", "en": "Through the highest window"}}, {"key": "c", "text": {"pt-BR": "Respirando fundo pela boca", "en": "Breathing deeply through your mouth"}}, {"key": "d", "text": {"pt-BR": "Abaixado, perto do chão", "en": "Low, close to the floor"}}]', 'd', '{"pt-BR": "O ar mais limpo fica perto do chão.", "en": "The cleanest air is near the floor."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'seguranca-e-resgate'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "O que fazer se a sua roupa pegar fogo?", "en": "What should you do if your clothes catch fire?"}', '[{"key": "a", "text": {"pt-BR": "Parar, deitar e rolar", "en": "Stop, drop and roll"}}, {"key": "b", "text": {"pt-BR": "Correr até a água", "en": "Run to water"}}, {"key": "c", "text": {"pt-BR": "Abanar as chamas", "en": "Fan the flames"}}, {"key": "d", "text": {"pt-BR": "Tirar a roupa correndo", "en": "Strip while running"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'seguranca-e-resgate'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 7, '{"pt-BR": "Qual é o número de emergência usado nos Estados Unidos, onde a série se passa?", "en": "What emergency number is used in the US, where the show is set?"}', '[{"key": "a", "text": {"pt-BR": "112", "en": "112"}}, {"key": "b", "text": {"pt-BR": "999", "en": "999"}}, {"key": "c", "text": {"pt-BR": "911", "en": "911"}}, {"key": "d", "text": {"pt-BR": "190", "en": "190"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'seguranca-e-resgate'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 8, '{"pt-BR": "Para qual hospital fictício vão as vítimas resgatadas pelo quartel 19?", "en": "Which fictional hospital do Station 19''s rescued victims go to?"}', '[{"key": "a", "text": {"pt-BR": "Chicago Med", "en": "Chicago Med"}}, {"key": "b", "text": {"pt-BR": "Princeton-Plainsboro", "en": "Princeton-Plainsboro"}}, {"key": "c", "text": {"pt-BR": "Sacred Heart", "en": "Sacred Heart"}}, {"key": "d", "text": {"pt-BR": "Grey Sloan Memorial", "en": "Grey Sloan Memorial"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'seguranca-e-resgate'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'era-de-ouro', 'trivia', '{"pt-BR": "Era de ouro", "en": "Golden era"}', '{"pt-BR": "Oito perguntas para quem já passou do básico.", "en": "Eight questions for those past the basics."}', 'normal', 80, false, 30
  FROM public.universes WHERE slug = 'bts'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Quem é o líder do BTS?", "en": "Who is the leader of BTS?"}', '[{"key": "a", "text": {"pt-BR": "Jin", "en": "Jin"}}, {"key": "b", "text": {"pt-BR": "RM", "en": "RM"}}, {"key": "c", "text": {"pt-BR": "Suga", "en": "Suga"}}, {"key": "d", "text": {"pt-BR": "Jimin", "en": "Jimin"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'era-de-ouro'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Quem é o integrante mais novo (maknae)?", "en": "Who is the youngest member (maknae)?"}', '[{"key": "a", "text": {"pt-BR": "V", "en": "V"}}, {"key": "b", "text": {"pt-BR": "Jimin", "en": "Jimin"}}, {"key": "c", "text": {"pt-BR": "j-hope", "en": "j-hope"}}, {"key": "d", "text": {"pt-BR": "Jungkook", "en": "Jungkook"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'era-de-ouro'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Quem é o integrante mais velho?", "en": "Who is the oldest member?"}', '[{"key": "a", "text": {"pt-BR": "Jin", "en": "Jin"}}, {"key": "b", "text": {"pt-BR": "Suga", "en": "Suga"}}, {"key": "c", "text": {"pt-BR": "RM", "en": "RM"}}, {"key": "d", "text": {"pt-BR": "j-hope", "en": "j-hope"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'era-de-ouro'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Qual cor acompanha a frase \"I purple you\"?", "en": "Which color goes with the phrase \"I purple you\"?"}', '[{"key": "a", "text": {"pt-BR": "Rosa", "en": "Pink"}}, {"key": "b", "text": {"pt-BR": "Azul", "en": "Blue"}}, {"key": "c", "text": {"pt-BR": "Roxo", "en": "Purple"}}, {"key": "d", "text": {"pt-BR": "Amarelo", "en": "Yellow"}}]', 'c', '{"pt-BR": "A expressão, criada por V, significa amar e confiar por muito tempo.", "en": "The phrase, coined by V, means to love and trust for a long time."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'era-de-ouro'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Qual foi a música de estreia do BTS, em 2013?", "en": "What was BTS''s debut song in 2013?"}', '[{"key": "a", "text": {"pt-BR": "No More Dream", "en": "No More Dream"}}, {"key": "b", "text": {"pt-BR": "Boy In Luv", "en": "Boy In Luv"}}, {"key": "c", "text": {"pt-BR": "Danger", "en": "Danger"}}, {"key": "d", "text": {"pt-BR": "Fire", "en": "Fire"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'era-de-ouro'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "Com qual nome Suga lança seus trabalhos solo?", "en": "Under which name does Suga release solo work?"}', '[{"key": "a", "text": {"pt-BR": "Rap Monster", "en": "Rap Monster"}}, {"key": "b", "text": {"pt-BR": "Agust D", "en": "Agust D"}}, {"key": "c", "text": {"pt-BR": "Golden", "en": "Golden"}}, {"key": "d", "text": {"pt-BR": "Hope World", "en": "Hope World"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'era-de-ouro'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 7, '{"pt-BR": "Quais personagens os integrantes criaram com a LINE Friends?", "en": "Which characters did the members create with LINE Friends?"}', '[{"key": "a", "text": {"pt-BR": "Kakao Friends", "en": "Kakao Friends"}}, {"key": "b", "text": {"pt-BR": "Sanrio", "en": "Sanrio"}}, {"key": "c", "text": {"pt-BR": "Pokémon", "en": "Pokémon"}}, {"key": "d", "text": {"pt-BR": "BT21", "en": "BT21"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'era-de-ouro'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 8, '{"pt-BR": "Em qual álbum está a música \"Fake Love\"?", "en": "Which album features \"Fake Love\"?"}', '[{"key": "a", "text": {"pt-BR": "Wings", "en": "Wings"}}, {"key": "b", "text": {"pt-BR": "Map of the Soul: 7", "en": "Map of the Soul: 7"}}, {"key": "c", "text": {"pt-BR": "Love Yourself: Tear", "en": "Love Yourself: Tear"}}, {"key": "d", "text": {"pt-BR": "BE", "en": "BE"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'era-de-ouro'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'arquivos-do-army', 'trivia', '{"pt-BR": "Arquivos do ARMY", "en": "ARMY archives"}', '{"pt-BR": "Oito perguntas difíceis. Só para especialistas.", "en": "Eight hard questions. Experts only."}', 'hard', 120, false, 40
  FROM public.universes WHERE slug = 'bts'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Em qual organização RM discursou em 2018?", "en": "At which organization did RM give a speech in 2018?"}', '[{"key": "a", "text": {"pt-BR": "ONU", "en": "United Nations"}}, {"key": "b", "text": {"pt-BR": "OTAN", "en": "NATO"}}, {"key": "c", "text": {"pt-BR": "FIFA", "en": "FIFA"}}, {"key": "d", "text": {"pt-BR": "OMC", "en": "WTO"}}]', 'a', '{"pt-BR": "O discurso fez parte da campanha Love Myself, com o UNICEF.", "en": "The speech was part of the Love Myself campaign with UNICEF."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'arquivos-do-army'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Qual é o nome de nascimento de V?", "en": "What is V''s birth name?"}', '[{"key": "a", "text": {"pt-BR": "Kim Namjoon", "en": "Kim Namjoon"}}, {"key": "b", "text": {"pt-BR": "Kim Seokjin", "en": "Kim Seokjin"}}, {"key": "c", "text": {"pt-BR": "Park Jimin", "en": "Park Jimin"}}, {"key": "d", "text": {"pt-BR": "Kim Taehyung", "en": "Kim Taehyung"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'arquivos-do-army'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Qual é o nome de nascimento de j-hope?", "en": "What is j-hope''s birth name?"}', '[{"key": "a", "text": {"pt-BR": "Jeon Jungkook", "en": "Jeon Jungkook"}}, {"key": "b", "text": {"pt-BR": "Jung Hoseok", "en": "Jung Hoseok"}}, {"key": "c", "text": {"pt-BR": "Min Yoongi", "en": "Min Yoongi"}}, {"key": "d", "text": {"pt-BR": "Park Jimin", "en": "Park Jimin"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'arquivos-do-army'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Qual música solo de Jungkook, com Latto, foi lançada em 2023?", "en": "Which 2023 Jungkook solo song features Latto?"}', '[{"key": "a", "text": {"pt-BR": "Like Crazy", "en": "Like Crazy"}}, {"key": "b", "text": {"pt-BR": "Slow Dancing", "en": "Slow Dancing"}}, {"key": "c", "text": {"pt-BR": "Seven", "en": "Seven"}}, {"key": "d", "text": {"pt-BR": "Set Me Free Pt.2", "en": "Set Me Free Pt.2"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'arquivos-do-army'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Qual integrante lançou o álbum \"Face\", com \"Like Crazy\"?", "en": "Which member released the album \"Face\", with \"Like Crazy\"?"}', '[{"key": "a", "text": {"pt-BR": "Jimin", "en": "Jimin"}}, {"key": "b", "text": {"pt-BR": "V", "en": "V"}}, {"key": "c", "text": {"pt-BR": "Jin", "en": "Jin"}}, {"key": "d", "text": {"pt-BR": "Suga", "en": "Suga"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'arquivos-do-army'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "Qual empresa formou o BTS?", "en": "Which company formed BTS?"}', '[{"key": "a", "text": {"pt-BR": "SM Entertainment", "en": "SM Entertainment"}}, {"key": "b", "text": {"pt-BR": "YG Entertainment", "en": "YG Entertainment"}}, {"key": "c", "text": {"pt-BR": "JYP Entertainment", "en": "JYP Entertainment"}}, {"key": "d", "text": {"pt-BR": "Big Hit Entertainment", "en": "Big Hit Entertainment"}}]', 'd', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'arquivos-do-army'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 7, '{"pt-BR": "Quem foi o primeiro integrante a se alistar no serviço militar, em dezembro de 2022?", "en": "Who was the first member to enlist for military service, in December 2022?"}', '[{"key": "a", "text": {"pt-BR": "RM", "en": "RM"}}, {"key": "b", "text": {"pt-BR": "Jin", "en": "Jin"}}, {"key": "c", "text": {"pt-BR": "Suga", "en": "Suga"}}, {"key": "d", "text": {"pt-BR": "j-hope", "en": "j-hope"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'arquivos-do-army'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 8, '{"pt-BR": "Qual série de álbuns inclui \"Persona\" e \"7\"?", "en": "Which album series includes \"Persona\" and \"7\"?"}', '[{"key": "a", "text": {"pt-BR": "Love Yourself", "en": "Love Yourself"}}, {"key": "b", "text": {"pt-BR": "The Most Beautiful Moment in Life", "en": "The Most Beautiful Moment in Life"}}, {"key": "c", "text": {"pt-BR": "Map of the Soul", "en": "Map of the Soul"}}, {"key": "d", "text": {"pt-BR": "Dark & Wild", "en": "Dark & Wild"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'arquivos-do-army'
ON CONFLICT (quiz_id, position) DO NOTHING;
