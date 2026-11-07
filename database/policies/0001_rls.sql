-- Row Level Security — re-applied (idempotently) after every migration run.
--
-- Model: the browser NEVER queries tables directly. All reads/writes go through the
-- NestJS API, which connects as the table owner and enforces authorization in code.
-- On Supabase, PostgREST exposes the public schema to the `anon` and `authenticated`
-- roles using the publishable key that ships in the web bundle. Enabling RLS on every
-- table and granting only explicit, read-only catalog policies guarantees that key
-- cannot read or modify private data even if someone calls PostgREST by hand.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> 'schema_migrations'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END
$$;

-- schema_migrations is internal: RLS on, no policies at all.
ALTER TABLE IF EXISTS public.schema_migrations ENABLE ROW LEVEL SECURITY;

-- Supabase roles and the auth schema only exist on Supabase (or `supabase start`).
-- Skip silently elsewhere (plain PostgreSQL in local development / CI).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN

    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

    -- Public catalogs: read-only, active rows only.
    GRANT SELECT ON public.universes, public.universe_settings,
                    public.subscription_plans, public.plan_prices TO anon, authenticated;

    DROP POLICY IF EXISTS universes_public_read ON public.universes;
    CREATE POLICY universes_public_read ON public.universes
      FOR SELECT TO anon, authenticated USING (status = 'active');

    DROP POLICY IF EXISTS universe_settings_public_read ON public.universe_settings;
    CREATE POLICY universe_settings_public_read ON public.universe_settings
      FOR SELECT TO anon, authenticated
      USING (EXISTS (SELECT 1 FROM public.universes u WHERE u.id = universe_id AND u.status = 'active'));

    DROP POLICY IF EXISTS subscription_plans_public_read ON public.subscription_plans;
    CREATE POLICY subscription_plans_public_read ON public.subscription_plans
      FOR SELECT TO anon, authenticated USING (is_active);

    DROP POLICY IF EXISTS plan_prices_public_read ON public.plan_prices;
    CREATE POLICY plan_prices_public_read ON public.plan_prices
      FOR SELECT TO anon, authenticated USING (is_active);

    -- Users may read their own profile through Supabase clients (e.g. realtime later).
    GRANT SELECT ON public.profiles TO authenticated;
    DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
    CREATE POLICY profiles_self_read ON public.profiles
      FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
  END IF;
END
$$;
