```sql
/*
  # Create match_players table

  This migration creates the `match_players` join table to link players
  to specific teams within a match.

  1. New Tables
     - `match_players`
       - `id` (uuid, primary key, default: gen_random_uuid()): Unique identifier for the link.
       - `match_id` (uuid, foreign key -> matches.id): The match the player participated in.
       - `player_id` (uuid, foreign key -> players.id): The player involved.
       - `team_number` (integer, not null, check: 1 or 2): Indicates which team (1 or 2 from the `matches` table) the player was on.
       - `created_at` (timestamptz, default: now()): Timestamp of when the record was created.

  2. Constraints
     - Unique constraint on (`match_id`, `player_id`) to prevent adding the same player twice to the same match.
     - Check constraint on `team_number` to ensure it's either 1 or 2.

  3. Indexes
     - Index on `match_id` for quickly finding players in a match.
     - Index on `player_id` for quickly finding matches a player participated in.

  4. Security
     - Enable RLS on the `match_players` table.
     - Add policy: Authenticated users can insert new player links for matches.
     - Add policy: Authenticated users can view all player links.
     - Add policy: Restrict updates and deletes for simplicity (usually links are added/removed, not modified).
*/

-- 1. Create match_players table
CREATE TABLE IF NOT EXISTS match_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE, -- If match is deleted, remove player links
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE, -- If player is deleted, remove their links
  team_number integer NOT NULL CHECK (team_number IN (1, 2)),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Constraints
ALTER TABLE match_players
  ADD CONSTRAINT unique_player_in_match UNIQUE (match_id, player_id);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_match_players_match_id ON match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_player_id ON match_players(player_id);

-- 4. Security
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated users to insert match players"
  ON match_players
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view match players"
  ON match_players
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Disallow updating match players"
  ON match_players
  FOR UPDATE
  TO authenticated
  USING (false); -- Prevent updates

CREATE POLICY "Disallow deleting match players directly"
  ON match_players
  FOR DELETE
  TO authenticated
  USING (false); -- Prevent direct deletion (use CASCADE from matches/players)
```