/**
 * API-Sports Service
 *
 * Backup API for team logo resolution when TheSportsDB fails.
 * Provides 100 free requests per day per sport API.
 *
 * Documentation: https://api-sports.io/documentation/football/v3
 */

// API Configuration
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';
const API_KEY = import.meta.env.VITE_API_SPORTS_KEY || '';

// Note: API-Sports requires an API key. Sign up at https://api-sports.io
// Free tier: 100 requests/day per sport

interface ApiSportsTeam {
  team: {
    id: number;
    name: string;
    code: string | null;
    country: string;
    founded: number | null;
    national: boolean;
    logo: string;
  };
  venue: {
    id: number | null;
    name: string | null;
    address: string | null;
    city: string | null;
    capacity: number | null;
    surface: string | null;
    image: string | null;
  };
}

interface ApiSportsResponse {
  get: string;
  parameters: Record<string, string>;
  errors: any[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: ApiSportsTeam[];
}

/**
 * Check if API-Sports is configured
 */
export function isApiSportsConfigured(): boolean {
  return API_KEY.length > 0;
}

/**
 * Fetch team logo from API-Sports by team name
 *
 * @param teamName - Team name to search for
 * @returns Logo URL or null if not found
 */
export async function fetchTeamLogoFromApiSports(teamName: string): Promise<string | null> {
  if (!isApiSportsConfigured()) {
    console.warn('[apiSportsService] API key not configured. Set VITE_API_SPORTS_KEY in .env file.');
    return null;
  }

  try {
    console.log(`[apiSportsService] Searching for team: ${teamName}`);

    const response = await fetch(
      `${API_SPORTS_BASE_URL}/teams?search=${encodeURIComponent(teamName)}`,
      {
        headers: {
          'x-apisports-key': API_KEY,
        },
      }
    );

    if (!response.ok) {
      console.warn(`[apiSportsService] API request failed: ${response.status} ${response.statusText}`);

      // Check for rate limit
      if (response.status === 429) {
        console.error('[apiSportsService] Rate limit exceeded. Free tier allows 100 requests/day.');
      }

      return null;
    }

    const data: ApiSportsResponse = await response.json();

    // Check for API errors
    if (data.errors && data.errors.length > 0) {
      console.error('[apiSportsService] API returned errors:', data.errors);
      return null;
    }

    // Check if any teams found
    if (data.results === 0 || !data.response || data.response.length === 0) {
      console.log(`[apiSportsService] No teams found for: ${teamName}`);
      return null;
    }

    // Return logo from first match
    const teamLogo = data.response[0].team.logo;
    console.log(`[apiSportsService] Found logo for ${teamName}: ${teamLogo}`);

    return teamLogo;
  } catch (error) {
    console.error('[apiSportsService] Error fetching team logo:', error);
    return null;
  }
}

/**
 * Fetch team logo from API-Sports by team ID
 *
 * @param teamId - API-Sports team ID
 * @returns Logo URL or null if not found
 */
export async function fetchTeamLogoByIdFromApiSports(teamId: number): Promise<string | null> {
  if (!isApiSportsConfigured()) {
    console.warn('[apiSportsService] API key not configured. Set VITE_API_SPORTS_KEY in .env file.');
    return null;
  }

  try {
    console.log(`[apiSportsService] Fetching team by ID: ${teamId}`);

    const response = await fetch(
      `${API_SPORTS_BASE_URL}/teams?id=${teamId}`,
      {
        headers: {
          'x-apisports-key': API_KEY,
        },
      }
    );

    if (!response.ok) {
      console.warn(`[apiSportsService] API request failed: ${response.status} ${response.statusText}`);

      if (response.status === 429) {
        console.error('[apiSportsService] Rate limit exceeded. Free tier allows 100 requests/day.');
      }

      return null;
    }

    const data: ApiSportsResponse = await response.json();

    if (data.errors && data.errors.length > 0) {
      console.error('[apiSportsService] API returned errors:', data.errors);
      return null;
    }

    if (data.results === 0 || !data.response || data.response.length === 0) {
      console.log(`[apiSportsService] No team found with ID: ${teamId}`);
      return null;
    }

    const teamLogo = data.response[0].team.logo;
    console.log(`[apiSportsService] Found logo for team ID ${teamId}: ${teamLogo}`);

    return teamLogo;
  } catch (error) {
    console.error('[apiSportsService] Error fetching team by ID:', error);
    return null;
  }
}

/**
 * Get remaining API quota (if available in headers)
 * Note: This requires checking response headers from a previous request
 */
export async function checkApiQuota(): Promise<{
  remaining: number | null;
  limit: number | null;
} | null> {
  if (!isApiSportsConfigured()) {
    console.warn('[apiSportsService] API key not configured.');
    return null;
  }

  try {
    // Make a minimal request to check headers
    const response = await fetch(
      `${API_SPORTS_BASE_URL}/status`,
      {
        headers: {
          'x-apisports-key': API_KEY,
        },
      }
    );

    // API-Sports includes quota in headers
    const remaining = response.headers.get('x-ratelimit-requests-remaining');
    const limit = response.headers.get('x-ratelimit-requests-limit');

    return {
      remaining: remaining ? parseInt(remaining, 10) : null,
      limit: limit ? parseInt(limit, 10) : null,
    };
  } catch (error) {
    console.error('[apiSportsService] Error checking API quota:', error);
    return null;
  }
}
