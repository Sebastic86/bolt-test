import { supabase } from '../lib/supabaseClient';
import {
  migrateLogoToStorage,
  getTeamsNeedingMigration,
  getStorageStats,
  isLogoInStorage,
} from '../services/logoStorageService';

interface MigrationStats {
  success: number;
  failed: number;
  skipped: number;
  total: number;
}

interface MigrationResult {
  teamId: string;
  teamName: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  url?: string;
}

/**
 * Migrate all team logos to Supabase Storage
 *
 * Downloads logos from external URLs (TheSportsDB) and uploads them to Supabase Storage.
 * Updates resolvedLogoUrl with new Supabase Storage URLs.
 *
 * @param forceUpdate - If true, re-migrate even if already in storage
 * @param delayMs - Delay between uploads (to avoid rate limits)
 * @returns Statistics about the migration
 */
export async function migrateAllLogosToStorage(
  forceUpdate = false,
  delayMs = 500
): Promise<MigrationStats> {
  console.log('🚀 Starting logo migration to Supabase Storage...\n');

  const stats: MigrationStats = {
    success: 0,
    failed: 0,
    skipped: 0,
    total: 0,
  };

  const results: MigrationResult[] = [];

  try {
    // Fetch all teams with resolved logos
    let teams;
    if (forceUpdate) {
      // Get ALL teams with resolvedLogoUrl (including already migrated)
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, resolvedLogoUrl')
        .not('resolvedLogoUrl', 'is', null);

      if (error) throw error;
      teams = data || [];
    } else {
      // Get only teams needing migration (not yet in storage)
      teams = await getTeamsNeedingMigration();
    }

    stats.total = teams.length;

    if (stats.total === 0) {
      console.log('✅ No teams need migration. All logos are already in Supabase Storage!\n');
      return stats;
    }

    console.log(`📊 Found ${stats.total} teams to migrate\n`);

    // Migrate each team
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      const progress = `[${i + 1}/${stats.total}]`;

      console.log(`${progress} Migrating ${team.name}...`);

      // Skip if no resolved logo URL
      if (!team.resolvedLogoUrl) {
        console.log(`${progress} ⏭️  Skipped ${team.name} - No logo URL\n`);
        stats.skipped++;
        results.push({
          teamId: team.id,
          teamName: team.name,
          status: 'skipped',
        });
        continue;
      }

      // Skip if already in storage (unless force update)
      if (!forceUpdate && isLogoInStorage(team.resolvedLogoUrl)) {
        console.log(`${progress} ⏭️  Skipped ${team.name} - Already in storage\n`);
        stats.skipped++;
        results.push({
          teamId: team.id,
          teamName: team.name,
          status: 'skipped',
        });
        continue;
      }

      // Migrate logo
      const result = await migrateLogoToStorage(
        team.id,
        team.name,
        team.resolvedLogoUrl,
        forceUpdate
      );

      if (result.success) {
        stats.success++;
        results.push({
          teamId: team.id,
          teamName: team.name,
          status: 'success',
          url: result.url,
        });
        console.log(`${progress} ✅ Success: ${team.name}\n`);
      } else {
        stats.failed++;
        results.push({
          teamId: team.id,
          teamName: team.name,
          status: 'failed',
          error: result.error,
        });
        console.log(`${progress} ❌ Failed: ${team.name} - ${result.error}\n`);
      }

      // Delay between requests to avoid rate limits
      if (i < teams.length - 1 && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Teams:     ${stats.total}`);
  console.log(`✅ Successful:   ${stats.success}`);
  console.log(`❌ Failed:       ${stats.failed}`);
  console.log(`⏭️  Skipped:      ${stats.skipped}`);
  console.log('='.repeat(60) + '\n');

  // Print failed teams if any
  if (stats.failed > 0) {
    console.log('❌ FAILED TEAMS:');
    results
      .filter(r => r.status === 'failed')
      .forEach(r => {
        console.log(`  - ${r.teamName} (${r.teamId}): ${r.error}`);
      });
    console.log('');
  }

  return stats;
}

/**
 * Migrate a single team's logo to Supabase Storage
 *
 * @param teamId - Team UUID
 * @param forceUpdate - If true, re-migrate even if already in storage
 * @returns True if successful, false otherwise
 */
export async function migrateTeamLogoToStorage(
  teamId: string,
  forceUpdate = false
): Promise<boolean> {
  console.log(`🚀 Migrating logo for team ${teamId}...\n`);

  try {
    // Fetch team
    const { data: team, error } = await supabase
      .from('teams')
      .select('id, name, resolvedLogoUrl')
      .eq('id', teamId)
      .single();

    if (error || !team) {
      console.error('❌ Team not found:', error?.message || 'Unknown error');
      return false;
    }

    // Check if has logo URL
    if (!team.resolvedLogoUrl) {
      console.log(`⏭️  ${team.name} has no resolved logo URL. Run populateApiNames and resolveAllLogos first.\n`);
      return false;
    }

    // Check if already in storage
    if (!forceUpdate && isLogoInStorage(team.resolvedLogoUrl)) {
      console.log(`⏭️  ${team.name} logo is already in Supabase Storage: ${team.resolvedLogoUrl}\n`);
      return true;
    }

    // Migrate
    const result = await migrateLogoToStorage(
      team.id,
      team.name,
      team.resolvedLogoUrl,
      forceUpdate
    );

    if (result.success) {
      console.log(`✅ Successfully migrated ${team.name} to: ${result.url}\n`);
      return true;
    } else {
      console.error(`❌ Failed to migrate ${team.name}: ${result.error}\n`);
      return false;
    }
  } catch (error) {
    console.error('❌ Migration error:', error);
    return false;
  }
}

/**
 * Check storage migration status
 *
 * Shows how many teams are migrated, need migration, etc.
 */
export async function checkStorageMigrationStatus(): Promise<void> {
  console.log('📊 Checking storage migration status...\n');

  try {
    const stats = await getStorageStats();

    console.log('='.repeat(60));
    console.log('📊 STORAGE MIGRATION STATUS');
    console.log('='.repeat(60));
    console.log(`Total Teams:              ${stats.totalTeams}`);
    console.log(`✅ In Supabase Storage:   ${stats.teamsInStorage} (${Math.round(stats.teamsInStorage / stats.totalTeams * 100)}%)`);
    console.log(`⏳ Need Migration:        ${stats.teamsNeedingMigration}`);
    console.log(`❌ Without Logos:         ${stats.teamsWithoutLogos}`);
    console.log('='.repeat(60) + '\n');

    if (stats.teamsNeedingMigration > 0) {
      console.log(`💡 Run 'await devTools.migrateLogosToStorage()' to migrate remaining logos.\n`);
    } else if (stats.teamsWithoutLogos > 0) {
      console.log(`💡 ${stats.teamsWithoutLogos} teams have no logos. Run 'await devTools.resolveAllLogos()' first.\n`);
    } else {
      console.log('🎉 All teams with logos are migrated to Supabase Storage!\n');
    }
  } catch (error) {
    console.error('❌ Error checking status:', error);
  }
}

/**
 * List teams that need migration
 */
export async function listTeamsNeedingMigration(): Promise<void> {
  console.log('📋 Fetching teams that need migration...\n');

  try {
    const teams = await getTeamsNeedingMigration();

    if (teams.length === 0) {
      console.log('✅ No teams need migration!\n');
      return;
    }

    console.log(`Found ${teams.length} teams needing migration:\n`);
    teams.forEach((team, i) => {
      console.log(`${i + 1}. ${team.name} (${team.id})`);
      console.log(`   URL: ${team.resolvedLogoUrl}\n`);
    });
  } catch (error) {
    console.error('❌ Error listing teams:', error);
  }
}

/**
 * Test single team migration (useful for debugging)
 */
export async function testTeamStorageMigration(teamName: string): Promise<void> {
  console.log(`🧪 Testing storage migration for: ${teamName}\n`);

  try {
    // Find team by name
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name, resolvedLogoUrl')
      .ilike('name', `%${teamName}%`);

    if (error || !teams || teams.length === 0) {
      console.error('❌ Team not found:', teamName);
      return;
    }

    const team = teams[0];
    console.log(`Found: ${team.name} (${team.id})`);
    console.log(`Current URL: ${team.resolvedLogoUrl}\n`);

    if (!team.resolvedLogoUrl) {
      console.log('❌ Team has no resolved logo URL. Run resolveAllLogos first.\n');
      return;
    }

    if (isLogoInStorage(team.resolvedLogoUrl)) {
      console.log('✅ Logo is already in Supabase Storage!\n');
      return;
    }

    // Test migration
    const success = await migrateTeamLogoToStorage(team.id, false);

    if (success) {
      console.log('✅ Test migration successful!\n');
    } else {
      console.log('❌ Test migration failed. Check logs above.\n');
    }
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}
