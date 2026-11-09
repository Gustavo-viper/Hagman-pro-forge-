-- Reference data: Fandom Premium plans and official BRL prices (amounts in cents).
-- International prices are NOT seeded on purpose: they must be configured explicitly per
-- currency (no invented conversion). provider/provider_price_id are filled in stage 10
-- once the payment provider credentials exist.

INSERT INTO public.subscription_plans (code, name, description, benefits, sort_order)
VALUES
  ('free',
   '{"pt-BR":"Free","en":"Free"}',
   '{"pt-BR":"Tudo o que é essencial para viver a comunidade, para sempre gratuito.","en":"Everything essential to enjoy the community, free forever."}',
   '{"pt-BR":["Todos os universos, quizzes e trilhas sonoras","Desafio diário, contra o relógio e forca","Missões, rankings e placares","Comunidade, teorias e eventos gratuitos","60 XP por dia no contra o relógio e 5 vitórias com XP na forca"],
     "en":["Every universe, quiz and soundtrack","Daily challenge, speed round and hangman","Missions, rankings and leaderboards","Community, theories and free events","60 XP a day in the speed round and 5 XP-earning hangman wins"]}',
   0),
  ('plus',
   '{"pt-BR":"Fandom Plus","en":"Fandom Plus"}',
   '{"pt-BR":"Evolua mais rápido e tenha acesso aos espaços de assinantes.","en":"Level up faster and get into the subscriber spaces."}',
   '{"pt-BR":["Tudo do Free","+20% de XP em quizzes, jogos e missões","Modo Sobrevivência em todos os universos","Sala VIP: fórum exclusivo de assinantes em cada universo","Missões Plus com recompensas maiores","Estatísticas detalhadas no seu painel","Proteção de sequência: 1 dia perdido por semana não quebra seu desafio diário","120 XP por dia no contra o relógio e 10 vitórias com XP na forca","Eventos exclusivos para assinantes","Selo Plus no seu nome em fóruns, chats e placares"],
     "en":["Everything in Free","+20% XP on quizzes, games and missions","Survival mode in every universe","VIP lounge: subscriber-only forum in every universe","Plus missions with bigger rewards","Detailed statistics on your dashboard","Streak shield: 1 missed day a week keeps your daily streak","120 XP a day in the speed round and 10 XP-earning hangman wins","Subscriber-only events","Plus badge next to your name in forums, chats and leaderboards"]}',
   10),
  ('ultra',
   '{"pt-BR":"Fandom Ultra","en":"Fandom Ultra"}',
   '{"pt-BR":"A experiência máxima do Fandom Universe.","en":"The ultimate Fandom Universe experience."}',
   '{"pt-BR":["Tudo do Fandom Plus","+50% de XP em quizzes, jogos e missões","Proteção de sequência: 2 dias perdidos por semana","200 XP por dia no contra o relógio e 20 vitórias com XP na forca","Missões Ultra lendárias","Eventos exclusivos Ultra","Selo Ultra dourado e nome em destaque"],
     "en":["Everything in Fandom Plus","+50% XP on quizzes, games and missions","Streak shield: 2 missed days a week","200 XP a day in the speed round and 20 XP-earning hangman wins","Legendary Ultra missions","Ultra-exclusive events","Golden Ultra badge and highlighted name"]}',
   20),
  ('vip',
   '{"pt-BR":"Fandom VIP","en":"Fandom VIP"}',
   '{"pt-BR":"Tudo do Ultra e acesso ao clube VIP de sorteios.","en":"Everything in Ultra plus the VIP prize-draw club."}',
   '{"pt-BR":["Tudo do Fandom Ultra","Número da sorte nos sorteios de chaves Steam (somente sorteios autorizados, com regulamento e certificado publicados)","Selo VIP exclusivo e nome em destaque","Eventos exclusivos VIP"],
     "en":["Everything in Fandom Ultra","A lucky number in the Steam key prize draws (authorized draws only, with published rules and certificate)","Exclusive VIP badge and highlighted name","VIP-exclusive events"]}',
   30)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.plan_prices (plan_code, billing_interval, currency, amount_minor)
VALUES
  ('free',  'month', 'BRL', 0),
  ('plus',  'month', 'BRL', 1490),
  ('plus',  'year',  'BRL', 14990),
  ('ultra', 'month', 'BRL', 2990),
  ('ultra', 'year',  'BRL', 29990),
  ('vip',   'month', 'BRL', 6990)
ON CONFLICT (plan_code, billing_interval, currency) DO NOTHING;
