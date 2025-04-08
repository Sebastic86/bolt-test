/*
  # Create matches table

  This migration creates the `matches` table to store records of played matches.

  1. New Tables
     - `matches`
       - `id` (uuid, primary key, default: gen_random_uuid()): Unique identifier for the match.
       - `team1_id` (uuid, foreign key -> teams.id): ID of the first team.
       - `team2_id` (uuid, foreign key -> teams.id): ID of the second team.
       - `team1_score` (integer, nullable): Score for team 1. Null until result is added.
       - `team2_score` (integer, nullable): Score for team 2. Null until result is added.
       - `played_at` (timestamptz, default: now()): Timestamp of when the match was recorded/played.
       - `created_at` (timestamptz, default: now()): Timestamp of when the record was created.

  2. Indexes
     - Index on `played_at` for efficient querying by date.

  3. Security
     - Enable RLS on the `matches` table.
     - Add policy: Authenticated users can insert new matches.
     - Add policy: Authenticated users can view all matches.
     - Add policy: Authenticated users can update match scores (e.g., add results).
     - Add policy: Restrict deletion of matches (generally not desired).
*/

-- 1. Create matches table
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team1_id uuid NOT NULL REFERENCES teams(id) ON DELETE RESTRICT, -- Prevent deleting team if in match
  team2_id uuid NOT NULL REFERENCES teams(id) ON DELETE RESTRICT, -- Prevent deleting team if in match
  team1_score integer NULL,
  team2_score integer NULL,
  played_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT check_scores_non_negative CHECK (team1_score IS NULL OR team1_score >= 0),
  CONSTRAINT check_scores_non_negative_t2 CHECK (team2_score IS NULL OR team2_score >= 0)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_matches_played_at ON matches(played_at);

-- 3. Security
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated users to insert matches"
  ON matches
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view all matches"
  ON matches
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to update match scores"
  ON matches
  FOR UPDATE
  TO authenticated
  USING (true) -- Allow updating any match record (e.g., adding scores)
  WITH CHECK (true); -- Allow any update for now, could restrict columns later

CREATE POLICY "Disallow deleting matches"
  ON matches
  FOR DELETE
  TO authenticated
  USING (false); -- Prevent deletion
