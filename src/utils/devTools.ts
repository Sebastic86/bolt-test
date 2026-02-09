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

// Define the devTools interface
export const devTools = {
  /**
   * Resolve all team logos and save to database
   */
  async resolveAllLogos(forceUpdate = false, delayMs = 500) {
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
   * Show help information
   */
  help() {
    console.log(`
🛠️  Development Tools - Available Commands:

📦 Logo Resolution:
  await devTools.resolveAllLogos()          - Resolve all team logos
  await devTools.resolveAllLogos(true)      - Force re-resolve all logos
  await devTools.resolveTeamLogo('uuid')    - Resolve single team logo

🧪 Testing:
  await devTools.testTeamLogo('Arsenal')    - Test logo for specific team

🗑️  Cache Management:
  devTools.clearCache()                     - Clear browser logo cache

📝 Setup:
  await devTools.populateApiNames()         - Populate API names for all teams

❓ Help:
  devTools.help()                           - Show this help message

Example:
  await devTools.resolveAllLogos()
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
