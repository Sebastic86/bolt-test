/*
  # Realtime for matches and match_players

  Idempotent — safe to run more than once.

  The app subscribes to postgres_changes on matches and match_players so other
  screens (TV mode, other phones) refetch when a match or score is saved. On
  self-hosted Supabase no table is in the supabase_realtime publication by
  default, and these two were never added, so Realtime refused the
  subscriptions ("Unable to subscribe to changes with given parameters") and
  TV mode never updated its table or latest results.
*/

DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['matches', 'match_players'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;
