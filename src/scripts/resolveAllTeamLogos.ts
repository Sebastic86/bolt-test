/**
 * Bulk Logo Resolution Script
 *
 * This script fetches and saves logo URLs for all teams in the database.
 * Run this once after applying the resolvedLogoUrl migration to populate existing teams.
 *
 * Usage:
 * 1. Import and call from your app: `import { resolveAllTeamLogos } from './scripts/resolveAllTeamLogos'`
 * 2. Call the function: `await resolveAllTeamLogos()`
 * 3. Or create a button in admin panel to trigger it
 *
 * The script will:
 * - Fetch all teams from database
 * - For each team, try to find logo via API
 * - Save resolved URL back to database
 * - Skip teams that already have resolvedLogoUrl
 */

import { supabase } from '../lib/supabaseClient';

const THESPORTSDB_API_BASE = 'https://www.thesportsdb.com/api/v1/json/3';

/**
 * Normalize team name for API searches
 */
function normalizeForAPI(name: string): string {
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

  let normalized = name;
  for (const [special, replacement] of Object.entries(specialCharMap)) {
    normalized = normalized.replace(new RegExp(special, 'g'), replacement);
  }

  return normalized.trim();
}

/**
 * Fetch logo URL from API by team ID
 */
async function fetchLogoByApiId(apiTeamId: string): Promise<string | null> {
  try {
    const response = await fetch(`${THESPORTSDB_API_BASE}/lookupteam.php?id=${apiTeamId}`);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.teams && data.teams.length > 0) {
      return data.teams[0].strBadge || data.teams[0].strLogo || null;
    }
    return null;
  } catch (error) {
    console.error(`[resolveAllTeamLogos] Error fetching by ID ${apiTeamId}:`, error);
    return null;
  }
}

/**
 * Fetch logo URL from API by team name
 */
async function fetchLogoByTeamName(teamName: string): Promise<string | null> {
  try {
    // Try original name first
    let response = await fetch(
      `${THESPORTSDB_API_BASE}/searchteams.php?t=${encodeURIComponent(teamName)}`
    );
    if (!response.ok) return null;

    let data = await response.json();
    if (data.teams && data.teams.length > 0) {
      return data.teams[0].strBadge || data.teams[0].strLogo || null;
    }

    // Try normalized name
    const normalizedName = normalizeForAPI(teamName);
    if (normalizedName !== teamName) {
      response = await fetch(
        `${THESPORTSDB_API_BASE}/searchteams.php?t=${encodeURIComponent(normalizedName)}`
      );
      if (!response.ok) return null;

      data = await response.json();
      if (data.teams && data.teams.length > 0) {
        return data.teams[0].strBadge || data.teams[0].strLogo || null;
      }
    }

    return null;
  } catch (error) {
    console.error(`[resolveAllTeamLogos] Error fetching by name "${teamName}":`, error);
    return null;
  }
}

/**
 * Resolve and save logos for all teams
 * @param forceUpdate - If true, re-resolve even teams that already have resolvedLogoUrl
 * @param delayMs - Delay between API calls to avoid rate limiting (default: 500ms)
 */
export async function resolveAllTeamLogos(
  forceUpdate = false,
  delayMs = 1500
): Promise<{ success: number; failed: number; skipped: number }> {
  console.log('[resolveAllTeamLogos] Starting bulk logo resolution...');

  const stats = { success: 0, failed: 0, skipped: 0 };

  try {
    // Fetch all teams
    const query = supabase
      .from('teams')
      .select('id, name, apiTeamId, apiTeamName, resolvedLogoUrl');

    const { data: teams, error: fetchError } = await query;

    if (fetchError) {
      console.error('[resolveAllTeamLogos] Error fetching teams:', fetchError);
      return stats;
    }

    if (!teams || teams.length === 0) {
      console.log('[resolveAllTeamLogos] No teams found');
      return stats;
    }

    console.log(`[resolveAllTeamLogos] Found ${teams.length} teams`);

    for (const team of teams) {
      // Skip if already resolved (unless forceUpdate)
      if (team.resolvedLogoUrl && !forceUpdate) {
        console.log(`[resolveAllTeamLogos] Skipping ${team.name} (already resolved)`);
        stats.skipped++;
        continue;
      }

      console.log(`[resolveAllTeamLogos] Resolving logo for: ${team.name}`);

      let logoUrl: string | null = null;

      // Try by API ID first
      if (team.apiTeamId) {
        logoUrl = await fetchLogoByApiId(team.apiTeamId);
        if (logoUrl) {
          console.log(`  ✅ Found via API ID: ${logoUrl.substring(0, 50)}...`);
        }
      }

      // Try by team name if ID didn't work
      if (!logoUrl && team.apiTeamName) {
        logoUrl = await fetchLogoByTeamName(team.apiTeamName);
        if (logoUrl) {
          console.log(`  ✅ Found via team name: ${logoUrl.substring(0, 50)}...`);
        }
      }

      // Try by regular name if nothing else worked
      if (!logoUrl) {
        logoUrl = await fetchLogoByTeamName(team.name);
        if (logoUrl) {
          console.log(`  ✅ Found via name search: ${logoUrl.substring(0, 50)}...`);
        }
      }

      // Save to database if found
      if (logoUrl) {
        const { error: updateError } = await supabase
          .from('teams')
          .update({ resolvedLogoUrl: logoUrl })
          .eq('id', team.id);

        if (updateError) {
          console.error(`  ❌ Error saving logo for ${team.name}:`, updateError);
          stats.failed++;
        } else {
          console.log(`  💾 Saved to database`);
          stats.success++;
        }
      } else {
        console.log(`  ⚠️  No logo found for ${team.name}`);
        stats.failed++;
      }

      // Delay to avoid rate limiting
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log('[resolveAllTeamLogos] Complete!');
    console.log(`  Success: ${stats.success}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`  Skipped: ${stats.skipped}`);

    return stats;
  } catch (error) {
    console.error('[resolveAllTeamLogos] Unexpected error:', error);
    return stats;
  }
}

/**
 * Resolve logo for a single team
 */
export async function resolveTeamLogo(teamId: string): Promise<boolean> {
  console.log(`[resolveTeamLogo] Resolving logo for team ${teamId}`);

  try {
    // Fetch team
    const { data: team, error: fetchError } = await supabase
      .from('teams')
      .select('id, name, apiTeamId, apiTeamName')
      .eq('id', teamId)
      .single();

    if (fetchError || !team) {
      console.error('[resolveTeamLogo] Team not found:', fetchError);
      return false;
    }

    let logoUrl: string | null = null;

    // Try by API ID
    if (team.apiTeamId) {
      logoUrl = await fetchLogoByApiId(team.apiTeamId);
    }

    // Try by team name
    if (!logoUrl && team.apiTeamName) {
      logoUrl = await fetchLogoByTeamName(team.apiTeamName);
    }

    // Try by regular name
    if (!logoUrl) {
      logoUrl = await fetchLogoByTeamName(team.name);
    }

    if (logoUrl) {
      const { error: updateError } = await supabase
        .from('teams')
        .update({ resolvedLogoUrl: logoUrl })
        .eq('id', teamId);

      if (updateError) {
        console.error('[resolveTeamLogo] Error saving:', updateError);
        return false;
      }

      console.log(`[resolveTeamLogo] Success! Saved: ${logoUrl}`);
      return true;
    }

    console.log('[resolveTeamLogo] No logo found');
    return false;
  } catch (error) {
    console.error('[resolveTeamLogo] Unexpected error:', error);
    return false;
  }
}
