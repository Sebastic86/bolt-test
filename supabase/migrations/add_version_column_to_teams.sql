/*
  # Add version column to teams table

  This migration adds a version column to the teams table to track different game versions.

  1. **Schema Changes:**
     - Add `version` column to the `teams` table as text, not null, with default value 'FC25'
     - Add comment to the new column for clarity

  2. **Data Update:**
     - Update all existing rows to have version 'FC25'

  3. **Constraints:**
     - The version column is required (NOT NULL) with a default value
*/

-- Add version column to teams table
ALTER TABLE public.teams 
ADD COLUMN version text NOT NULL DEFAULT 'FC25';

-- Add comment to the new column
COMMENT ON COLUMN public.teams.version IS 'Version identifier for the team (e.g., FC25, FC26)';

-- Update all existing rows to have version 'FC25' (this is redundant due to the default, but explicit)
UPDATE public.teams SET version = 'FC25' WHERE version IS NULL;