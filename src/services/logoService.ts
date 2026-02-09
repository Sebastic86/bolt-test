/**
 * Logo Service - Handles dynamic logo loading from TheSportsDB API with caching and fallback
 */

const THESPORTSDB_API_BASE = 'https://www.thesportsdb.com/api/v1/json/3';
const CACHE_KEY_PREFIX = 'team_logo_';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Normalize team name for API searches by converting special characters to ASCII
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

interface CachedLogo {
  url: string;
  timestamp: number;
}

interface TheSportsDBTeam {
  idTeam: string;
  strTeam: string;
  strBadge: string;
  strLogo: string;
}

interface TheSportsDBResponse {
  teams: TheSportsDBTeam[] | null;
}

/**
 * Get cached logo URL from localStorage
 */
function getCachedLogo(cacheKey: string): string | null {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const { url, timestamp }: CachedLogo = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid
    if (now - timestamp < CACHE_DURATION) {
      return url;
    }

    // Cache expired, remove it
    localStorage.removeItem(cacheKey);
    return null;
  } catch (error) {
    console.error('[logoService] Error reading cache:', error);
    return null;
  }
}

/**
 * Cache logo URL in localStorage
 */
function setCachedLogo(cacheKey: string, url: string): void {
  try {
    const cached: CachedLogo = {
      url,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(cached));
  } catch (error) {
    console.error('[logoService] Error writing cache:', error);
  }
}

/**
 * Fetch team data from TheSportsDB API by team ID
 */
async function fetchTeamByIdFromAPI(teamId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${THESPORTSDB_API_BASE}/lookupteam.php?id=${teamId}`
    );

    if (!response.ok) {
      console.warn(`[logoService] API request failed: ${response.status}`);
      return null;
    }

    const data: TheSportsDBResponse = await response.json();

    if (data.teams && data.teams.length > 0) {
      // Prefer strBadge (team badge) over strLogo
      return data.teams[0].strBadge || data.teams[0].strLogo || null;
    }

    return null;
  } catch (error) {
    console.error('[logoService] Error fetching team by ID:', error);
    return null;
  }
}

/**
 * Fetch team data from TheSportsDB API by team name
 * Tries both original name and normalized name for better matching
 */
async function fetchTeamByNameFromAPI(teamName: string): Promise<string | null> {
  try {
    // First try with original name
    let response = await fetch(
      `${THESPORTSDB_API_BASE}/searchteams.php?t=${encodeURIComponent(teamName)}`
    );

    if (!response.ok) {
      console.warn(`[logoService] API request failed: ${response.status}`);
      return null;
    }

    let data: TheSportsDBResponse = await response.json();

    if (data.teams && data.teams.length > 0) {
      // Prefer strBadge (team badge) over strLogo
      return data.teams[0].strBadge || data.teams[0].strLogo || null;
    }

    // If original name didn't work, try normalized name (for special characters)
    const normalizedName = normalizeForAPI(teamName);
    if (normalizedName !== teamName) {
      console.log(`[logoService] Trying normalized name: "${teamName}" -> "${normalizedName}"`);

      response = await fetch(
        `${THESPORTSDB_API_BASE}/searchteams.php?t=${encodeURIComponent(normalizedName)}`
      );

      if (response.ok) {
        data = await response.json();

        if (data.teams && data.teams.length > 0) {
          return data.teams[0].strBadge || data.teams[0].strLogo || null;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[logoService] Error fetching team by name:', error);
    return null;
  }
}

/**
 * Get logo URL for a team with caching and fallback logic
 *
 * Resolution order:
 * 1. Check cache
 * 2. Try API by team ID
 * 3. Try API by team name
 * 4. Fallback to local logoUrl
 * 5. Return empty string (will trigger onError handler in components)
 *
 * @param apiTeamId - TheSportsDB team ID (optional)
 * @param apiTeamName - Team name for search (optional)
 * @param fallbackLogoUrl - Local logo filename as fallback (optional)
 * @returns Promise resolving to logo URL or empty string
 */
export async function getTeamLogoUrl(
  apiTeamId?: string | null,
  apiTeamName?: string | null,
  fallbackLogoUrl?: string | null
): Promise<string> {
  // Generate cache key based on available identifiers
  const cacheKey = apiTeamId
    ? `${CACHE_KEY_PREFIX}id_${apiTeamId}`
    : apiTeamName
    ? `${CACHE_KEY_PREFIX}name_${apiTeamName.toLowerCase().replace(/\s+/g, '_')}`
    : fallbackLogoUrl
    ? `${CACHE_KEY_PREFIX}local_${fallbackLogoUrl}`
    : null;

  // Check cache first
  if (cacheKey) {
    const cached = getCachedLogo(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Try API by team ID
  if (apiTeamId) {
    const logoUrl = await fetchTeamByIdFromAPI(apiTeamId);
    if (logoUrl && cacheKey) {
      setCachedLogo(cacheKey, logoUrl);
      return logoUrl;
    }
  }

  // Try API by team name
  if (apiTeamName) {
    const logoUrl = await fetchTeamByNameFromAPI(apiTeamName);
    if (logoUrl && cacheKey) {
      setCachedLogo(cacheKey, logoUrl);
      return logoUrl;
    }
  }

  // Fallback to local logo
  if (fallbackLogoUrl) {
    try {
      const localPath = new URL(`../assets/logos/${fallbackLogoUrl}`, import.meta.url).href;
      if (cacheKey) {
        setCachedLogo(cacheKey, localPath);
      }
      return localPath;
    } catch (error) {
      console.error('[logoService] Error loading local fallback logo:', error);
    }
  }

  // No logo available
  return '';
}

/**
 * Preload logos for a list of teams (useful for batch loading)
 */
export async function preloadTeamLogos(
  teams: Array<{
    apiTeamId?: string | null;
    apiTeamName?: string | null;
    logoUrl?: string | null;
  }>
): Promise<void> {
  const promises = teams.map(team =>
    getTeamLogoUrl(team.apiTeamId, team.apiTeamName, team.logoUrl)
  );

  await Promise.allSettled(promises);
}

/**
 * Clear all cached logos (useful for debugging or forced refresh)
 */
export function clearLogoCache(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    console.log('[logoService] Cache cleared');
  } catch (error) {
    console.error('[logoService] Error clearing cache:', error);
  }
}
