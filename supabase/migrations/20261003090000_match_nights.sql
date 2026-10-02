/*
  # Match nights: game nights, jokers, predictions

  Idempotent — safe to run more than once. Requires 20261002090000_security_hardening.sql
  (uses public.has_profile() / public.is_admin()).

  1. game_nights — at most one active night (ended_at IS NULL), enforced by a unique index.
  2. matches.game_night_id — filled automatically by a BEFORE INSERT trigger with the
     active night, so no client has to pass it.
  3. predictions — a player's pick (1 or 2) for a matchup during a night. Linked to the
     match automatically by an AFTER INSERT trigger on matches when that matchup is saved.
  4. night_jokers — one row per joker a player spends during a night.
  5. RLS: public read (like matches/players), writes for users with a role.
  6. Realtime publication for the new tables.

  Jokers and predictions belong to *players* (the players table), not to auth users —
  several people share one phone.
*/

-- 1. game_nights -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_nights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  started_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  version text,
  jokers_per_player smallint NOT NULL DEFAULT 1 CHECK (jokers_per_player BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS game_nights_one_active_idx
  ON public.game_nights ((true)) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS game_nights_started_at_idx ON public.game_nights (started_at DESC);

-- 2. matches.game_night_id ---------------------------------------------------
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS game_night_id uuid REFERENCES public.game_nights(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS matches_game_night_id_idx ON public.matches (game_night_id);

CREATE OR REPLACE FUNCTION public.set_match_game_night()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.game_night_id IS NULL THEN
    SELECT id INTO NEW.game_night_id
    FROM public.game_nights
    WHERE ended_at IS NULL
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_match_game_night ON public.matches;
CREATE TRIGGER set_match_game_night
  BEFORE INSERT ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.set_match_game_night();

-- 3. predictions -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_night_id uuid NOT NULL REFERENCES public.game_nights(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team1_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  team2_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  predicted_winner smallint NOT NULL CHECK (predicted_winner IN (1, 2)),
  -- Optional exact-score guess (bonus points). Everyone at the table usually plays,
  -- so the score guess is what makes predicting your own match interesting.
  predicted_team1_score smallint CHECK (predicted_team1_score BETWEEN 0 AND 30),
  predicted_team2_score smallint CHECK (predicted_team2_score BETWEEN 0 AND 30),
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((predicted_team1_score IS NULL) = (predicted_team2_score IS NULL))
);

-- One open pick per player per matchup; changing a pick replaces it.
CREATE UNIQUE INDEX IF NOT EXISTS predictions_one_open_pick_idx
  ON public.predictions (game_night_id, player_id, team1_id, team2_id)
  WHERE match_id IS NULL;
CREATE INDEX IF NOT EXISTS predictions_game_night_id_idx ON public.predictions (game_night_id);
CREATE INDEX IF NOT EXISTS predictions_match_id_idx ON public.predictions (match_id);

CREATE OR REPLACE FUNCTION public.link_predictions_to_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.game_night_id IS NOT NULL THEN
    UPDATE public.predictions
    SET match_id = NEW.id
    WHERE game_night_id = NEW.game_night_id
      AND team1_id = NEW.team1_id
      AND team2_id = NEW.team2_id
      AND match_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS link_predictions_to_match ON public.matches;
CREATE TRIGGER link_predictions_to_match
  AFTER INSERT ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.link_predictions_to_match();

-- 4. night_jokers ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.night_jokers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_night_id uuid NOT NULL REFERENCES public.game_nights(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  replaced_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  chosen_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid()
);
CREATE INDEX IF NOT EXISTS night_jokers_game_night_id_idx ON public.night_jokers (game_night_id);

-- 5. RLS ---------------------------------------------------------------------
ALTER TABLE public.game_nights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.night_jokers ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY['game_nights', 'predictions', 'night_jokers'] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format('CREATE POLICY "Anyone can read %1$s" ON public.%1$I FOR SELECT TO anon, authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Members can insert %1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (public.has_profile())', t);
    EXECUTE format('CREATE POLICY "Members can update %1$s" ON public.%1$I FOR UPDATE TO authenticated USING (public.has_profile()) WITH CHECK (public.has_profile())', t);
    EXECUTE format('CREATE POLICY "Members can delete %1$s" ON public.%1$I FOR DELETE TO authenticated USING (public.has_profile())', t);
  END LOOP;
END $$;

-- 6. Realtime ----------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['game_nights', 'predictions', 'night_jokers'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;
