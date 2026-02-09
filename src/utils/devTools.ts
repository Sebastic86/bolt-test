/**
 * Development Tools - Helper functions for browser console
 *
 * These functions are exposed globally in development mode for easy access
 * from the browser console.
 *
 * Usage in console:
 * ```javascript
 * // Resolve all team logos
 * await window.devTools.resolveAllLogos();
 *
 * // Resolve single team
 * await window.devTools.resolveTeamLogo('team-uuid');
 *
 * // Clear logo cache
 * window.devTools.clearCache();
 *
 * // Test team logo
 * await window.devTools.testTeamLogo('Bayern Munich');
 * ```
 */

import { resolveAllTeamLogos, resolveTeamLogo } from '../scripts/resolveAllTeamLogos';
import { clearLogoCache } from '../services/logoService';
import { testTeamLogo, populateApiTeamNames } from '../scripts/populateApiTeamNames';
import {
  migrateAllLogosToStorage,
  migrateTeamLogoToStorage,
  checkStorageMigrationStatus,
  listTeamsNeedingMigration,
  testTeamStorageMigration,
} from '../scripts/migrateLogosToStorage';
import { getStorageStats } from '../services/logoStorageService';

// Define the devTools interface
export const devTools = {
  /**
   * Resolve all team logos and save to database
   */
  async resolveAllLogos(forceUpdate = false, delayMs = 200) {
    console.log('🚀 Starting bulk logo resolution...');
    const stats = await resolveAllTeamLogos(forceUpdate, delayMs);
    console.log('✅ Complete!');
    console.log(`  Success: ${stats.success}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`  Skipped: ${stats.skipped}`);
    return stats;
  },

  /**
   * Resolve logo for a single team
   */
  async resolveTeamLogo(teamId: string) {
    console.log(`🔍 Resolving logo for team: ${teamId}`);
    const success = await resolveTeamLogo(teamId);
    if (success) {
      console.log('✅ Logo resolved and saved!');
    } else {
      console.log('❌ Failed to resolve logo');
    }
    return success;
  },

  /**
   * Clear browser cache for logos
   */
  clearCache() {
    console.log('🗑️  Clearing logo cache...');
    clearLogoCache();
    console.log('✅ Cache cleared!');
  },

  /**
   * Test logo resolution for a team by name
   */
  async testTeamLogo(teamName: string) {
    console.log(`🧪 Testing logo for: ${teamName}`);
    await testTeamLogo(teamName);
  },

  /**
   * Populate API team names for all teams
   */
  async populateApiNames() {
    console.log('📝 Populating API team names...');
    await populateApiTeamNames();
    console.log('✅ Complete!');
  },

  /**
   * Migrate all logos to Supabase Storage
   */
  async migrateLogosToStorage(forceUpdate = false, delayMs = 1500) {
    console.log('🚀 Starting logo migration to Supabase Storage...');
    const stats = await migrateAllLogosToStorage(forceUpdate, delayMs);
    console.log('✅ Migration complete!');
    console.log(`  Success: ${stats.success}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`  Skipped: ${stats.skipped}`);
    return stats;
  },

  /**
   * Migrate single team logo to Supabase Storage
   */
  async migrateTeamLogoToStorage(teamId: string, forceUpdate = false) {
    console.log(`🚀 Migrating logo for team: ${teamId}`);
    const success = await migrateTeamLogoToStorage(teamId, forceUpdate);
    if (success) {
      console.log('✅ Logo migrated to Supabase Storage!');
    } else {
      console.log('❌ Failed to migrate logo');
    }
    return success;
  },

  /**
   * Check storage migration status
   */
  async checkStorageMigrationStatus() {
    await checkStorageMigrationStatus();
  },

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    const stats = await getStorageStats();
    console.log('📊 Storage Statistics:');
    console.log(`  Total Teams: ${stats.totalTeams}`);
    console.log(`  In Storage: ${stats.teamsInStorage}`);
    console.log(`  Need Migration: ${stats.teamsNeedingMigration}`);
    console.log(`  Without Logos: ${stats.teamsWithoutLogos}`);
    return stats;
  },

  /**
   * List teams needing migration
   */
  async listTeamsNeedingMigration() {
    await listTeamsNeedingMigration();
  },

  /**
   * Test storage migration for specific team
   */
  async testTeamStorageMigration(teamName: string) {
    await testTeamStorageMigration(teamName);
  },

  /**
   * Show help information
   */
  help() {
    console.log(`
🛠️  Development Tools - Available Commands:

📦 Logo Resolution:
  await devTools.resolveAllLogos()          - Resolve all team logos from API
  await devTools.resolveAllLogos(true)      - Force re-resolve all logos
  await devTools.resolveTeamLogo('uuid')    - Resolve single team logo

☁️  Storage Migration:
  await devTools.migrateLogosToStorage()    - Migrate all logos to Supabase Storage
  await devTools.migrateLogosToStorage(true)- Force re-migrate all logos
  await devTools.migrateTeamLogoToStorage('uuid') - Migrate single team
  await devTools.checkStorageMigrationStatus() - Check migration progress
  await devTools.getStorageStats()          - Get storage statistics
  await devTools.listTeamsNeedingMigration()- List teams needing migration

🧪 Testing:
  await devTools.testTeamLogo('Arsenal')    - Test API logo resolution
  await devTools.testTeamStorageMigration('Arsenal') - Test storage migration

🗑️  Cache Management:
  devTools.clearCache()                     - Clear browser logo cache

📝 Setup:
  await devTools.populateApiNames()         - Populate API names for all teams

❓ Help:
  devTools.help()                           - Show this help message

Full Workflow Example:
  1. await devTools.populateApiNames()      - Populate API names
  2. await devTools.resolveAllLogos()       - Resolve logos from API
  3. await devTools.migrateLogosToStorage() - Migrate to Supabase Storage
    `);
  }
};

// Type declaration for window
declare global {
  interface Window {
    devTools: typeof devTools;
  }
}

/**
 * Initialize dev tools in development mode
 * Call this in your main app file (e.g., main.tsx or App.tsx)
 */
export function initDevTools() {
  if (import.meta.env.DEV) {
    window.devTools = devTools;
    console.log('🛠️  Dev tools loaded! Type "devTools.help()" for commands.');
  }
}
