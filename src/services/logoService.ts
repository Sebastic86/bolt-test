import { updateTeam } from './teamService';
import { resolveTeamLogoFromApiSports } from './apiSportsService';
import { fetchTeamLogoByIdFromTheSportsDb, fetchTeamLogoByNameFromTheSportsDb } from './theSportsDbService';

/**
 * Logo Service — resolves a team's crest through a tiered fallback chain,
 * caching the result so most loads are instant after the first:
 *
 *   1. teams.resolvedLogoUrl from the database (instant)
 *   2. browser localStorage cache (7-day TTL)
 *   3. API-Sports, via the api-sports-logo Edge Function (which persists the result itself)
 *   4. TheSportsDB, by external team id
 *   5. TheSportsDB, by team name (exact, then diacritics-normalized)
 *
 * A logo found via 3-5 is cached locally AND persisted back to
 * teams.resolvedLogoUrl (fire-and-forget) so every future load — for
 * every user — skips straight to step 1. There is no bundled local-asset
 * fallback here (unlike the old app's ~400 static crest images) — a team
 * that isn't found by either API falls through to the initials placeholder.
 */

const CACHE_KEY_PREFIX = 'gn_team_logo_';

// Filename → hashed asset URL. Only URLs end up in the JS bundle; each PNG is
// fetched on demand when a team actually needs it.
const BUNDLED_LOGOS = import.meta.glob<string>('../assets/logos/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

interface CachedLogo {
  url: string;
  timestamp: number;
}

function cacheKeyFor(apiTeamId?: string | null, apiTeamName?: string | null): string | null {
  if (apiTeamId) return `${CACHE_KEY_PREFIX}id_${apiTeamId}`;
  if (apiTeamName) return `${CACHE_KEY_PREFIX}name_${apiTeamName.toLowerCase().replace(/\s+/g, '_')}`;
  return null;
}

function getCachedLogo(cacheKey: string): string | null {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const { url, timestamp }: CachedLogo = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_DURATION_MS) return url;

    localStorage.removeItem(cacheKey);
    return null;
  } catch (error) {
    console.error('[logoService] Error reading cache:', error);
    return null;
  }
}

function setCachedLogo(cacheKey: string, url: string): void {
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ url, timestamp: Date.now() } satisfies CachedLogo));
  } catch (error) {
    console.error('[logoService] Error writing cache:', error);
  }
}

export interface GetTeamLogoUrlOptions {
  /** Database team id — needed to persist a newly-resolved URL back to teams.resolvedLogoUrl. */
  teamId?: string | null;
  apiTeamId?: string | null;
  apiTeamName?: string | null;
  resolvedLogoUrl?: string | null;
  /** Manually-set fallback URL (teams.logoUrl) — tried last, if it looks like a real URL. */
  logoUrl?: string | null;
}

export async function getTeamLogoUrl({
  teamId,
  apiTeamId,
  apiTeamName,
  resolvedLogoUrl,
  logoUrl,
}: GetTeamLogoUrlOptions): Promise<string> {
  if (resolvedLogoUrl) return resolvedLogoUrl;

  const cacheKey = cacheKeyFor(apiTeamId, apiTeamName);
  if (cacheKey) {
    const cached = getCachedLogo(cacheKey);
    if (cached) return cached;
  }

  const persist = (url: string) => {
    if (cacheKey) setCachedLogo(cacheKey, url);
    if (teamId) {
      updateTeam(teamId, { resolvedLogoUrl: url }).catch(err =>
        console.error('[logoService] Failed to persist resolved logo to database:', err)
      );
    }
  };

  if (apiTeamName && teamId) {
    const url = await resolveTeamLogoFromApiSports(teamId);
    if (url) {
      if (cacheKey) setCachedLogo(cacheKey, url);
      return url;
    }
  }

  if (apiTeamId) {
    const url = await fetchTeamLogoByIdFromTheSportsDb(apiTeamId);
    if (url) {
      persist(url);
      return url;
    }
  }

  if (apiTeamName) {
    const url = await fetchTeamLogoByNameFromTheSportsDb(apiTeamName);
    if (url) {
      persist(url);
      return url;
    }
  }

  // Last resort: a manually-set URL the admin typed in directly. Not cached
  // or persisted — it's already stored data, not a discovery.
  if (logoUrl && (logoUrl.startsWith('http://') || logoUrl.startsWith('https://'))) {
    return logoUrl;
  }

  // Legacy teams still store a bundled crest filename (e.g. "arsenal.png") in logoUrl.
  const bundled = logoUrl ? BUNDLED_LOGOS[`../assets/logos/${logoUrl.split('/').pop()}`] : undefined;
  if (bundled) return bundled;

  return '';
}

/** Clears every cached logo URL — useful if a team's crest needs re-resolving. */
export function clearLogoCache(): void {
  try {
    Object.keys(localStorage)
      .filter(key => key.startsWith(CACHE_KEY_PREFIX))
      .forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error('[logoService] Error clearing cache:', error);
  }
}
