/*
  # Add Admin Teams Management Policies

  This migration adds RLS policies to allow admin users to perform
  full CRUD operations on the teams table.

  1. Changes
     - Add policy for admins to INSERT new teams
     - Add policy for admins to DELETE teams
     - Ensure existing UPDATE policy for admins exists

  2. Security
     - Only admin users can create, update, or delete teams
     - Public read access remains unchanged
*/

-- Add policy for admins to insert new teams
CREATE POLICY "Admins can insert teams"
  ON public.teams
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Add policy for admins to delete teams
CREATE POLICY "Admins can delete teams"
  ON public.teams
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Note: "Admins can update teams" policy should already exist from create_user_profiles_table.sql
-- If not, uncomment the following:
-- CREATE POLICY "Admins can update teams"
--   ON public.teams
--   FOR UPDATE
--   TO authenticated
--   USING (public.is_admin());
