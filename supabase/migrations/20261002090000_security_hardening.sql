/*
  # Security hardening

  Idempotent — safe to run more than once. Written to work against the live
  database even where it has drifted from the older migration files.

  1. Remove `create_admin_profile(text)`: SECURITY DEFINER with no admin check and
     executable by anon/authenticated → anyone could promote any account to admin.
  2. Pin `search_path` on SECURITY DEFINER / trigger functions.
  3. Add `has_profile()`; require a user_profiles row (admin or normal) to create /
     edit / delete matches, so self-registered accounts without a role can't write.
  4. `players`: drop every existing write policy (incl. the `USING (true)` update
     policies) and recreate admin-only insert/update; reads stay public.
  5. Storage `avatars` + `team-logos`: public read, admin-only write/delete.

  To bootstrap an admin from now on, run as the database owner in SQL editor:
    INSERT INTO public.user_profiles (id, role)
    SELECT id, 'admin' FROM auth.users WHERE email = 'you@example.com'
    ON CONFLICT (id) DO UPDATE SET role = 'admin';
*/

-- 1. Remove the privilege-escalation function -------------------------------
DROP FUNCTION IF EXISTS public.create_admin_profile(text);

-- 2. Role helpers with a pinned search_path ---------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_profile()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = auth.uid()
  );
$$;

-- Left executable by anon on purpose: both return false without a session, and
-- policies evaluated for anon may reference them.
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_profile() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- 3. Matches: only users with a role may write ------------------------------
DROP POLICY IF EXISTS "Admins can insert matches" ON public.matches;
DROP POLICY IF EXISTS "Admins can update matches" ON public.matches;
DROP POLICY IF EXISTS "Authenticated users can insert matches" ON public.matches;
DROP POLICY IF EXISTS "Users can update own matches or admins can update all" ON public.matches;
DROP POLICY IF EXISTS "Users can delete own matches or admins can delete all" ON public.matches;

CREATE POLICY "Members can insert own matches"
  ON public.matches FOR INSERT TO authenticated
  WITH CHECK (public.has_profile() AND auth.uid() = created_by);

CREATE POLICY "Owners or admins can update matches"
  ON public.matches FOR UPDATE TO authenticated
  USING (public.is_admin() OR (public.has_profile() AND auth.uid() = created_by))
  WITH CHECK (public.is_admin() OR (public.has_profile() AND auth.uid() = created_by));

CREATE POLICY "Owners or admins can delete matches"
  ON public.matches FOR DELETE TO authenticated
  USING (public.is_admin() OR (public.has_profile() AND auth.uid() = created_by));

-- 4. Players: reset all policies, admin-only writes -------------------------
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'players'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.players', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read players"
  ON public.players FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert players"
  ON public.players FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update players"
  ON public.players FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete players"
  ON public.players FOR DELETE TO authenticated
  USING (public.is_admin());

-- 5. Storage: public read, admin-only write for avatars + team-logos --------
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true), ('team-logos', 'team-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'storage' AND tablename = 'objects'
               AND (coalesce(qual, '') || coalesce(with_check, '')) ~ '(avatars|team-logos)'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Public read avatars and team logos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id IN ('avatars', 'team-logos'));

CREATE POLICY "Admins upload avatars and team logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('avatars', 'team-logos') AND public.is_admin());

CREATE POLICY "Admins update avatars and team logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('avatars', 'team-logos') AND public.is_admin())
  WITH CHECK (bucket_id IN ('avatars', 'team-logos') AND public.is_admin());

CREATE POLICY "Admins delete avatars and team logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('avatars', 'team-logos') AND public.is_admin());
