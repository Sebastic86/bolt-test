import { normalizeTeamName } from '../utils/normalizeTeamName';
import { RateLimitError, rateLimitErrorFrom } from './rateLimitError';

/**
 * TheSportsDB client — a free, no-API-key team-lookup API used as a fallback
 * logo source. Docs: https://www.thesportsdb.com/api.php
 *
 * The free key allows ~30 requests per minute; beyond that it answers 429.
 * By default a 429 just means "no logo" (fine for one-off lookups while
 * rendering); bulk callers pass `throwOnRateLimit` to get a RateLimitError
 * and back off instead of recording a false miss.
 */

const THESPORTSDB_API_BASE = 'https://www.thesportsdb.com/api/v1/json/3';

interface TheSportsDbTeam {
  strTeam: string;
  strBadge: string | null;
  strLogo: string | null;
}

interface TheSportsDbResponse {
  teams: TheSportsDbTeam[] | null;
}

export interface TheSportsDbOptions {
  throwOnRateLimit?: boolean;
}

async function searchTheSportsDb(path: string): Promise<string | null> {
  const response = await fetch(`${THESPORTSDB_API_BASE}/${path}`);
  if (response.status === 429) throw rateLimitErrorFrom('TheSportsDB', response);
  if (!response.ok) {
    console.warn(`[theSportsDbService] Request failed: ${response.status}`);
    return null;
  }

  const data: TheSportsDbResponse = await response.json();
  if (!data.teams || data.teams.length === 0) return null;

  // Prefer the team badge (transparent crest) over the wordmark logo.
  return data.teams[0].strBadge || data.teams[0].strLogo || null;
}

function handleError(error: unknown, what: string, { throwOnRateLimit = false }: TheSportsDbOptions): null {
  if (throwOnRateLimit && error instanceof RateLimitError) throw error;
  console.error(`[theSportsDbService] Error fetching team by ${what}:`, error);
  return null;
}

export async function fetchTeamLogoByIdFromTheSportsDb(
  teamId: string,
  options: TheSportsDbOptions = {}
): Promise<string | null> {
  try {
    return await searchTheSportsDb(`lookupteam.php?id=${teamId}`);
  } catch (error) {
    return handleError(error, 'id', options);
  }
}

/** Tries the exact team name first, then a diacritics-normalized variant. */
export async function fetchTeamLogoByNameFromTheSportsDb(
  teamName: string,
  options: TheSportsDbOptions = {}
): Promise<string | null> {
  try {
    const exact = await searchTheSportsDb(`searchteams.php?t=${encodeURIComponent(teamName)}`);
    if (exact) return exact;

    const normalized = normalizeTeamName(teamName);
    if (normalized === teamName) return null;

    return await searchTheSportsDb(`searchteams.php?t=${encodeURIComponent(normalized)}`);
  } catch (error) {
    return handleError(error, 'name', options);
  }
}
