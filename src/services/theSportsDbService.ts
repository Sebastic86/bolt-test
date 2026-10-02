import { normalizeTeamName } from '../utils/normalizeTeamName';

/**
 * TheSportsDB client — a free, no-API-key team-lookup API used as the
 * fallback logo source when API-Sports isn't configured or doesn't have a
 * match. Docs: https://www.thesportsdb.com/api.php
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

async function searchTheSportsDb(path: string): Promise<string | null> {
  const response = await fetch(`${THESPORTSDB_API_BASE}/${path}`);
  if (!response.ok) {
    console.warn(`[theSportsDbService] Request failed: ${response.status}`);
    return null;
  }

  const data: TheSportsDbResponse = await response.json();
  if (!data.teams || data.teams.length === 0) return null;

  // Prefer the team badge (transparent crest) over the wordmark logo.
  return data.teams[0].strBadge || data.teams[0].strLogo || null;
}

export async function fetchTeamLogoByIdFromTheSportsDb(teamId: string): Promise<string | null> {
  try {
    return await searchTheSportsDb(`lookupteam.php?id=${teamId}`);
  } catch (error) {
    console.error('[theSportsDbService] Error fetching team by id:', error);
    return null;
  }
}

/** Tries the exact team name first, then a diacritics-normalized variant. */
export async function fetchTeamLogoByNameFromTheSportsDb(teamName: string): Promise<string | null> {
  try {
    const exact = await searchTheSportsDb(`searchteams.php?t=${encodeURIComponent(teamName)}`);
    if (exact) return exact;

    const normalized = normalizeTeamName(teamName);
    if (normalized === teamName) return null;

    return await searchTheSportsDb(`searchteams.php?t=${encodeURIComponent(normalized)}`);
  } catch (error) {
    console.error('[theSportsDbService] Error fetching team by name:', error);
    return null;
  }
}
