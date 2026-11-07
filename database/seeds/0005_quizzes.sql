-- Reference data: quizzes for every launch universe (generated, original questions).
-- Idempotent: existing quizzes/questions are never overwritten (admin edits are kept).

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'qual-e-a-sua-casa', 'personality', '{"pt-BR": "Qual é a sua casa?", "en": "Which house are you?"}', '{"pt-BR": "Responda com sinceridade e descubra a casa que combina com você. O resultado vira sua identidade no universo.", "en": "Answer honestly and find the house that fits you. The result becomes your identity in this universe."}', 'easy', 30, true, 10
  FROM public.universes WHERE slug = 'harry-potter'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Diante de um desafio perigoso, você…", "en": "Facing a dangerous challenge, you…"}', '[{"key": "a", "text": {"pt-BR": "enfrenta de frente, sem pensar duas vezes", "en": "face it head-on, no second thoughts"}, "identity": "gryffindor"}, {"key": "b", "text": {"pt-BR": "procura a jogada que te dá vantagem", "en": "look for the move that gives you the edge"}, "identity": "slytherin"}, {"key": "c", "text": {"pt-BR": "estuda o problema até encontrar a solução", "en": "study the problem until you find the solution"}, "identity": "ravenclaw"}, {"key": "d", "text": {"pt-BR": "garante primeiro que todos estejam seguros", "en": "first make sure everyone is safe"}, "identity": "hufflepuff"}]', NULL, NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'qual-e-a-sua-casa'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "O que você mais valoriza em uma amizade?", "en": "What do you value most in a friendship?"}', '[{"key": "a", "text": {"pt-BR": "lealdade, aconteça o que acontecer", "en": "loyalty, no matter what"}, "identity": "hufflepuff"}, {"key": "b", "text": {"pt-BR": "conversas inteligentes e curiosidade", "en": "clever conversations and curiosity"}, "identity": "ravenclaw"}, {"key": "c", "text": {"pt-BR": "alguém que topa qualquer aventura", "en": "someone up for any adventure"}, "identity": "gryffindor"}, {"key": "d", "text": {"pt-BR": "parceria para chegar longe", "en": "a partner to go far together"}, "identity": "slytherin"}]', NULL, NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'qual-e-a-sua-casa'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Qual lugar do castelo mais te atrai?", "en": "Which place in the castle draws you most?"}', '[{"key": "a", "text": {"pt-BR": "a floresta proibida, cheia de mistérios", "en": "the forbidden forest, full of mysteries"}, "identity": "gryffindor"}, {"key": "b", "text": {"pt-BR": "a biblioteca, com seus livros raros", "en": "the library and its rare books"}, "identity": "ravenclaw"}, {"key": "c", "text": {"pt-BR": "as estufas e os jardins acolhedores", "en": "the greenhouses and cozy gardens"}, "identity": "hufflepuff"}, {"key": "d", "text": {"pt-BR": "as masmorras silenciosas sob o lago", "en": "the quiet dungeons beneath the lake"}, "identity": "slytherin"}]', NULL, NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'qual-e-a-sua-casa'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Como você gostaria de ser lembrado?", "en": "How would you like to be remembered?"}', '[{"key": "a", "text": {"pt-BR": "como alguém que chegou ao topo", "en": "as someone who reached the top"}, "identity": "slytherin"}, {"key": "b", "text": {"pt-BR": "como alguém sábio", "en": "as someone wise"}, "identity": "ravenclaw"}, {"key": "c", "text": {"pt-BR": "como alguém corajoso", "en": "as someone brave"}, "identity": "gryffindor"}, {"key": "d", "text": {"pt-BR": "como alguém gentil e justo", "en": "as someone kind and fair"}, "identity": "hufflepuff"}]', NULL, NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'qual-e-a-sua-casa'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Em um trabalho em grupo, você normalmente…", "en": "In a group project, you usually…"}', '[{"key": "a", "text": {"pt-BR": "assume a liderança e define o plano", "en": "take the lead and set the plan"}, "identity": "slytherin"}, {"key": "b", "text": {"pt-BR": "traz as ideias mais originais", "en": "bring the most original ideas"}, "identity": "ravenclaw"}, {"key": "c", "text": {"pt-BR": "defende o grupo quando surge um problema", "en": "stand up for the group when trouble comes"}, "identity": "gryffindor"}, {"key": "d", "text": {"pt-BR": "cuida para que todos participem", "en": "make sure everyone takes part"}, "identity": "hufflepuff"}]', NULL, NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'qual-e-a-sua-casa'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "Qual destes objetos encantados você escolheria?", "en": "Which of these enchanted objects would you pick?"}', '[{"key": "a", "text": {"pt-BR": "uma espada antiga que só aparece aos valentes", "en": "an ancient sword that only appears to the brave"}, "identity": "gryffindor"}, {"key": "b", "text": {"pt-BR": "um livro que responde a qualquer pergunta", "en": "a book that answers any question"}, "identity": "ravenclaw"}, {"key": "c", "text": {"pt-BR": "um anel que revela as intenções das pessoas", "en": "a ring that reveals people''s intentions"}, "identity": "slytherin"}, {"key": "d", "text": {"pt-BR": "uma estufa onde nada nunca murcha", "en": "a greenhouse where nothing ever withers"}, "identity": "hufflepuff"}]', NULL, NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'qual-e-a-sua-casa'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'conhecimentos-do-mundo-bruxo', 'trivia', '{"pt-BR": "Conhecimentos do mundo bruxo", "en": "Wizarding world knowledge"}', '{"pt-BR": "Seis perguntas para provar que você conhece a saga.", "en": "Six questions to prove you know the saga."}', 'easy', 60, false, 20
  FROM public.universes WHERE slug = 'harry-potter'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Qual é o nome da coruja de Harry?", "en": "What is the name of Harry''s owl?"}', '[{"key": "a", "text": {"pt-BR": "Edwiges", "en": "Hedwig"}}, {"key": "b", "text": {"pt-BR": "Errol", "en": "Errol"}}, {"key": "c", "text": {"pt-BR": "Píchi", "en": "Pigwidgeon"}}, {"key": "d", "text": {"pt-BR": "Bicuço", "en": "Buckbeak"}}]', 'a', '{"pt-BR": "Edwiges, a coruja-das-neves, foi um presente de Hagrid.", "en": "Hedwig, the snowy owl, was a gift from Hagrid."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'conhecimentos-do-mundo-bruxo'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Qual feitiço desarma o oponente?", "en": "Which spell disarms an opponent?"}', '[{"key": "a", "text": {"pt-BR": "Lumos", "en": "Lumos"}}, {"key": "b", "text": {"pt-BR": "Expelliarmus", "en": "Expelliarmus"}}, {"key": "c", "text": {"pt-BR": "Alohomora", "en": "Alohomora"}}, {"key": "d", "text": {"pt-BR": "Wingardium Leviosa", "en": "Wingardium Leviosa"}}]', 'b', '{"pt-BR": "Expelliarmus é o feitiço de desarmamento, marca registrada de Harry.", "en": "Expelliarmus is the Disarming Charm, Harry''s signature spell."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'conhecimentos-do-mundo-bruxo'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Qual posição Harry joga no time de quadribol?", "en": "Which Quidditch position does Harry play?"}', '[{"key": "a", "text": {"pt-BR": "Goleiro", "en": "Keeper"}}, {"key": "b", "text": {"pt-BR": "Batedor", "en": "Beater"}}, {"key": "c", "text": {"pt-BR": "Apanhador", "en": "Seeker"}}, {"key": "d", "text": {"pt-BR": "Artilheiro", "en": "Chaser"}}]', 'c', '{"pt-BR": "Harry é o apanhador, quem precisa capturar o pomo de ouro.", "en": "Harry is the Seeker, who must catch the Golden Snitch."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'conhecimentos-do-mundo-bruxo'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "De qual plataforma parte o Expresso de Hogwarts?", "en": "Which platform does the Hogwarts Express leave from?"}', '[{"key": "a", "text": {"pt-BR": "7½", "en": "7½"}}, {"key": "b", "text": {"pt-BR": "9¾", "en": "9¾"}}, {"key": "c", "text": {"pt-BR": "10", "en": "10"}}, {"key": "d", "text": {"pt-BR": "12¾", "en": "12¾"}}]', 'b', '{"pt-BR": "A plataforma 9¾ fica na estação de King''s Cross.", "en": "Platform 9¾ is at King''s Cross station."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'conhecimentos-do-mundo-bruxo'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Qual é a forma do patrono de Harry?", "en": "What form does Harry''s Patronus take?"}', '[{"key": "a", "text": {"pt-BR": "Lontra", "en": "Otter"}}, {"key": "b", "text": {"pt-BR": "Corça", "en": "Doe"}}, {"key": "c", "text": {"pt-BR": "Cervo", "en": "Stag"}}, {"key": "d", "text": {"pt-BR": "Lobo", "en": "Wolf"}}]', 'c', '{"pt-BR": "O patrono de Harry é um cervo, como o de seu pai.", "en": "Harry''s Patronus is a stag, like his father''s."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'conhecimentos-do-mundo-bruxo'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "Quem é o diretor de Hogwarts quando Harry chega à escola?", "en": "Who is headmaster of Hogwarts when Harry arrives?"}', '[{"key": "a", "text": {"pt-BR": "Severo Snape", "en": "Severus Snape"}}, {"key": "b", "text": {"pt-BR": "Alvo Dumbledore", "en": "Albus Dumbledore"}}, {"key": "c", "text": {"pt-BR": "Minerva McGonagall", "en": "Minerva McGonagall"}}, {"key": "d", "text": {"pt-BR": "Horácio Slughorn", "en": "Horace Slughorn"}}]', 'b', '{"pt-BR": "Alvo Dumbledore era o diretor de Hogwarts.", "en": "Albus Dumbledore was the headmaster."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'harry-potter' AND q.slug = 'conhecimentos-do-mundo-bruxo'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'manual-do-cacador', 'trivia', '{"pt-BR": "Manual do caçador", "en": "Hunter''s handbook"}', '{"pt-BR": "Teste seus conhecimentos sobre a estrada dos Winchester.", "en": "Test what you know about the Winchesters'' road."}', 'easy', 60, false, 20
  FROM public.universes WHERE slug = 'supernatural'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Qual é o carro dos irmãos Winchester?", "en": "What car do the Winchester brothers drive?"}', '[{"key": "a", "text": {"pt-BR": "Chevrolet Impala 1967", "en": "1967 Chevrolet Impala"}}, {"key": "b", "text": {"pt-BR": "Ford Mustang 1969", "en": "1969 Ford Mustang"}}, {"key": "c", "text": {"pt-BR": "Dodge Charger 1970", "en": "1970 Dodge Charger"}}, {"key": "d", "text": {"pt-BR": "Cadillac DeVille 1959", "en": "1959 Cadillac DeVille"}}]', 'a', '{"pt-BR": "O Impala 1967 preto é praticamente o terceiro irmão.", "en": "The black 1967 Impala is practically the third brother."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'manual-do-cacador'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Quem é o irmão mais novo?", "en": "Who is the younger brother?"}', '[{"key": "a", "text": {"pt-BR": "Dean", "en": "Dean"}}, {"key": "b", "text": {"pt-BR": "Sam", "en": "Sam"}}, {"key": "c", "text": {"pt-BR": "Adam", "en": "Adam"}}, {"key": "d", "text": {"pt-BR": "Bobby", "en": "Bobby"}}]', 'b', '{"pt-BR": "Sam é o mais novo; Dean é o mais velho.", "en": "Sam is the younger; Dean is the older."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'manual-do-cacador'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Qual é o nome do pai dos irmãos?", "en": "What is the brothers'' father''s name?"}', '[{"key": "a", "text": {"pt-BR": "Bobby", "en": "Bobby"}}, {"key": "b", "text": {"pt-BR": "John", "en": "John"}}, {"key": "c", "text": {"pt-BR": "Henry", "en": "Henry"}}, {"key": "d", "text": {"pt-BR": "Samuel", "en": "Samuel"}}]', 'b', '{"pt-BR": "John Winchester criou os filhos como caçadores.", "en": "John Winchester raised his sons as hunters."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'manual-do-cacador'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Qual anjo se torna grande aliado dos Winchester?", "en": "Which angel becomes a close ally of the Winchesters?"}', '[{"key": "a", "text": {"pt-BR": "Lúcifer", "en": "Lucifer"}}, {"key": "b", "text": {"pt-BR": "Gabriel", "en": "Gabriel"}}, {"key": "c", "text": {"pt-BR": "Castiel", "en": "Castiel"}}, {"key": "d", "text": {"pt-BR": "Zacarias", "en": "Zachariah"}}]', 'c', '{"pt-BR": "Castiel tira Dean do inferno e vira parte da família.", "en": "Castiel pulls Dean out of hell and becomes family."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'manual-do-cacador'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Para que os caçadores usam sal na série?", "en": "What do hunters use salt for in the show?"}', '[{"key": "a", "text": {"pt-BR": "Curar ferimentos", "en": "Healing wounds"}}, {"key": "b", "text": {"pt-BR": "Repelir espíritos e demônios", "en": "Repelling spirits and demons"}}, {"key": "c", "text": {"pt-BR": "Invocar anjos", "en": "Summoning angels"}}, {"key": "d", "text": {"pt-BR": "Abrir portais", "en": "Opening portals"}}]', 'b', '{"pt-BR": "Linhas de sal bloqueiam espíritos e demônios.", "en": "Salt lines block spirits and demons."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'manual-do-cacador'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "Qual demônio se torna Rei do Inferno?", "en": "Which demon becomes King of Hell?"}', '[{"key": "a", "text": {"pt-BR": "Azazel", "en": "Azazel"}}, {"key": "b", "text": {"pt-BR": "Lilith", "en": "Lilith"}}, {"key": "c", "text": {"pt-BR": "Crowley", "en": "Crowley"}}, {"key": "d", "text": {"pt-BR": "Meg", "en": "Meg"}}]', 'c', '{"pt-BR": "Crowley assume o trono do Inferno.", "en": "Crowley takes the throne of Hell."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'supernatural' AND q.slug = 'manual-do-cacador'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'herois-e-artefatos', 'trivia', '{"pt-BR": "Heróis e artefatos", "en": "Heroes and artifacts"}', '{"pt-BR": "Do vibranium ao Mjölnir: quanto você sabe?", "en": "From vibranium to Mjölnir: how much do you know?"}', 'easy', 60, false, 20
  FROM public.universes WHERE slug = 'marvel'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "De qual metal é feito o escudo do Capitão América?", "en": "What metal is Captain America''s shield made of?"}', '[{"key": "a", "text": {"pt-BR": "Adamantium", "en": "Adamantium"}}, {"key": "b", "text": {"pt-BR": "Vibranium", "en": "Vibranium"}}, {"key": "c", "text": {"pt-BR": "Uru", "en": "Uru"}}, {"key": "d", "text": {"pt-BR": "Titânio", "en": "Titanium"}}]', 'b', '{"pt-BR": "O escudo é de vibranium, metal raro de Wakanda.", "en": "The shield is vibranium, a rare metal from Wakanda."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'herois-e-artefatos'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Qual metal reveste o esqueleto do Wolverine?", "en": "What metal coats Wolverine''s skeleton?"}', '[{"key": "a", "text": {"pt-BR": "Vibranium", "en": "Vibranium"}}, {"key": "b", "text": {"pt-BR": "Adamantium", "en": "Adamantium"}}, {"key": "c", "text": {"pt-BR": "Ouro", "en": "Gold"}}, {"key": "d", "text": {"pt-BR": "Aço", "en": "Steel"}}]', 'b', '{"pt-BR": "O esqueleto do Wolverine é revestido de adamantium.", "en": "Wolverine''s skeleton is bonded with adamantium."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'herois-e-artefatos'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Qual é o nome do martelo de Thor?", "en": "What is the name of Thor''s hammer?"}', '[{"key": "a", "text": {"pt-BR": "Stormbreaker", "en": "Stormbreaker"}}, {"key": "b", "text": {"pt-BR": "Gungnir", "en": "Gungnir"}}, {"key": "c", "text": {"pt-BR": "Mjölnir", "en": "Mjölnir"}}, {"key": "d", "text": {"pt-BR": "Jarnbjorn", "en": "Jarnbjorn"}}]', 'c', '{"pt-BR": "Mjölnir só pode ser erguido por quem é digno.", "en": "Mjölnir can only be lifted by the worthy."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'herois-e-artefatos'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Qual é a identidade secreta do Homem-Aranha?", "en": "What is Spider-Man''s secret identity?"}', '[{"key": "a", "text": {"pt-BR": "Peter Parker", "en": "Peter Parker"}}, {"key": "b", "text": {"pt-BR": "Bruce Banner", "en": "Bruce Banner"}}, {"key": "c", "text": {"pt-BR": "Matt Murdock", "en": "Matt Murdock"}}, {"key": "d", "text": {"pt-BR": "Scott Lang", "en": "Scott Lang"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'herois-e-artefatos'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Tony Stark é qual herói?", "en": "Which hero is Tony Stark?"}', '[{"key": "a", "text": {"pt-BR": "Homem-Formiga", "en": "Ant-Man"}}, {"key": "b", "text": {"pt-BR": "Homem de Ferro", "en": "Iron Man"}}, {"key": "c", "text": {"pt-BR": "Visão", "en": "Vision"}}, {"key": "d", "text": {"pt-BR": "Falcão", "en": "Falcon"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'herois-e-artefatos'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "Qual herói é o rei de Wakanda?", "en": "Which hero is the king of Wakanda?"}', '[{"key": "a", "text": {"pt-BR": "Pantera Negra", "en": "Black Panther"}}, {"key": "b", "text": {"pt-BR": "Doutor Estranho", "en": "Doctor Strange"}}, {"key": "c", "text": {"pt-BR": "Gavião Arqueiro", "en": "Hawkeye"}}, {"key": "d", "text": {"pt-BR": "Cavaleiro da Lua", "en": "Moon Knight"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'marvel' AND q.slug = 'herois-e-artefatos'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'lendas-de-dc', 'trivia', '{"pt-BR": "Lendas da DC", "en": "DC legends"}', '{"pt-BR": "Krypton, Gotham e muito mais.", "en": "Krypton, Gotham and more."}', 'easy', 60, false, 20
  FROM public.universes WHERE slug = 'dc'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Qual é o planeta natal do Superman?", "en": "What is Superman''s home planet?"}', '[{"key": "a", "text": {"pt-BR": "Krypton", "en": "Krypton"}}, {"key": "b", "text": {"pt-BR": "Apokolips", "en": "Apokolips"}}, {"key": "c", "text": {"pt-BR": "Oa", "en": "Oa"}}, {"key": "d", "text": {"pt-BR": "Thanagar", "en": "Thanagar"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'lendas-de-dc'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Qual é a principal fraqueza do Superman?", "en": "What is Superman''s main weakness?"}', '[{"key": "a", "text": {"pt-BR": "Fogo", "en": "Fire"}}, {"key": "b", "text": {"pt-BR": "Kryptonita", "en": "Kryptonite"}}, {"key": "c", "text": {"pt-BR": "Água", "en": "Water"}}, {"key": "d", "text": {"pt-BR": "Escuridão", "en": "Darkness"}}]', 'b', '{"pt-BR": "Fragmentos de Krypton, a kryptonita enfraquece o herói.", "en": "Fragments of Krypton, kryptonite weakens him."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'lendas-de-dc'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Em qual cidade o Batman atua?", "en": "Which city does Batman protect?"}', '[{"key": "a", "text": {"pt-BR": "Metrópolis", "en": "Metropolis"}}, {"key": "b", "text": {"pt-BR": "Central City", "en": "Central City"}}, {"key": "c", "text": {"pt-BR": "Gotham", "en": "Gotham"}}, {"key": "d", "text": {"pt-BR": "Star City", "en": "Star City"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'lendas-de-dc'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Qual é a identidade secreta do Batman?", "en": "What is Batman''s secret identity?"}', '[{"key": "a", "text": {"pt-BR": "Clark Kent", "en": "Clark Kent"}}, {"key": "b", "text": {"pt-BR": "Bruce Wayne", "en": "Bruce Wayne"}}, {"key": "c", "text": {"pt-BR": "Barry Allen", "en": "Barry Allen"}}, {"key": "d", "text": {"pt-BR": "Hal Jordan", "en": "Hal Jordan"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'lendas-de-dc'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "De onde vem a Mulher-Maravilha?", "en": "Where does Wonder Woman come from?"}', '[{"key": "a", "text": {"pt-BR": "Atlântida", "en": "Atlantis"}}, {"key": "b", "text": {"pt-BR": "Themyscira", "en": "Themyscira"}}, {"key": "c", "text": {"pt-BR": "Krypton", "en": "Krypton"}}, {"key": "d", "text": {"pt-BR": "Gotham", "en": "Gotham"}}]', 'b', '{"pt-BR": "Diana é uma princesa amazona de Themyscira.", "en": "Diana is an Amazon princess from Themyscira."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'lendas-de-dc'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "Qual é o principal poder do Flash?", "en": "What is the Flash''s main power?"}', '[{"key": "a", "text": {"pt-BR": "Voo", "en": "Flight"}}, {"key": "b", "text": {"pt-BR": "Supervelocidade", "en": "Super speed"}}, {"key": "c", "text": {"pt-BR": "Invisibilidade", "en": "Invisibility"}}, {"key": "d", "text": {"pt-BR": "Telepatia", "en": "Telepathy"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'dc' AND q.slug = 'lendas-de-dc'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'academia-jedi', 'trivia', '{"pt-BR": "Academia Jedi", "en": "Jedi academy"}', '{"pt-BR": "Uma galáxia de perguntas.", "en": "A galaxy of questions."}', 'easy', 60, false, 20
  FROM public.universes WHERE slug = 'star-wars'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Quem é o pai de Luke Skywalker?", "en": "Who is Luke Skywalker''s father?"}', '[{"key": "a", "text": {"pt-BR": "Obi-Wan Kenobi", "en": "Obi-Wan Kenobi"}}, {"key": "b", "text": {"pt-BR": "Darth Vader", "en": "Darth Vader"}}, {"key": "c", "text": {"pt-BR": "Han Solo", "en": "Han Solo"}}, {"key": "d", "text": {"pt-BR": "Palpatine", "en": "Palpatine"}}]', 'b', '{"pt-BR": "Darth Vader é Anakin Skywalker, pai de Luke.", "en": "Darth Vader is Anakin Skywalker, Luke''s father."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'academia-jedi'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Qual é a nave de Han Solo?", "en": "What is Han Solo''s ship?"}', '[{"key": "a", "text": {"pt-BR": "Millennium Falcon", "en": "Millennium Falcon"}}, {"key": "b", "text": {"pt-BR": "X-Wing", "en": "X-Wing"}}, {"key": "c", "text": {"pt-BR": "Slave I", "en": "Slave I"}}, {"key": "d", "text": {"pt-BR": "Ghost", "en": "Ghost"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'academia-jedi'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Qual mestre Jedi treina Luke em Dagobah?", "en": "Which Jedi Master trains Luke on Dagobah?"}', '[{"key": "a", "text": {"pt-BR": "Mace Windu", "en": "Mace Windu"}}, {"key": "b", "text": {"pt-BR": "Qui-Gon Jinn", "en": "Qui-Gon Jinn"}}, {"key": "c", "text": {"pt-BR": "Yoda", "en": "Yoda"}}, {"key": "d", "text": {"pt-BR": "Ahsoka Tano", "en": "Ahsoka Tano"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'academia-jedi'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Qual é o planeta natal de Luke?", "en": "What is Luke''s home planet?"}', '[{"key": "a", "text": {"pt-BR": "Tatooine", "en": "Tatooine"}}, {"key": "b", "text": {"pt-BR": "Hoth", "en": "Hoth"}}, {"key": "c", "text": {"pt-BR": "Naboo", "en": "Naboo"}}, {"key": "d", "text": {"pt-BR": "Endor", "en": "Endor"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'academia-jedi'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Qual é a arma característica dos Jedi?", "en": "What is the Jedi''s signature weapon?"}', '[{"key": "a", "text": {"pt-BR": "Blaster", "en": "Blaster"}}, {"key": "b", "text": {"pt-BR": "Sabre de luz", "en": "Lightsaber"}}, {"key": "c", "text": {"pt-BR": "Bastão elétrico", "en": "Electrostaff"}}, {"key": "d", "text": {"pt-BR": "Arco energético", "en": "Bowcaster"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'academia-jedi'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "Como se chama a estação capaz de destruir planetas?", "en": "What is the planet-destroying station called?"}', '[{"key": "a", "text": {"pt-BR": "Estrela da Morte", "en": "Death Star"}}, {"key": "b", "text": {"pt-BR": "Executor", "en": "Executor"}}, {"key": "c", "text": {"pt-BR": "Base Starkiller", "en": "Starkiller Base"}}, {"key": "d", "text": {"pt-BR": "Coruscant", "en": "Coruscant"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'star-wars' AND q.slug = 'academia-jedi'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'plantao-em-seattle', 'trivia', '{"pt-BR": "Plantão em Seattle", "en": "Shift in Seattle"}', '{"pt-BR": "Para quem acompanha cada cirurgia e cada drama.", "en": "For fans of every surgery and every drama."}', 'normal', 60, false, 20
  FROM public.universes WHERE slug = 'greys-anatomy'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Em qual cidade se passa a série?", "en": "Which city is the show set in?"}', '[{"key": "a", "text": {"pt-BR": "Boston", "en": "Boston"}}, {"key": "b", "text": {"pt-BR": "Seattle", "en": "Seattle"}}, {"key": "c", "text": {"pt-BR": "Chicago", "en": "Chicago"}}, {"key": "d", "text": {"pt-BR": "Nova York", "en": "New York"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'plantao-em-seattle'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Qual é o sobrenome da protagonista Meredith?", "en": "What is the protagonist Meredith''s last name?"}', '[{"key": "a", "text": {"pt-BR": "Yang", "en": "Yang"}}, {"key": "b", "text": {"pt-BR": "Grey", "en": "Grey"}}, {"key": "c", "text": {"pt-BR": "Bailey", "en": "Bailey"}}, {"key": "d", "text": {"pt-BR": "Shepherd", "en": "Shepherd"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'plantao-em-seattle'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Quem é chamado de \"McDreamy\"?", "en": "Who is called \"McDreamy\"?"}', '[{"key": "a", "text": {"pt-BR": "Mark Sloan", "en": "Mark Sloan"}}, {"key": "b", "text": {"pt-BR": "Derek Shepherd", "en": "Derek Shepherd"}}, {"key": "c", "text": {"pt-BR": "Alex Karev", "en": "Alex Karev"}}, {"key": "d", "text": {"pt-BR": "Owen Hunt", "en": "Owen Hunt"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'plantao-em-seattle'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Quem é chamado de \"McSteamy\"?", "en": "Who is called \"McSteamy\"?"}', '[{"key": "a", "text": {"pt-BR": "Mark Sloan", "en": "Mark Sloan"}}, {"key": "b", "text": {"pt-BR": "George O''Malley", "en": "George O''Malley"}}, {"key": "c", "text": {"pt-BR": "Jackson Avery", "en": "Jackson Avery"}}, {"key": "d", "text": {"pt-BR": "Richard Webber", "en": "Richard Webber"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'plantao-em-seattle'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Qual é a especialidade de Cristina Yang?", "en": "What is Cristina Yang''s specialty?"}', '[{"key": "a", "text": {"pt-BR": "Neurocirurgia", "en": "Neurosurgery"}}, {"key": "b", "text": {"pt-BR": "Pediatria", "en": "Pediatrics"}}, {"key": "c", "text": {"pt-BR": "Cardiotorácica", "en": "Cardiothoracic"}}, {"key": "d", "text": {"pt-BR": "Ortopedia", "en": "Orthopedics"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'plantao-em-seattle'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "Quem é a mãe de Meredith, uma cirurgiã renomada?", "en": "Who is Meredith''s mother, a renowned surgeon?"}', '[{"key": "a", "text": {"pt-BR": "Ellis Grey", "en": "Ellis Grey"}}, {"key": "b", "text": {"pt-BR": "Miranda Bailey", "en": "Miranda Bailey"}}, {"key": "c", "text": {"pt-BR": "Catherine Fox", "en": "Catherine Fox"}}, {"key": "d", "text": {"pt-BR": "Addison Montgomery", "en": "Addison Montgomery"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'greys-anatomy' AND q.slug = 'plantao-em-seattle'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'chamado-da-19', 'trivia', '{"pt-BR": "Chamado da 19", "en": "Station 19 call"}', '{"pt-BR": "Série, quartel e um pouco de prevenção de incêndios.", "en": "The show, the station and a bit of fire safety."}', 'normal', 60, false, 20
  FROM public.universes WHERE slug = 'station-19'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Em qual cidade fica o quartel 19?", "en": "Which city is Station 19 in?"}', '[{"key": "a", "text": {"pt-BR": "Seattle", "en": "Seattle"}}, {"key": "b", "text": {"pt-BR": "Portland", "en": "Portland"}}, {"key": "c", "text": {"pt-BR": "Chicago", "en": "Chicago"}}, {"key": "d", "text": {"pt-BR": "Los Angeles", "en": "Los Angeles"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'chamado-da-19'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "Station 19 é derivada de qual série?", "en": "Station 19 is a spin-off of which show?"}', '[{"key": "a", "text": {"pt-BR": "Chicago Fire", "en": "Chicago Fire"}}, {"key": "b", "text": {"pt-BR": "Grey''s Anatomy", "en": "Grey''s Anatomy"}}, {"key": "c", "text": {"pt-BR": "9-1-1", "en": "9-1-1"}}, {"key": "d", "text": {"pt-BR": "ER", "en": "ER"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'chamado-da-19'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Qual bombeira é a protagonista da série?", "en": "Which firefighter is the show''s protagonist?"}', '[{"key": "a", "text": {"pt-BR": "Maya Bishop", "en": "Maya Bishop"}}, {"key": "b", "text": {"pt-BR": "Andy Herrera", "en": "Andy Herrera"}}, {"key": "c", "text": {"pt-BR": "Vic Hughes", "en": "Vic Hughes"}}, {"key": "d", "text": {"pt-BR": "Carina DeLuca", "en": "Carina DeLuca"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'chamado-da-19'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Quem é o pai de Andy, capitão do quartel?", "en": "Who is Andy''s father, the station captain?"}', '[{"key": "a", "text": {"pt-BR": "Pruitt Herrera", "en": "Pruitt Herrera"}}, {"key": "b", "text": {"pt-BR": "Robert Sullivan", "en": "Robert Sullivan"}}, {"key": "c", "text": {"pt-BR": "Lucas Ripley", "en": "Lucas Ripley"}}, {"key": "d", "text": {"pt-BR": "Jack Gibson", "en": "Jack Gibson"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'chamado-da-19'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "No Brasil, qual é o número de emergência dos bombeiros?", "en": "In Brazil, what is the fire department''s emergency number?"}', '[{"key": "a", "text": {"pt-BR": "190", "en": "190"}}, {"key": "b", "text": {"pt-BR": "192", "en": "192"}}, {"key": "c", "text": {"pt-BR": "193", "en": "193"}}, {"key": "d", "text": {"pt-BR": "199", "en": "199"}}]', 'c', '{"pt-BR": "193 é o número do Corpo de Bombeiros no Brasil.", "en": "193 is the Fire Department number in Brazil."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'chamado-da-19'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "No Brasil, incêndios em equipamentos elétricos energizados são de qual classe?", "en": "In Brazil, fires in energized electrical equipment are which class?"}', '[{"key": "a", "text": {"pt-BR": "Classe A", "en": "Class A"}}, {"key": "b", "text": {"pt-BR": "Classe B", "en": "Class B"}}, {"key": "c", "text": {"pt-BR": "Classe C", "en": "Class C"}}, {"key": "d", "text": {"pt-BR": "Classe D", "en": "Class D"}}]', 'c', '{"pt-BR": "Classe C: nunca use água em equipamentos energizados.", "en": "Class C: never use water on energized equipment."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'station-19' AND q.slug = 'chamado-da-19'
ON CONFLICT (quiz_id, position) DO NOTHING;

INSERT INTO public.quizzes (universe_id, slug, kind, title, description, difficulty, xp_reward, sets_identity, sort_order)
SELECT id, 'conhecendo-o-bts', 'trivia', '{"pt-BR": "Conhecendo o BTS", "en": "Getting to know BTS"}', '{"pt-BR": "Perguntas sobre a trajetória do grupo — com respeito aos artistas.", "en": "Questions about the group''s journey — with respect for the artists."}', 'easy', 60, false, 20
  FROM public.universes WHERE slug = 'bts'
ON CONFLICT (universe_id, slug) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 1, '{"pt-BR": "Qual é o nome do fandom do BTS?", "en": "What is the BTS fandom called?"}', '[{"key": "a", "text": {"pt-BR": "BLINK", "en": "BLINK"}}, {"key": "b", "text": {"pt-BR": "ARMY", "en": "ARMY"}}, {"key": "c", "text": {"pt-BR": "ONCE", "en": "ONCE"}}, {"key": "d", "text": {"pt-BR": "CARAT", "en": "CARAT"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'conhecendo-o-bts'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 2, '{"pt-BR": "De qual país é o BTS?", "en": "Which country is BTS from?"}', '[{"key": "a", "text": {"pt-BR": "Japão", "en": "Japan"}}, {"key": "b", "text": {"pt-BR": "China", "en": "China"}}, {"key": "c", "text": {"pt-BR": "Coreia do Sul", "en": "South Korea"}}, {"key": "d", "text": {"pt-BR": "Tailândia", "en": "Thailand"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'conhecendo-o-bts'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 3, '{"pt-BR": "Quantos integrantes tem o grupo?", "en": "How many members does the group have?"}', '[{"key": "a", "text": {"pt-BR": "5", "en": "5"}}, {"key": "b", "text": {"pt-BR": "6", "en": "6"}}, {"key": "c", "text": {"pt-BR": "7", "en": "7"}}, {"key": "d", "text": {"pt-BR": "9", "en": "9"}}]', 'c', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'conhecendo-o-bts'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 4, '{"pt-BR": "Em que ano o BTS estreou?", "en": "In which year did BTS debut?"}', '[{"key": "a", "text": {"pt-BR": "2011", "en": "2011"}}, {"key": "b", "text": {"pt-BR": "2013", "en": "2013"}}, {"key": "c", "text": {"pt-BR": "2015", "en": "2015"}}, {"key": "d", "text": {"pt-BR": "2017", "en": "2017"}}]', 'b', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'conhecendo-o-bts'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 5, '{"pt-BR": "Qual foi o primeiro single do grupo totalmente em inglês, lançado em 2020?", "en": "What was the group''s first all-English single, released in 2020?"}', '[{"key": "a", "text": {"pt-BR": "Dynamite", "en": "Dynamite"}}, {"key": "b", "text": {"pt-BR": "Butter", "en": "Butter"}}, {"key": "c", "text": {"pt-BR": "Fake Love", "en": "Fake Love"}}, {"key": "d", "text": {"pt-BR": "Spring Day", "en": "Spring Day"}}]', 'a', NULL
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'conhecendo-o-bts'
ON CONFLICT (quiz_id, position) DO NOTHING;
INSERT INTO public.questions (quiz_id, position, prompt, options, correct_key, explanation)
SELECT q.id, 6, '{"pt-BR": "BTS é a sigla de qual nome em coreano?", "en": "BTS stands for which Korean name?"}', '[{"key": "a", "text": {"pt-BR": "Bangtan Sonyeondan", "en": "Bangtan Sonyeondan"}}, {"key": "b", "text": {"pt-BR": "Beyond The Scene", "en": "Beyond The Scene"}}, {"key": "c", "text": {"pt-BR": "Bulletproof Team Seoul", "en": "Bulletproof Team Seoul"}}, {"key": "d", "text": {"pt-BR": "Big Team Stars", "en": "Big Team Stars"}}]', 'a', '{"pt-BR": "Bangtan Sonyeondan; desde 2017 também \"Beyond The Scene\" em inglês.", "en": "Bangtan Sonyeondan; since 2017 also \"Beyond The Scene\" in English."}'
  FROM public.quizzes q JOIN public.universes u ON u.id = q.universe_id
 WHERE u.slug = 'bts' AND q.slug = 'conhecendo-o-bts'
ON CONFLICT (quiz_id, position) DO NOTHING;
