# Browser Console Commands

Quick reference for development tools available in the browser console.

## How to Access

1. Open your app in the browser
2. Open Developer Tools (F12 or Ctrl+Shift+I)
3. Go to the **Console** tab
4. Run any of the commands below

## Available Commands

### 📦 Logo Resolution

```javascript
// Resolve all team logos from API (uses CORS proxy + backup)
await devTools.resolveAllLogos()
// Returns: { success: 245, failed: 5, skipped: 0 }

// Force re-resolve all logos (even already resolved)
await devTools.resolveAllLogos(true)

// Custom delay between API calls (default 500ms)
await devTools.resolveAllLogos(false, 1000)

// Resolve single team logo
await devTools.resolveTeamLogo('team-uuid-here')
// Returns: true/false
```

### ☁️ Storage Migration

```javascript
// Migrate all logos to Supabase Storage
await devTools.migrateLogosToStorage()
// Returns: { success: 240, failed: 0, skipped: 10 }

// Force re-migrate all logos
await devTools.migrateLogosToStorage(true)

// Migrate single team logo
await devTools.migrateTeamLogoToStorage('team-uuid-here')
// Returns: true/false

// Check migration status
await devTools.checkStorageMigrationStatus()
// Shows: total teams, migrated, pending, without logos

// Get storage statistics
await devTools.getStorageStats()
// Returns: { totalTeams, teamsInStorage, teamsNeedingMigration, teamsWithoutLogos }

// List teams needing migration
await devTools.listTeamsNeedingMigration()
// Shows all teams with external URLs that need migration
```

### 🧪 Testing

```javascript
// Test API logo resolution for a team
await devTools.testTeamLogo('Bayern Munich')
// Logs: team data, API search results, found logo URL

// Test storage migration for a team
await devTools.testTeamStorageMigration('Arsenal')
// Tests downloading and uploading to Supabase Storage

// Test with special characters
await devTools.testTeamLogo('FC Bayern München')
```

### 📝 Setup

```javascript
// Populate API names for all teams (run once after migration)
await devTools.populateApiNames()
// Normalizes team names and sets apiTeamName field
```

### 🗑️ Cache Management

```javascript
// Clear browser cache for logos
devTools.clearCache()
// Clears localStorage cache (7-day cache)
```

### ❓ Help

```javascript
// Show available commands with full workflow
devTools.help()
```

## Common Workflows

### Initial Setup (With CORS Fix)

```javascript
// 1. Populate API names
await devTools.populateApiNames()

// 2. Resolve all logos (uses CORS proxy automatically)
await devTools.resolveAllLogos()

// 3. Migrate to Supabase Storage (recommended for best performance)
await devTools.migrateLogosToStorage()

// Done! Logos are now in your Supabase Storage
```

### Quick CORS Troubleshooting

```javascript
// 1. Test if CORS proxy is working
await devTools.testTeamLogo('Arsenal')
// Should see: Logo resolved successfully

// 2. If still failing, clear cache and retry
devTools.clearCache()
await devTools.testTeamLogo('Arsenal')

// 3. Check if API-Sports backup is configured
// (See CORS_FIX.md for API-Sports setup)
```

### Troubleshooting a Team

```javascript
// 1. Test the team
await devTools.testTeamLogo('Team Name')

// 2. Check what API returns
// (See console output for details)

// 3. If needed, manually resolve
await devTools.resolveTeamLogo('team-uuid')
```

### Force Refresh All Logos

```javascript
// Clear cache
devTools.clearCache()

// Re-resolve all logos
await devTools.resolveAllLogos(true)
```

## Example Output

### Successful Resolution

```javascript
await devTools.resolveAllLogos()

// Output:
🚀 Starting bulk logo resolution...
[resolveAllTeamLogos] Found 250 teams
[resolveAllTeamLogos] Resolving logo for: Arsenal
  ✅ Found via team name: https://r2.thesportsdb.com/images/...
  💾 Saved to database
[resolveAllTeamLogos] Resolving logo for: Bayern Munich
  ✅ Found via API ID: https://r2.thesportsdb.com/images/...
  💾 Saved to database
...
[resolveAllTeamLogos] Complete!
  Success: 245
  Failed: 5
  Skipped: 0
✅ Complete!
```

### Testing a Team

```javascript
await devTools.testTeamLogo('Arsenal')

// Output:
🧪 Testing logo for: Arsenal
[testTeamLogo] Team data: {
  name: 'Arsenal',
  apiTeamId: null,
  apiTeamName: 'Arsenal',
  logoUrl: 'arsenal.png'
}
[testTeamLogo] API Result: {
  foundTeam: 'Arsenal',
  apiId: '133604',
  badge: 'https://r2.thesportsdb.com/images/media/team/badge/vrtrtp1448813175.png',
  logo: 'https://r2.thesportsdb.com/images/media/team/logo/xzqdr11517660252.png'
}
```

## Tips

1. **Be patient** - Resolving all logos can take several minutes for large databases
   - Default: 500ms delay between API calls
   - 250 teams = ~2 minutes

2. **Check console logs** - Detailed progress information is logged

3. **Monitor database** - Check resolved count:
   ```sql
   SELECT COUNT(*) FROM teams WHERE "resolvedLogoUrl" IS NOT NULL;
   ```

4. **Handle failures** - Some teams may not be found in TheSportsDB
   - Set specific `apiTeamId` for better accuracy
   - Or keep local logo as fallback

## Production Note

⚠️ **Dev Tools are only available in development mode!**

In production builds, `window.devTools` will not be available. This is by design to keep production bundles clean.

If you need to run scripts in production:
1. Use an admin panel in your app
2. Or run scripts server-side
3. Or temporarily enable dev mode

## Need More Help?

- **CORS issues**: `CORS_FIX.md` - Complete CORS troubleshooting guide
- **Full documentation**: `LOGO_MANAGEMENT.md` - Complete logo system guide
- **Quick start**: `QUICK_START_LOGOS.md` - Setup in 5 minutes
- **Storage migration**: `SUPABASE_STORAGE_SETUP.md` - Migrate to Supabase Storage
- **Persistent storage**: `PERSISTENT_LOGO_STORAGE.md` - Database storage details
