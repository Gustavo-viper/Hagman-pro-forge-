-- 0015 — Free Fandom Plus trial (once per account), detailed statistics and streak shields.

-- A trial is a subscription with provider 'trial': status 'cancelled' with the period end set
-- to the trial end, so it simply expires (no grace period) unless the user subscribes.
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_provider_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_provider_check CHECK (provider IN ('infinitepay', 'manual', 'mercadopago', 'stripe', 'trial'));

-- Plan benefits gain the new perks (kept identical to the seed for fresh databases).
UPDATE public.subscription_plans SET
  benefits = '{"pt-BR":["Tudo do Free","+20% de XP em quizzes, jogos e missões","Modo Sobrevivência em todos os universos","Sala VIP: fórum exclusivo de assinantes em cada universo","Missões Plus com recompensas maiores","Estatísticas detalhadas no seu painel","Proteção de sequência: 1 dia perdido por semana não quebra seu desafio diário","120 XP por dia no contra o relógio e 10 vitórias com XP na forca","Eventos exclusivos para assinantes","Selo Plus no seu nome em fóruns, chats e placares"],
               "en":["Everything in Free","+20% XP on quizzes, games and missions","Survival mode in every universe","VIP lounge: subscriber-only forum in every universe","Plus missions with bigger rewards","Detailed statistics on your dashboard","Streak shield: 1 missed day a week keeps your daily streak","120 XP a day in the speed round and 10 XP-earning hangman wins","Subscriber-only events","Plus badge next to your name in forums, chats and leaderboards"]}'
WHERE code = 'plus';
UPDATE public.subscription_plans SET
  benefits = '{"pt-BR":["Tudo do Fandom Plus","+50% de XP em quizzes, jogos e missões","Proteção de sequência: 2 dias perdidos por semana","200 XP por dia no contra o relógio e 20 vitórias com XP na forca","Missões Ultra lendárias","Eventos exclusivos Ultra","Selo Ultra dourado e nome em destaque"],
               "en":["Everything in Fandom Plus","+50% XP on quizzes, games and missions","Streak shield: 2 missed days a week","200 XP a day in the speed round and 20 XP-earning hangman wins","Legendary Ultra missions","Ultra-exclusive events","Golden Ultra badge and highlighted name"]}'
WHERE code = 'ultra';
