/*
  # Create teams table and enable RLS

  This migration sets up the initial `teams` table to store football team data.

  1.  **New Table:**
      - `teams`: Stores information about each football team.
          - `id` (uuid, primary key): Unique identifier for the team (auto-generated).
          - `name` (text, not null): The official name of the team.
          - `league` (text, not null): The league the team plays in.
          - `rating` (float4, not null): The star rating of the team (e.g., 4.5).
          - `logoIconName` (text, not null): The name of the Lucide icon used for the logo.
          - `overallRating` (int2, not null): The overall rating score (0-99).
          - `attackRating` (int2, not null): The attack rating score (0-99).
          - `midfieldRating` (int2, not null): The midfield rating score (0-99).
          - `defendRating` (int2, not null): The defense rating score (0-99).
          - `created_at` (timestamptz, default now()): Timestamp of when the record was created.

  2.  **Security:**
      - Row Level Security (RLS) is enabled for the `teams` table.
      - A policy `Allow public read access` is created to allow anyone (authenticated or not) to read data from the `teams` table. This is suitable for the current public-facing nature of the app.

  3.  **Indexes:**
      - A primary key index is automatically created on the `id` column.
*/

-- Create the teams table
CREATE TABLE IF NOT EXISTS public.teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    league text NOT NULL,
    rating real NOT NULL CHECK (rating >= 0 and rating <= 5), -- Using real for floating point, added check
    "logoIconName" text NOT NULL, -- Quoted because of camelCase
    "overallRating" smallint NOT NULL CHECK ("overallRating" >= 0 and "overallRating" <= 99), -- Using smallint, added check
    "attackRating" smallint NOT NULL CHECK ("attackRating" >= 0 and "attackRating" <= 99), -- Using smallint, added check
    "midfieldRating" smallint NOT NULL CHECK ("midfieldRating" >= 0 and "midfieldRating" <= 99), -- Using smallint, added check
    "defendRating" smallint NOT NULL CHECK ("defendRating" >= 0 and "defendRating" <= 99), -- Using smallint, added check
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Add comments to columns for clarity
COMMENT ON COLUMN public.teams.id IS 'Unique identifier for the team';
COMMENT ON COLUMN public.teams.name IS 'The official name of the team';
COMMENT ON COLUMN public.teams.league IS 'The league the team plays in';
COMMENT ON COLUMN public.teams.rating IS 'The star rating of the team (0.0 to 5.0)';
COMMENT ON COLUMN public.teams."logoIconName" IS 'The name of the Lucide icon used for the logo';
COMMENT ON COLUMN public.teams."overallRating" IS 'The overall rating score (0-99)';
COMMENT ON COLUMN public.teams."attackRating" IS 'The attack rating score (0-99)';
COMMENT ON COLUMN public.teams."midfieldRating" IS 'The midfield rating score (0-99)';
COMMENT ON COLUMN public.teams."defendRating" IS 'The defense rating score (0-99)';
COMMENT ON COLUMN public.teams.created_at IS 'Timestamp of when the record was created';


-- Enable Row Level Security
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access"
    ON public.teams
    FOR SELECT
    USING (true); -- Allows read access to everyone