# Logo Management Guide

This document explains how to manage team logos in your application using the new API-based system.

## Overview

The application now supports **dynamic logo loading** from TheSportsDB API with automatic fallback to local logos. This eliminates the need to manually manage hundreds of logo files and makes adding new teams much easier.

## Architecture

### Components

1. **logoService.ts** - Core service for fetching logos from API with caching
2. **useTeamLogo.ts** - React hook for easy logo loading in components
3. **TeamLogo.tsx** - Reusable component for displaying team logos
4. **logoUtils.ts** - Legacy utility (kept for backward compatibility)

### Resolution Order

When loading a team logo, the system tries the following in order:

1. **Check cache** - Returns cached URL if available (7-day cache)
2. **Try API by ID** - If `apiTeamId` is set, fetch from TheSportsDB by ID
3. **Try API by name** - If `apiTeamName` is set, search TheSportsDB by name
4. **Fallback to local** - Use local logo from `src/assets/logos/` if `logoUrl` is set
5. **Show placeholder** - Display team initials if nothing works

## Database Schema

The `teams` table now has these logo-related fields:

```sql
logoUrl       TEXT NOT NULL  -- Local filename or fallback URL (e.g., "arsenal.png")
apiTeamId     TEXT           -- TheSportsDB team ID (e.g., "133604")
apiTeamName   TEXT           -- Search name for API (e.g., "Arsenal")
```

## Usage

### 1. Using the TeamLogo Component (Recommended)

The easiest way to display team logos:

```tsx
import { TeamLogo } from './components/TeamLogo';

// Basic usage
<TeamLogo team={team} />

// With custom size
<TeamLogo team={team} size="lg" />

// Force local logos only (no API)
<TeamLogo team={team} useApiFirst={false} />

// With loading spinner
<TeamLogo team={team} showSpinner={true} />
```

### 2. Using the useTeamLogo Hook

For more control:

```tsx
import { useTeamLogo } from './hooks/useTeamLogo';

const { logoUrl, isLoading, error } = useTeamLogo({
  apiTeamId: team.apiTeamId,
  apiTeamName: team.apiTeamName,
  fallbackLogoUrl: team.logoUrl,
});

{isLoading && <Spinner />}
{error && <Placeholder />}
{logoUrl && <img src={logoUrl} alt={team.name} />}
```

### 3. Using the Logo Service Directly

For advanced use cases:

```tsx
import { getTeamLogoUrl } from './services/logoService';

const logoUrl = await getTeamLogoUrl(
  team.apiTeamId,
  team.apiTeamName,
  team.logoUrl
);
```

## Adding New Teams

### Option A: Using API (Recommended)

1. **Search for the team** on TheSportsDB:
   ```
   https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=Arsenal
   ```

2. **Add team to database** with `apiTeamName`:
   ```sql
   INSERT INTO teams (name, league, rating, logoUrl, apiTeamName, ...)
   VALUES ('Arsenal', 'Premier League', 5.0, 'arsenal.png', 'Arsenal', ...);
   ```

3. **Done!** Logo will load automatically from API

### Option B: Using Local Logo

1. **Download logo** and save to `src/assets/logos/teamname.png`
2. **Add team to database**:
   ```sql
   INSERT INTO teams (name, league, rating, logoUrl, ...)
   VALUES ('New Team', 'League', 5.0, 'newteam.png', ...);
   ```

### Option C: Using API Team ID (Most Reliable)

1. **Find team ID** from TheSportsDB search result (e.g., "133604" for Arsenal)
2. **Add team to database** with `apiTeamId`:
   ```sql
   INSERT INTO teams (name, league, rating, logoUrl, apiTeamId, ...)
   VALUES ('Arsenal', 'Premier League', 5.0, 'arsenal.png', '133604', ...);
   ```

## Migrating Existing Teams

### 1. Apply Database Migration

Run the migration to add API fields:

```bash
# If using Supabase CLI
supabase db push

# Or apply manually in Supabase dashboard
```

### 2. Populate API Team Names

