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
// Resolve all team logos (recommended after setup)
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

### 🧪 Testing

```javascript
// Test logo resolution for a team
await devTools.testTeamLogo('Bayern Munich')
// Logs: team data, API search results, found logo URL

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
// Show available commands
devTools.help()
```

## Common Workflows

### Initial Setup

```javascript
// 1. Populate API names
await devTools.populateApiNames()

// 2. Resolve all logos
await devTools.resolveAllLogos()

// Done! Logos are now permanently stored in database
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

- Full documentation: `LOGO_MANAGEMENT.md`
- Quick start guide: `QUICK_START_LOGOS.md`
- Persistent storage guide: `PERSISTENT_LOGO_STORAGE.md`
