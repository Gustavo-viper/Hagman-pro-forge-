-- Reference data: Fandom Premium plans and official BRL prices (amounts in cents).
-- International prices are NOT seeded on purpose: they must be configured explicitly per
-- currency (no invented conversion). provider/provider_price_id are filled in stage 10
-- once the payment provider credentials exist.

INSERT INTO public.subscription_plans (code, name, description, benefits, sort_order)
VALUES
  ('free',
   '{"pt-BR":"Free","en":"Free"}',
   '{"pt-BR":"Tudo o que é essencial para viver a comunidade, para sempre gratuito.","en":"Everything essential to enjoy the community, free forever."}',
   '{"pt-BR":["Criar conta e perfil","Participar das comunidades públicas","Publicar conteúdos e comentar","Quizzes gratuitos","Ganhar XP","Rankings públicos","Eventos gratuitos","Adicionar amigos e seguir usuários"],
     "en":["Create an account and profile","Join public communities","Post and comment","Free quizzes","Earn XP","Public rankings","Free events","Add friends and follow users"]}',
   0),
  ('plus',
   '{"pt-BR":"Fandom Plus","en":"Fandom Plus"}',
   '{"pt-BR":"Mais identidade e acesso a espaços especiais da comunidade.","en":"More identity and access to special community spaces."}',
   '{"pt-BR":["Todos os recursos do Free","Emblemas exclusivos de assinante","Molduras especiais de perfil","Temas personalizados","Personalização avançada do perfil","Estatísticas detalhadas","Grupos exclusivos de assinantes","Eventos especiais selecionados","Missões especiais","Personalizações adicionais de identidade","Selo Fandom Plus no perfil"],
     "en":["Everything in Free","Exclusive subscriber badges","Special profile frames","Custom themes","Advanced profile customization","Detailed statistics","Subscriber-only groups","Selected special events","Special missions","Extra identity customization","Fandom Plus seal on your profile"]}',
   10),
  ('ultra',
   '{"pt-BR":"Fandom Ultra","en":"Fandom Ultra"}',
   '{"pt-BR":"A experiência máxima do Fandom Universe.","en":"The ultimate Fandom Universe experience."}',
   '{"pt-BR":["Todos os recursos do Fandom Plus","Identidade visual Ultra","Emblemas Ultra","Molduras premium animadas","Comunidades Ultra","Eventos exclusivos Ultra","Salas especiais de discussão","Estatísticas avançadas","Itens digitais especiais","Títulos exclusivos","Acesso antecipado a funcionalidades selecionadas"],
     "en":["Everything in Fandom Plus","Ultra visual identity","Ultra badges","Animated premium frames","Ultra communities","Ultra-exclusive events","Special discussion rooms","Advanced statistics","Special digital items","Exclusive titles","Early access to selected features"]}',
   20)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.plan_prices (plan_code, billing_interval, currency, amount_minor)
VALUES
  ('free',  'month', 'BRL', 0),
  ('plus',  'month', 'BRL', 1490),
  ('plus',  'year',  'BRL', 14990),
  ('ultra', 'month', 'BRL', 2990),
  ('ultra', 'year',  'BRL', 29990)
ON CONFLICT (plan_code, billing_interval, currency) DO NOTHING;
