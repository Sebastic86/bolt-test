/*
  # Only admins or the night's starter may delete a game night

  Idempotent. Requires 20261003090000_match_nights.sql.

  Deleting a night cascades to its predictions and jokers (FK ON DELETE CASCADE)
  and unlinks its matches (matches.game_night_id ON DELETE SET NULL) — the
  matches themselves are kept unless the app deletes them first.
*/

DROP POLICY IF EXISTS "Members can delete game_nights" ON public.game_nights;
DROP POLICY IF EXISTS "Admins or starter can delete game_nights" ON public.game_nights;

CREATE POLICY "Admins or starter can delete game_nights"
  ON public.game_nights FOR DELETE TO authenticated
  USING (public.is_admin() OR (public.has_profile() AND started_by = auth.uid()));
