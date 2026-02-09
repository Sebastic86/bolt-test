/**
 * Logo Service - Handles dynamic logo loading from TheSportsDB API with caching and fallback
 */

import { supabase } from '../lib/supabaseClient';
import { fetchTeamLogoFromApiSports, isApiSportsConfigured } from './apiSportsService';

const THESPORTSDB_API_BASE = 'https://www.thesportsdb.com/api/v1/json/3';
const CACHE_KEY_PREFIX = 'team_logo_';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// CORS Proxy configuration
const CORS_PROXY_URL = import.meta.env.VITE_CORS_PROXY_URL || 'https://corsproxy.io/?';

/**
 * Wrap URL with CORS proxy to bypass CORS restrictions
 */
function withCorsProxy(url: string): string {
  return `${CORS_PROXY_URL}${encodeURIComponent(url)}`;
}

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
 * Save resolved logo URL to database for permanent storage
 * This eliminates the need for repeated API calls
 */
async function saveResolvedLogoToDatabase(
  teamId: string,
  resolvedLogoUrl: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('teams')
      .update({ resolvedLogoUrl })
      .eq('id', teamId);

    if (error) {
      console.error('[logoService] Error saving resolved logo to database:', error);
    } else {
      console.log(`[logoService] Saved resolved logo for team ${teamId}`);
    }
  } catch (error) {
    console.error('[logoService] Unexpected error saving to database:', error);
  }
}

/**
 * Fetch team data from TheSportsDB API by team ID
 * Uses CORS proxy to bypass browser CORS restrictions
 */
async function fetchTeamByIdFromAPI(teamId: string): Promise<string | null> {
  try {
    const apiUrl = `${THESPORTSDB_API_BASE}/lookupteam.php?id=${teamId}`;
    const response = await fetch(withCorsProxy(apiUrl));

    if (!response.ok) {
      console.warn(`[logoService] TheSportsDB API request failed: ${response.status}`);
      return null;
    }

    const data: TheSportsDBResponse = await response.json();

    if (data.teams && data.teams.length > 0) {
      // Prefer strBadge (team badge) over strLogo
      return data.teams[0].strBadge || data.teams[0].strLogo || null;
    }

    return null;
  } catch (error) {
    // Check if it's a CORS error
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('CORS') || errorMessage.includes('NetworkError')) {
      console.error('[logoService] CORS error fetching team by ID. Consider using API-Sports as backup.');
    } else {
      console.error('[logoService] Error fetching team by ID:', error);
    }
    return null;
  }
}

/**
 * Fetch team data from TheSportsDB API by team name
 * Tries both original name and normalized name for better matching
 * Uses CORS proxy to bypass browser CORS restrictions
 */
async function fetchTeamByNameFromAPI(teamName: string): Promise<string | null> {
  try {
    // First try with original name
    const apiUrl = `${THESPORTSDB_API_BASE}/searchteams.php?t=${encodeURIComponent(teamName)}`;
    let response = await fetch(withCorsProxy(apiUrl));

    if (!response.ok) {
      console.warn(`[logoService] TheSportsDB API request failed: ${response.status}`);
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

      const normalizedUrl = `${THESPORTSDB_API_BASE}/searchteams.php?t=${encodeURIComponent(normalizedName)}`;
      response = await fetch(withCorsProxy(normalizedUrl));

      if (response.ok) {
        data = await response.json();

        if (data.teams && data.teams.length > 0) {
          return data.teams[0].strBadge || data.teams[0].strLogo || null;
        }
      }
    }

    return null;
  } catch (error) {
    // Check if it's a CORS error
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('CORS') || errorMessage.includes('NetworkError')) {
      console.error('[logoService] CORS error fetching team by name. Consider using API-Sports as backup.');
    } else {
      console.error('[logoService] Error fetching team by name:', error);
    }
    return null;
  }
}

