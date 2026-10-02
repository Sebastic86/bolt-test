import { useEffect, useState } from 'react';
import { getTeamLogoUrl } from '../services/logoService';

interface UseTeamLogoOptions {
  teamId?: string | null;
  apiTeamId?: string | null;
  apiTeamName?: string | null;
  resolvedLogoUrl?: string | null;
  logoUrl?: string | null;
}

interface UseTeamLogoResult {
  logoUrl: string;
  isLoading: boolean;
  error: boolean;
}

/** Resolves a team's crest via logoService, re-resolving whenever the team identity changes. */
export function useTeamLogo({
  teamId,
  apiTeamId,
  apiTeamName,
  resolvedLogoUrl,
  logoUrl: fallbackLogoUrl,
}: UseTeamLogoOptions): UseTeamLogoResult {
  const [logoUrl, setLogoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(false);

    getTeamLogoUrl({ teamId, apiTeamId, apiTeamName, resolvedLogoUrl, logoUrl: fallbackLogoUrl })
      .then(url => {
        if (!isMounted) return;
        setLogoUrl(url);
        setError(!url);
      })
      .catch(err => {
        console.error('[useTeamLogo] Error loading logo:', err);
        if (isMounted) {
          setLogoUrl('');
          setError(true);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [teamId, apiTeamId, apiTeamName, resolvedLogoUrl, fallbackLogoUrl]);

  return { logoUrl, isLoading, error };
}
