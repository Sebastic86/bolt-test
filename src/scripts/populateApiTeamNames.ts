/**
 * Helper script to populate apiTeamName field for existing teams
 *
 * This script takes team names from the database and sets them as apiTeamName
 * so the logoService can search for them in TheSportsDB API.
 *
 * Run this script after applying the migration to add API fields.
 *
 * Usage:
 * 1. Make sure your Supabase client is configured
 * 2. Run: npm run populate-api-names (or add this to package.json scripts)
 * 3. Or import and call populateApiTeamNames() from your app
 */

import { supabase } from '../lib/supabaseClient';

/**
 * Normalize team names for API searches
 * Handles special characters, removes common abbreviations
 */
function normalizeTeamName(name: string): string {
  // Map of special characters to ASCII equivalents
  const specialCharMap: { [key: string]: string } = {
    'ü': 'u', 'ö': 'o', 'ä': 'a',
    'Ü': 'U', 'Ö': 'O', 'Ä': 'A',
    'ß': 'ss',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
    'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
    'á': 'a', 'à': 'a', 'â': 'a', 'å': 'a',
    'Á': 'A', 'À': 'A', 'Â': 'A', 'Å': 'A',
    'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
    'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
    'ó': 'o', 'ò': 'o', 'ô': 'o',
    'Ó': 'O', 'Ò': 'O', 'Ô': 'O',
    'ú': 'u', 'ù': 'u', 'û': 'u',
    'Ú': 'U', 'Ù': 'U', 'Û': 'U',
    'ñ': 'n', 'Ñ': 'N',
    'ç': 'c', 'Ç': 'C',
    'ø': 'o', 'Ø': 'O',
    'æ': 'ae', 'Æ': 'AE',
    'œ': 'oe', 'Œ': 'OE',
  };

  // Replace special characters
  let normalized = name;
  for (const [special, replacement] of Object.entries(specialCharMap)) {
    normalized = normalized.replace(new RegExp(special, 'g'), replacement);
  }

  // Remove common suffixes and clean up
  return normalized
    .replace(/\s*FC$/, '') // Remove trailing FC
    .replace(/\s*CF$/, '') // Remove trailing CF
    .replace(/\s*AFC$/, '') // Remove trailing AFC
    .replace(/\s*SC$/, '') // Remove trailing SC
    .replace(/\s*AC$/, '') // Remove trailing AC
    .replace(/\s*\d{4}$/, '') // Remove trailing years (e.g., "1909")
    .replace(/\s*&\s*/g, ' and ') // Replace & with 'and'
    .trim();
}

/**
 * Populate apiTeamName for all teams that don't have it yet
 */
export async function populateApiTeamNames(): Promise<void> {
  console.log('[populateApiTeamNames] Starting...');

  try {
    // Fetch all teams without apiTeamName
    const { data: teams, error: fetchError } = await supabase
      .from('teams')
      .select('id, name, apiTeamName')
      .is('apiTeamName', null);

    if (fetchError) {
      console.error('[populateApiTeamNames] Error fetching teams:', fetchError);
      return;
    }

    if (!teams || teams.length === 0) {
      console.log('[populateApiTeamNames] No teams to update');
      return;
    }

    console.log(`[populateApiTeamNames] Found ${teams.length} teams to update`);

    // Update each team
    let successCount = 0;
    let errorCount = 0;

    for (const team of teams) {
      const apiTeamName = normalizeTeamName(team.name);

      const { error: updateError } = await supabase
        .from('teams')
        .update({ apiTeamName })
        .eq('id', team.id);

      if (updateError) {
        console.error(`[populateApiTeamNames] Error updating team ${team.name}:`, updateError);
        errorCount++;
      } else {
        console.log(`[populateApiTeamNames] Updated: ${team.name} -> ${apiTeamName}`);
        successCount++;
      }
    }

    console.log(`[populateApiTeamNames] Complete! Success: ${successCount}, Errors: ${errorCount}`);
  } catch (error) {
    console.error('[populateApiTeamNames] Unexpected error:', error);
  }
}

/**
 * Manually set API team ID for a specific team
 * Useful when you know the exact TheSportsDB team ID
 */
export async function setTeamApiId(teamId: string, apiTeamId: string): Promise<void> {
  const { error } = await supabase
    .from('teams')
    .update({ apiTeamId })
    .eq('id', teamId);

  if (error) {
    console.error(`[setTeamApiId] Error updating team:`, error);
  } else {
    console.log(`[setTeamApiId] Successfully set API team ID: ${apiTeamId}`);
  }
}

/**
 * Test logo resolution for a team
 * Useful for debugging logo loading
 */
export async function testTeamLogo(teamName: string): Promise<void> {
  console.log(`[testTeamLogo] Testing logo for: ${teamName}`);

  const { data: team, error } = await supabase
    .from('teams')
    .select('*')
    .ilike('name', `%${teamName}%`)
    .limit(1)
    .single();

  if (error || !team) {
    console.error(`[testTeamLogo] Team not found:`, error);
    return;
  }

  console.log('[testTeamLogo] Team data:', {
    name: team.name,
    apiTeamId: team.apiTeamId,
    apiTeamName: team.apiTeamName,
    logoUrl: team.logoUrl
  });

  // Test API search
  try {
    const searchName = team.apiTeamName || team.name;
    const response = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(searchName)}`
    );
    const data = await response.json();

    if (data.teams && data.teams.length > 0) {
      console.log('[testTeamLogo] API Result:', {
        foundTeam: data.teams[0].strTeam,
        apiId: data.teams[0].idTeam,
        badge: data.teams[0].strBadge,
        logo: data.teams[0].strLogo
      });
    } else {
      console.log('[testTeamLogo] No results from API');
    }
  } catch (apiError) {
    console.error('[testTeamLogo] API Error:', apiError);
  }
}


