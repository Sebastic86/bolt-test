/**
 * Bulk Logo Resolution Script
 *
 * This script fetches and saves logo URLs for all teams in the database.
 * Uses the centralized logoService which includes:
 * - CORS proxy for TheSportsDB API
 * - API-Sports as backup
 * - Special character normalization
 * - Comprehensive error handling
 *
 * Run this once after applying the resolvedLogoUrl migration to populate existing teams.
 *
 * Usage:
 * 1. Import and call from your app: `import { resolveAllTeamLogos } from './scripts/resolveAllTeamLogos'`
 * 2. Call the function: `await resolveAllTeamLogos()`
 * 3. Or use in console: `await devTools.resolveAllLogos()`
 *
 * The script will:
 * - Fetch all teams from database
 * - For each team, resolve logo via logoService (CORS proxy + backup API)
 * - Save resolved URL back to database
 * - Skip teams that already have resolvedLogoUrl
 */

import { supabase } from '../lib/supabaseClient';
import { getTeamLogoUrl } from '../services/logoService';

/**
 * Resolve and save logos for all teams
 *
 * Uses the centralized logoService.ts which automatically:
 * - Uses CORS proxy for TheSportsDB API
 * - Falls back to API-Sports if TheSportsDB fails
 * - Handles special characters
 * - Caches results
 *
 * @param forceUpdate - If true, re-resolve even teams that already have resolvedLogoUrl
 * @param delayMs - Delay between API calls to avoid rate limiting (default: 500ms)
 */
export async function resolveAllTeamLogos(
  forceUpdate = false,
  delayMs = 500
): Promise<{ success: number; failed: number; skipped: number }> {
  console.log('[resolveAllTeamLogos] Starting bulk logo resolution...');
  console.log('[resolveAllTeamLogos] Using CORS proxy + API-Sports backup');

  const stats = { success: 0, failed: 0, skipped: 0 };

  try {
    // Fetch all teams
    const query = supabase
      .from('teams')
      .select('id, name, apiTeamId, apiTeamName, logoUrl, resolvedLogoUrl');

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
        console.log(`[resolveAllTeamLogos] ⏭️  Skipping ${team.name} (already resolved)`);
        stats.skipped++;
        continue;
      }

      console.log(`[resolveAllTeamLogos] 🔍 Resolving logo for: ${team.name}`);

      try {
        // Use centralized logoService which handles:
        // - CORS proxy for TheSportsDB
        // - API-Sports backup
        // - Special character normalization
        // - Caching
        const logoUrl = await getTeamLogoUrl(
          team.id,
          team.apiTeamId,
          team.apiTeamName,
          team.logoUrl,
          null // Don't use existing resolvedLogoUrl (we're resolving it now)
        );

        if (logoUrl && !logoUrl.includes('assets/logos')) {
          // Logo found from API (not local fallback)
          const { error: updateError } = await supabase
            .from('teams')
            .update({ resolvedLogoUrl: logoUrl })
            .eq('id', team.id);

          if (updateError) {
            console.error(`  ❌ Error saving logo for ${team.name}:`, updateError);
            stats.failed++;
          } else {
            const source = logoUrl.includes('thesportsdb') ? 'TheSportsDB' :
                          logoUrl.includes('api-football') ? 'API-Sports' :
                          logoUrl.includes('supabase') ? 'Supabase Storage' : 'API';
            console.log(`  ✅ Found via ${source}`);
            console.log(`  💾 Saved to database: ${logoUrl.substring(0, 60)}...`);
            stats.success++;
          }
        } else if (logoUrl && logoUrl.includes('assets/logos')) {
          // Only local fallback available
          console.log(`  ⚠️  Only local logo available (not saved to DB)`);
          stats.failed++;
        } else {
          // No logo found at all
          console.log(`  ⚠️  No logo found for ${team.name}`);
          stats.failed++;
        }
      } catch (error) {
        console.error(`  ❌ Error resolving ${team.name}:`, error);
        stats.failed++;
      }

      // Delay to avoid rate limiting
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log('\n[resolveAllTeamLogos] Complete!');
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
 *
 * Uses the centralized logoService.ts which automatically:
 * - Uses CORS proxy for TheSportsDB API
 * - Falls back to API-Sports if TheSportsDB fails
 * - Handles special characters
 * - Caches results
 */
export async function resolveTeamLogo(teamId: string): Promise<boolean> {
  console.log(`[resolveTeamLogo] Resolving logo for team ${teamId}`);

  try {
    // Fetch team
    const { data: team, error: fetchError } = await supabase
      .from('teams')
      .select('id, name, apiTeamId, apiTeamName, logoUrl')
      .eq('id', teamId)
      .single();

    if (fetchError || !team) {
      console.error('[resolveTeamLogo] Team not found:', fetchError);
      return false;
    }

    console.log(`[resolveTeamLogo] Team: ${team.name}`);

    // Use centralized logoService
    const logoUrl = await getTeamLogoUrl(
      team.id,
      team.apiTeamId,
      team.apiTeamName,
      team.logoUrl,
      null // Don't use existing resolvedLogoUrl
    );

    if (logoUrl && !logoUrl.includes('assets/logos')) {
      // Logo found from API (not local fallback)
      const { error: updateError } = await supabase
        .from('teams')
        .update({ resolvedLogoUrl: logoUrl })
        .eq('id', teamId);

      if (updateError) {
        console.error('[resolveTeamLogo] Error saving:', updateError);
        return false;
      }

      const source = logoUrl.includes('thesportsdb') ? 'TheSportsDB' :
                    logoUrl.includes('api-football') ? 'API-Sports' :
                    logoUrl.includes('supabase') ? 'Supabase Storage' : 'API';
      console.log(`[resolveTeamLogo] ✅ Success! Found via ${source}`);
      console.log(`[resolveTeamLogo] Saved: ${logoUrl}`);
      return true;
    }

    console.log('[resolveTeamLogo] ⚠️  No logo found (only local fallback available)');
    return false;
  } catch (error) {
    console.error('[resolveTeamLogo] Unexpected error:', error);
    return false;
  }
}
