/*
  # Add API Team Fields to Teams Table

  This migration adds fields to support external sports API integration (TheSportsDB)
  for dynamic logo loading and easier team management.

  1.  **Schema Changes:**
      - Adds `apiTeamId` (text, nullable) - External API identifier for the team
      - Adds `apiTeamName` (text, nullable) - Search name for API lookups
      - Keeps existing `logoUrl` as fallback for local logos

  2.  **Purpose:**
      - Enable dynamic logo loading from TheSportsDB API
      - Reduce bundle size by moving logos to external CDN
      - Simplify adding new teams (just need team name)
      - Maintain backward compatibility with local logos

  3.  **Usage:**
      - `apiTeamId`: Store the team ID from TheSportsDB (e.g., "133604" for Arsenal)
      - `apiTeamName`: Store searchable team name (e.g., "Arsenal", "Manchester City")
      - `logoUrl`: Fallback to local asset if API fails (optional)
*/

-- Add API integration fields
ALTER TABLE public.teams ADD COLUMN "apiTeamId" text;
ALTER TABLE public.teams ADD COLUMN "apiTeamName" text;

-- Add comments
COMMENT ON COLUMN public.teams."apiTeamId" IS 'External API team identifier (e.g., TheSportsDB team ID)';
COMMENT ON COLUMN public.teams."apiTeamName" IS 'Team name for API searches (e.g., "Arsenal", "Real Madrid")';

-- Create index on apiTeamId for faster lookups
CREATE INDEX idx_teams_api_team_id ON public.teams("apiTeamId") WHERE "apiTeamId" IS NOT NULL;
