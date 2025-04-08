/*
  # Create players table

  This migration creates the `players` table to store user/player information.

  1. New Tables
     - `players`
       - `id` (uuid, primary key, default: gen_random_uuid()): Unique identifier for the player.
       - `name` (text, not null, unique): The player's display name. Must be unique.
       - `created_at` (timestamptz, default: now()): Timestamp of when the player was created.

  2. Security
     - Enable RLS on the `players` table.
     - Add policy: Authenticated users can insert new players.
     - Add policy: Authenticated users can view all players.
     - Add policy: Authenticated users can update their own player record (future use).
     - Add policy: Authenticated users can delete their own player record (future use).
*/

-- 1. Create players table
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated users to insert players"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view all players"
  ON players
  FOR SELECT
  TO authenticated
  USING (true);

-- Add placeholder policies for future update/delete functionality if needed
-- For now, restrict updates/deletes or allow based on auth.uid() if players link to users
CREATE POLICY "Allow users to update their own player info (Placeholder)"
  ON players
  FOR UPDATE
  TO authenticated
  USING (false); -- Initially restrict direct updates, adjust if players map 1:1 to auth users

CREATE POLICY "Allow users to delete their own player info (Placeholder)"
  ON players
  FOR DELETE
  TO authenticated
  USING (false); -- Initially restrict direct deletes
