/*
  # Add penalties_winner column to matches table

  This migration adds a `penalties_winner` column to the `matches` table to store which team won on penalties
  when a match ends in a draw.

  1. Changes
     - Add `penalties_winner` column (smallint, nullable): 1 for team1, 2 for team2, null if no penalties.
     - Add check constraint to ensure penalties_winner is either 1 or 2 when not null.
*/

-- Add penalties_winner column to matches table
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS penalties_winner smallint NULL;

-- Add check constraint to ensure penalties_winner is either 1 or 2 when not null
ALTER TABLE matches
ADD CONSTRAINT check_penalties_winner_valid CHECK (penalties_winner IS NULL OR penalties_winner IN (1, 2));