Run the helper script to auto-populate `apiTeamName` for existing teams:

```tsx
import { populateApiTeamNames } from './scripts/populateApiTeamNames';

// Call this once in your app initialization or as a one-time script
await populateApiTeamNames();
```

This will:
- Normalize team names (remove "FC", "CF", etc.)
- Set `apiTeamName` for all teams
- Enable API logo loading

### 3. Optional: Set Specific API IDs

For teams with common names or better accuracy, set specific API IDs:

```tsx
import { setTeamApiId } from './scripts/populateApiTeamNames';

await setTeamApiId('team-uuid-here', '133604'); // Arsenal's API ID
```

## Testing Logo Loading

### Test a Specific Team

```tsx
import { testTeamLogo } from './scripts/populateApiTeamNames';

await testTeamLogo('Arsenal');
```

This will:
- Show current database values
- Test API search
- Display found logo URLs

### Clear Logo Cache

If logos aren't updating or you want to force refresh:

```tsx
import { clearLogoCache } from './services/logoService';

clearLogoCache(); // Clears all cached logo URLs
```

## Benefits of New System

### Before (Local Logos Only)
- ❌ 395+ logo files in bundle
- ❌ Manual download/rename for each logo
- ❌ Large bundle size
- ❌ Difficult to update logos
- ❌ No logos for new teams

### After (API + Local Fallback)
- ✅ Logos loaded from CDN on-demand
- ✅ Add teams with just a name
- ✅ Smaller bundle size
- ✅ Always up-to-date logos
- ✅ 7-day cache for performance
- ✅ Automatic fallback to local logos
- ✅ Works offline with cached/local logos

## API Limits

TheSportsDB Free Tier:
- **Rate Limit**: Reasonable for normal usage
- **No API Key Required**: Free tier endpoints
- **Reliability**: Backed by Cloudflare R2 CDN

The caching system (7-day cache) minimizes API calls significantly.

## Troubleshooting

### Logo Not Loading

1. Check team has `apiTeamName` or `apiTeamId` set
2. Check console for API errors
3. Test with `testTeamLogo('Team Name')`
4. Clear cache with `clearLogoCache()`

### Special Characters in Team Names

**Problem**: Teams with special characters (like "FC Bayern München") may not find logos.

**Solution**: The system automatically handles this!
- The logo service tries the original name first
- If that fails, it automatically tries a normalized ASCII version
- Example: "München" → "Munchen", "São Paulo" → "Sao Paulo"

**Supported characters**:
- German: ü, ö, ä, ß → u, o, a, ss
- French: é, è, ê, à, â → e, e, e, a, a
- Spanish: ñ, á, é, í, ó, ú → n, a, e, i, o, u
- Nordic: ø, å, æ → o, a, ae
- And many more...

If a team still doesn't load:
1. Try setting a specific `apiTeamId` (most reliable)
2. Manually adjust `apiTeamName` to simplified version
3. Use local logo as fallback

### API Rate Limiting

If you hit rate limits:
- Increase `CACHE_DURATION` in `logoService.ts`
- Use `preloadTeamLogos()` to batch-load logos
- Add local logos as fallback

### Wrong Logo Loading

1. Set specific `apiTeamId` for accuracy
2. Adjust `apiTeamName` to be more specific
3. Use local logo as fallback

## Future Improvements

Potential enhancements:
- Support for multiple logo APIs (fallback chain)
- Admin UI for managing team API mappings
- Batch import from API by league
- Automatic logo updates/refresh
- Custom logo uploads to Supabase Storage

## Migration Path

### Phase 1: ✅ Complete
- Add API fields to database
- Create logo service with caching
- Create React hooks and components
- Maintain backward compatibility

### Phase 2: Current
- Populate API names for existing teams
- Test with subset of teams
- Update components to use TeamLogo

### Phase 3: Future
- Remove local logo files (optional)
- Update all components
- Add admin tools for logo management

## Support

For issues or questions:
1. Check console logs for errors
2. Use test utilities to debug
3. Review this documentation
4. Check TheSportsDB API status