/**
 * Get logo URL for a team with caching and fallback logic
 *
 * Resolution order:
 * 1. Check resolvedLogoUrl from database (instant!)
 * 2. Check browser cache
 * 3. Try API-Sports (primary - paid subscription with better reliability)
 * 4. Try TheSportsDB API by team ID (with CORS proxy - fallback)
 * 5. Try TheSportsDB API by team name (with CORS proxy - fallback)
 * 6. Fallback to local logoUrl
 * 7. Return empty string (will trigger onError handler in components)
 *
 * When a logo is found via API, it's automatically saved to the database
 * for permanent storage and faster future loads.
 *
 * API-Sports is now the primary provider (paid subscription).
 * TheSportsDB serves as free fallback with CORS proxy.
 *
 * @param teamId - Database team ID (for saving resolved URL)
 * @param apiTeamId - TheSportsDB team ID (optional)
 * @param apiTeamName - Team name for search (optional)
 * @param fallbackLogoUrl - Local logo filename as fallback (optional)
 * @param resolvedLogoUrl - Previously resolved logo URL from database (optional)
 * @returns Promise resolving to logo URL or empty string
 */
export async function getTeamLogoUrl(
  teamId?: string | null,
  apiTeamId?: string | null,
  apiTeamName?: string | null,
  fallbackLogoUrl?: string | null,
  resolvedLogoUrl?: string | null
): Promise<string> {
  // Step 1: If we have a resolved URL from database, use it immediately (fastest path!)
  if (resolvedLogoUrl) {
    console.log(`[logoService] Using resolved URL from database for team ${teamId}`);
    return resolvedLogoUrl;
  }
  // Generate cache key based on available identifiers
  const cacheKey = apiTeamId
    ? `${CACHE_KEY_PREFIX}id_${apiTeamId}`
    : apiTeamName
    ? `${CACHE_KEY_PREFIX}name_${apiTeamName.toLowerCase().replace(/\s+/g, '_')}`
    : fallbackLogoUrl
    ? `${CACHE_KEY_PREFIX}local_${fallbackLogoUrl}`
    : null;

  // Step 2: Check browser cache
  if (cacheKey) {
    const cached = getCachedLogo(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Step 3: Try API-Sports FIRST (primary provider - paid subscription)
  if (apiTeamName && isApiSportsConfigured()) {
    console.log('[logoService] Trying API-Sports (primary provider)...');
    const logoUrl = await fetchTeamLogoFromApiSports(apiTeamName);
    if (logoUrl) {
      console.log('[logoService] ✅ Found via API-Sports');
      // Save to browser cache
      if (cacheKey) {
        setCachedLogo(cacheKey, logoUrl);
      }
      // Save to database for permanent storage (async, don't block)
      if (teamId) {
        saveResolvedLogoToDatabase(teamId, logoUrl).catch(err =>
          console.error('[logoService] Failed to save to DB:', err)
        );
      }
      return logoUrl;
    }
    console.log('[logoService] API-Sports did not find logo, trying TheSportsDB fallback...');
  }

  // Step 4: Try TheSportsDB by team ID (fallback)
  if (apiTeamId) {
    const logoUrl = await fetchTeamByIdFromAPI(apiTeamId);
    if (logoUrl) {
      console.log('[logoService] ✅ Found via TheSportsDB (by ID)');
      // Save to browser cache
      if (cacheKey) {
        setCachedLogo(cacheKey, logoUrl);
      }
      // Save to database for permanent storage (async, don't block)
      if (teamId) {
        saveResolvedLogoToDatabase(teamId, logoUrl).catch(err =>
          console.error('[logoService] Failed to save to DB:', err)
        );
      }
      return logoUrl;
    }
  }

  // Step 5: Try TheSportsDB by team name (fallback with CORS proxy)
  if (apiTeamName) {
    const logoUrl = await fetchTeamByNameFromAPI(apiTeamName);
    if (logoUrl) {
      console.log('[logoService] ✅ Found via TheSportsDB (by name)');
      // Save to browser cache
      if (cacheKey) {
        setCachedLogo(cacheKey, logoUrl);
      }
      // Save to database for permanent storage (async, don't block)
      if (teamId) {
        saveResolvedLogoToDatabase(teamId, logoUrl).catch(err =>
          console.error('[logoService] Failed to save to DB:', err)
        );
      }
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
