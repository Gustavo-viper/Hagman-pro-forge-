-- Row Level Security — re-applied (idempotently) after every migration run.
--
-- Model: the browser NEVER talks to the database. PostgreSQL runs on Railway's private
-- network and only the NestJS API / worker connect, as the table owner, enforcing
-- authorization in code. RLS is enabled on every table with no policies as defense in
-- depth: any additional, non-owner database role gets no rows unless a policy is added.

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
