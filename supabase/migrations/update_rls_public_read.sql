```sql
/*
  # Update RLS Policies for Public Read Access

  This migration updates the Row Level Security (RLS) policies for the
  `players`, `matches`, and `match_players` tables to allow public read access.

  1. Changes
     - Drops existing SELECT policies restricted to `authenticated` users.
     - Adds new SELECT policies allowing `anon` (public) users to read data.

  2. Security Considerations
     - This makes player names, match details (teams, scores, timestamps),
       and player assignments within matches publicly readable by anyone
       with the Supabase anon key.
     - INSERT, UPDATE, DELETE policies remain restricted to `authenticated` users
       (or disallowed as previously configured).
*/

-- 1. Update 'players' table RLS for public SELECT
-- Drop the old policy if it exists
DROP POLICY IF EXISTS "Allow authenticated users to view all players" ON public.players;
-- Create the new public read policy
CREATE POLICY "Allow public read access to players"
  ON public.players
  FOR SELECT
  TO anon -- Allow anonymous access
  USING (true);


-- 2. Update 'matches' table RLS for public SELECT
-- Drop the old policy if it exists
DROP POLICY IF EXISTS "Allow authenticated users to view all matches" ON public.matches;
-- Create the new public read policy
CREATE POLICY "Allow public read access to matches"
  ON public.matches
  FOR SELECT
  TO anon -- Allow anonymous access
  USING (true);


-- 3. Update 'match_players' table RLS for public SELECT
-- Drop the old policy if it exists
DROP POLICY IF EXISTS "Allow authenticated users to view match players" ON public.match_players;
-- Create the new public read policy
CREATE POLICY "Allow public read access to match players"
  ON public.match_players
  FOR SELECT
  TO anon -- Allow anonymous access
  USING (true);

```