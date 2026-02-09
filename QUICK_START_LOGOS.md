# Quick Start: New Logo System

This is a simplified guide to get you started with the new API-based logo system with **persistent storage**.

## Step 1: Apply Database Migrations

Run these migrations to add the new fields to your teams table:

```bash
# Using Supabase CLI
supabase db push

# Or copy/paste the SQL from:
# 1. supabase/migrations/add_api_team_fields.sql
# 2. supabase/migrations/add_resolved_logo_url.sql (NEW!)
```

This adds:
- `apiTeamId` - TheSportsDB team ID
- `apiTeamName` - Team name for API searches
- `resolvedLogoUrl` - **NEW!** Permanently stores resolved logo URLs (eliminates API calls!)

## Step 2: Populate API Names

### Option A: Browser Console (Easiest!)

Open your browser console and run:

```javascript
// Populate API names for all teams
await devTools.populateApiNames()
```

### Option B: In Your App

Add this to your app (e.g., in a settings page or admin panel):

```tsx
import { populateApiTeamNames } from './scripts/populateApiTeamNames';

// Run once to populate apiTeamName for all existing teams
const handlePopulateNames = async () => {
  await populateApiTeamNames();
  alert('Team names populated! Check console for details.');
};
```

## Step 3: Start Using New Components

### Replace Old Logo Code

**Before:**
```tsx
<img src={getLogoPath(team.logoUrl)} alt={team.name} className="w-8 h-8" />
```

**After:**
```tsx
import { TeamLogo } from './components/TeamLogo';

<TeamLogo team={team} size="md" />
```

That's it! Logos will now load from API with automatic fallback to local files.

## Step 4: Add New Teams Easily

When adding a new team, just set the `apiTeamName`:

```sql
INSERT INTO teams (name, league, rating, logoUrl, apiTeamName, overallRating, ...)
VALUES ('Arsenal', 'Premier League', 5.0, 'arsenal.png', 'Arsenal', 90, ...);
```

The logo will automatically load from TheSportsDB API!

## Testing

Test a specific team to see if API is working:

```tsx
import { testTeamLogo } from './scripts/populateApiTeamNames';

await testTeamLogo('Arsenal');
// Check console for API results and logo URLs
```

## Troubleshooting

### Logos not loading?

1. Check browser console for errors
2. Make sure `apiTeamName` is populated:
   ```sql
   SELECT name, apiTeamName FROM teams LIMIT 10;
   ```
3. Clear cache if needed:
   ```tsx
   import { clearLogoCache } from './services/logoService';
   clearLogoCache();
   ```

### Want to use local logos only?

Just don't populate `apiTeamName` or `apiTeamId`, and the system will automatically use local logos from `logoUrl`.

Or force local mode:
```tsx
<TeamLogo team={team} useApiFirst={false} />
```

## Step 5: (Optional) Bulk Resolve All Logos

Want to resolve all team logos at once?

### Option A: Browser Console (Easiest!)

Open your browser console and run:

```javascript
// Resolve all team logos (takes a few minutes for many teams)
await devTools.resolveAllLogos()

// Or force re-resolve all logos
await devTools.resolveAllLogos(true)

// Or with custom delay (1000ms between API calls)
await devTools.resolveAllLogos(false, 1000)
```

### Option B: In Your App

```tsx
import { resolveAllTeamLogos } from './scripts/resolveAllTeamLogos';

// Resolve all team logos and save to database
const stats = await resolveAllTeamLogos();
console.log(`Success: ${stats.success}, Failed: ${stats.failed}, Skipped: ${stats.skipped}`);
```

This will:
- Fetch logos for all teams via API
- **Save them to database permanently**
- Skip teams that already have resolved URLs
- Report progress and statistics

## Step 6: (Recommended) Migrate Logos to Supabase Storage

For maximum reliability and control, migrate your logos to Supabase Storage!

### Why Migrate?

- **Full Control**: Own your images, no external dependencies
- **Performance**: Fast CDN delivery via Supabase
- **Reliability**: No risk of external URLs breaking
- **Privacy**: No external tracking

### Setup Supabase Storage Bucket

1. Go to Supabase Dashboard → **Storage**
2. Click **"New bucket"**
3. Name: `team-logos`
4. Check **"Public bucket"** (logos need to be publicly accessible)
5. Click **"Create bucket"**

### Migrate All Logos

Open your browser console and run:

```javascript
// Migrate all logos to Supabase Storage
await devTools.migrateLogosToStorage()

// Check migration progress
await devTools.checkStorageMigrationStatus()

// Force re-migrate all logos
await devTools.migrateLogosToStorage(true)
```

This will:
- Download logos from TheSportsDB URLs
- Upload to your Supabase Storage bucket
- Update database with new Supabase URLs
- Report progress and statistics

Typical migration time: **~1-2 seconds per team** (with 500ms delay between uploads)

### Verify Migration

```javascript
// Check how many teams are migrated
await devTools.getStorageStats()

// List teams that still need migration
await devTools.listTeamsNeedingMigration()
```

After migration, your logos load from:
```
https://YOUR_PROJECT.supabase.co/storage/v1/object/public/team-logos/TEAM_UUID.png
```

For detailed storage setup instructions, see **`SUPABASE_STORAGE_SETUP.md`**

### Other Console Commands

```javascript
// Show available commands
devTools.help()

// Test API resolution for specific team
await devTools.testTeamLogo('Bayern Munich')

// Test storage migration for specific team
await devTools.testTeamStorageMigration('Bayern Munich')

// Resolve single team by ID
await devTools.resolveTeamLogo('team-uuid-here')

// Migrate single team to storage
await devTools.migrateTeamLogoToStorage('team-uuid-here')

// Clear browser cache
devTools.clearCache()
```

## Benefits

- ✅ **No more manual logo downloads** - API handles it
- ✅ **Smaller bundle size** - Logos loaded on-demand
- ✅ **Auto-caching** - 7-day cache for performance
- ✅ **Automatic fallback** - Uses local logos if API fails
- ✅ **Easy to add teams** - Just provide team name
- ✅ **Persistent storage** - Logos saved to database after first load
- ✅ **No repeated API calls** - Once resolved, logos load from database forever
- ✅ **NEW: Supabase Storage** - Own your images with full control and CDN delivery!

## Next Steps

- Read `LOGO_MANAGEMENT.md` for detailed documentation
- Update components to use `<TeamLogo />` component
- Optional: Remove old local logo files to reduce bundle size
- Optional: Set specific `apiTeamId` for better accuracy

## Need Help?

Check the full documentation in `LOGO_MANAGEMENT.md`
