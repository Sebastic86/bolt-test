/**
 * API-Sports client — a paid/free-tier (100 requests/day) team-lookup API
 * used as the primary logo source. Calls go through the `api-sports-logo`
 * Edge Function so the API key never ships in the browser bundle
 * (see supabase/functions/api-sports-logo).
 */
import { supabase } from '../lib/supabaseClient';

async function invokeLogoFunction(body: { teamId: string } | { teamName: string }): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke<{ logoUrl: string | null }>('api-sports-logo', { body });
  if (error) throw error;
  return data?.logoUrl ?? null;
}

/**
 * Resolve a team's crest via API-Sports. The Edge Function persists the result
 * to teams.resolvedLogoUrl itself, so each team costs at most one API call.
 */
export async function resolveTeamLogoFromApiSports(teamId: string): Promise<string | null> {
  try {
    return await invokeLogoFunction({ teamId });
  } catch (error) {
    console.error('[apiSportsService] Error resolving team logo:', error);
    return null;
  }
}

/** Raw search by team name (admins only — nothing is saved). */
export async function fetchTeamLogoFromApiSports(teamName: string): Promise<string | null> {
  try {
    return await invokeLogoFunction({ teamName });
  } catch (error) {
    console.error('[apiSportsService] Error fetching team logo by name:', error);
    return null;
  }
}
