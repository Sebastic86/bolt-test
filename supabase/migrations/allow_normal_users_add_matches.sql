/*
  # Allow normal users to add and delete their own matches

  1. Changes
     - Add `created_by` column to `matches` table (references auth.users)
     - Update INSERT policy so any authenticated user can insert matches (created_by must equal their uid)
     - Add DELETE policy so users can delete matches they created; admins can delete all
     - Update `match_players` INSERT policy to allow authenticated users to insert players for matches they created
*/

-- Add created_by column to matches table
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Drop old admin-only INSERT policy for matches
DROP POLICY IF EXISTS "Admins can insert matches" ON public.matches;

-- Allow any authenticated user to insert a match, but only if created_by = their uid
CREATE POLICY "Authenticated users can insert matches"
  ON public.matches
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Add DELETE policy: users can delete their own matches, admins can delete any
CREATE POLICY "Users can delete own matches or admins can delete all"
  ON public.matches
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by OR public.is_admin());

-- Drop old admin-only INSERT policy for match_players
DROP POLICY IF EXISTS "Admins can insert match players" ON public.match_players;

-- Allow authenticated users to insert match_players for matches they created, or admins for any
CREATE POLICY "Authenticated users can insert match players"
  ON public.match_players
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.matches
      WHERE id = match_id AND created_by = auth.uid()
    )
  );
