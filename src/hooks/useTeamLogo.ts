import { useState, useEffect } from 'react';
import { getTeamLogoUrl } from '../services/logoService';
import { getLogoPath } from '../utils/logoUtils';

interface UseTeamLogoOptions {
  apiTeamId?: string | null;
  apiTeamName?: string | null;
  fallbackLogoUrl?: string | null;
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
 * Usage:
 * ```tsx
 * const { logoUrl, isLoading, error } = useTeamLogo({
 *   apiTeamId: team.apiTeamId,
 *   apiTeamName: team.apiTeamName,
 *   fallbackLogoUrl: team.logoUrl,
 * });
 * ```
 */
export function useTeamLogo({
  apiTeamId,
  apiTeamName,
  fallbackLogoUrl,
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
          // Use new API-based logo service
          const url = await getTeamLogoUrl(apiTeamId, apiTeamName, fallbackLogoUrl);

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
  }, [apiTeamId, apiTeamName, fallbackLogoUrl, useApiFirst]);

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
