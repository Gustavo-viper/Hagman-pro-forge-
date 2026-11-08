-- 0014 — Fandom Premium perks: XP bonus, higher game limits, survival mode, premium
-- missions, VIP lounge and subscriber badges.

-- Effective plan of a user right now. MUST mirror `entitledPlan` in
-- apps/api/src/subscriptions/entitlements.service.ts (a test compares both).
CREATE OR REPLACE FUNCTION public.effective_plan(p_user uuid)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN s.status = 'active' AND (s.current_period_end IS NULL OR s.current_period_end > now()) THEN s.plan_code
      WHEN s.status = 'past_due' AND s.grace_until > now() THEN s.plan_code
      WHEN s.status = 'cancelled' AND s.current_period_end > now() THEN s.plan_code
      ELSE 'free' END
      FROM public.subscriptions s
     WHERE s.user_id = p_user AND s.status IN ('pending', 'active', 'past_due', 'cancelled')
     LIMIT 1), 'free')
$$;

-- Premium XP bonus granted on top of the base reward (kept apart: anti-farm caps use the base).
ALTER TABLE public.quiz_attempts ADD COLUMN xp_bonus integer NOT NULL DEFAULT 0 CHECK (xp_bonus >= 0);
ALTER TABLE public.game_sessions ADD COLUMN xp_bonus integer NOT NULL DEFAULT 0 CHECK (xp_bonus >= 0);

-- Survival mode (subscribers): answer until the first mistake.
ALTER TABLE public.game_sessions DROP CONSTRAINT game_sessions_game_check;
ALTER TABLE public.game_sessions ADD CONSTRAINT game_sessions_game_check CHECK (game IN ('daily', 'speed', 'hangman', 'survival'));

-- Missions reserved to a plan (claiming checks the plan on the server).
ALTER TABLE public.missions ADD COLUMN premium_plan text CHECK (premium_plan IN ('plus', 'ultra'));
ALTER TABLE public.missions DROP CONSTRAINT missions_objective_type_check;
ALTER TABLE public.missions ADD CONSTRAINT missions_objective_type_check CHECK (objective_type IN
  ('quiz_complete', 'quiz_perfect', 'forum_topic', 'forum_reply', 'identity_set', 'event_join',
   'hangman_win', 'daily_complete', 'daily_perfect', 'speed_score', 'survival_score'));

-- Plan benefits now describe exactly what each plan delivers.
UPDATE public.subscription_plans SET
  description = '{"pt-BR":"Tudo o que é essencial para viver a comunidade, para sempre gratuito.","en":"Everything essential to enjoy the community, free forever."}',
  benefits = '{"pt-BR":["Todos os universos, quizzes e trilhas sonoras","Desafio diário, contra o relógio e forca","Missões, rankings e placares","Comunidade, teorias e eventos gratuitos","60 XP por dia no contra o relógio e 5 vitórias com XP na forca"],
               "en":["Every universe, quiz and soundtrack","Daily challenge, speed round and hangman","Missions, rankings and leaderboards","Community, theories and free events","60 XP a day in the speed round and 5 XP-earning hangman wins"]}'
WHERE code = 'free';
UPDATE public.subscription_plans SET
  description = '{"pt-BR":"Evolua mais rápido e tenha acesso aos espaços de assinantes.","en":"Level up faster and get into the subscriber spaces."}',
  benefits = '{"pt-BR":["Tudo do Free","+20% de XP em quizzes, jogos e missões","Modo Sobrevivência em todos os universos","Sala VIP: fórum exclusivo de assinantes em cada universo","Missões Plus com recompensas maiores","120 XP por dia no contra o relógio e 10 vitórias com XP na forca","Eventos exclusivos para assinantes","Selo Plus no seu nome em fóruns, chats e placares"],
               "en":["Everything in Free","+20% XP on quizzes, games and missions","Survival mode in every universe","VIP lounge: subscriber-only forum in every universe","Plus missions with bigger rewards","120 XP a day in the speed round and 10 XP-earning hangman wins","Subscriber-only events","Plus badge next to your name in forums, chats and leaderboards"]}'
WHERE code = 'plus';
UPDATE public.subscription_plans SET
  description = '{"pt-BR":"A experiência máxima do Fandom Universe.","en":"The ultimate Fandom Universe experience."}',
  benefits = '{"pt-BR":["Tudo do Fandom Plus","+50% de XP em quizzes, jogos e missões","200 XP por dia no contra o relógio e 20 vitórias com XP na forca","Missões Ultra lendárias","Eventos exclusivos Ultra","Selo Ultra dourado e nome em destaque"],
               "en":["Everything in Fandom Plus","+50% XP on quizzes, games and missions","200 XP a day in the speed round and 20 XP-earning hangman wins","Legendary Ultra missions","Ultra-exclusive events","Golden Ultra badge and highlighted name"]}'
WHERE code = 'ultra';
