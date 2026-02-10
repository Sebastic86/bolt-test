/*
  # Allow avatar_url updates for players table

  This migration updates the RLS policies on the players table to allow
  authenticated users (admins) to update the avatar_url field.

  1. Changes
     - Drop existing restrictive update policy
     - Create new policy allowing authenticated users to update players
*/

-- Drop the existing restrictive update policy
DROP POLICY IF EXISTS "Allow users to update their own player info (Placeholder)" ON players;

-- Create a new policy that allows authenticated users to update player information
-- This is needed for admin users to update player names and avatars
CREATE POLICY "Allow authenticated users to update players"
  ON players
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
