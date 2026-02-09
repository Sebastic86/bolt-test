import { useState, useEffect } from 'react';
import { getTeamLogoUrl } from '../services/logoService';
import { getLogoPath } from '../utils/logoUtils';

interface UseTeamLogoOptions {
  teamId?: string | null; // Database team ID (for saving resolved URLs)
  apiTeamId?: string | null;
  apiTeamName?: string | null;
  fallbackLogoUrl?: string | null;
  resolvedLogoUrl?: string | null; // Previously resolved logo URL from database
  useApiFirst?: boolean; // If true, use API first; if false, use local logos (default: true)
}

interface UseTeamLogoResult {
  logoUrl: string;
  isLoading: boolean;
  error: boolean;
}

/**
 * React hook for loading team logos with API and fallback support
 *
 * Now with persistent database storage! When a logo is found via API,
 * it's automatically saved to the database for instant future loads.
 *
 * Usage:
 * ```tsx
 * const { logoUrl, isLoading, error } = useTeamLogo({
 *   teamId: team.id,  // Important: for saving resolved URLs
 *   apiTeamId: team.apiTeamId,
 *   apiTeamName: team.apiTeamName,
 *   fallbackLogoUrl: team.logoUrl,
 *   resolvedLogoUrl: team.resolvedLogoUrl,  // If already resolved, instant load!
 * });
 * ```
 */
export function useTeamLogo({
  teamId,
  apiTeamId,
  apiTeamName,
  fallbackLogoUrl,
  resolvedLogoUrl,
  useApiFirst = true
}: UseTeamLogoOptions): UseTeamLogoResult {
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const loadLogo = async () => {
      setIsLoading(true);
      setError(false);

      try {
        if (useApiFirst) {
          // Use new API-based logo service with database persistence
          const url = await getTeamLogoUrl(
            teamId,
            apiTeamId,
            apiTeamName,
            fallbackLogoUrl,
            resolvedLogoUrl
          );

          if (isMounted) {
            if (url) {
              setLogoUrl(url);
              setError(false);
            } else {
              setLogoUrl('');
              setError(true);
            }
          }
        } else {
          // Use legacy local logo path
          if (fallbackLogoUrl) {
            const url = getLogoPath(fallbackLogoUrl);
            if (isMounted) {
              setLogoUrl(url);
              setError(!url);
            }
          } else {
            if (isMounted) {
              setLogoUrl('');
              setError(true);
            }
          }
        }
      } catch (err) {
        console.error('[useTeamLogo] Error loading logo:', err);
        if (isMounted) {
          setLogoUrl('');
          setError(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadLogo();

    return () => {
      isMounted = false;
    };
  }, [teamId, apiTeamId, apiTeamName, fallbackLogoUrl, resolvedLogoUrl, useApiFirst]);

  return { logoUrl, isLoading, error };
}

/**
 * Simple synchronous version for backward compatibility with existing code
 * This bypasses the API and uses only local logos
 */
export function getTeamLogoSync(logoUrl?: string | null): string {
  if (!logoUrl) return '';
  return getLogoPath(logoUrl);
}
