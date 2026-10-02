import React, { useState } from 'react';
import { useTeamLogo } from '../hooks/useTeamLogo';
import { TeamBadge } from './TeamBadge';

interface TeamLogoProps {
  team: {
    id?: string | null;
    name: string;
    apiTeamId?: string | null;
    apiTeamName?: string | null;
    resolvedLogoUrl?: string | null;
    logoUrl?: string | null;
  };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-7 w-7',
  md: 'h-11 w-11',
  lg: 'h-14 w-14',
};

/**
 * Displays a team's real crest once resolved (via logoService — API-Sports
 * then TheSportsDB), falling back to the TeamBadge colored-initials
 * placeholder while loading, on error, or if neither API has a match.
 *
 * A persisted `resolvedLogoUrl` renders immediately (no placeholder flash).
 * List rows that may render the same team dozens of times should pass only
 * `{ name, resolvedLogoUrl, logoUrl }` — without id/apiTeamId/apiTeamName
 * logoService has nothing to look up remotely, so it never hits the network.
 */
export const TeamLogo: React.FC<TeamLogoProps> = ({ team, size = 'md', className = '' }) => {
  const { logoUrl: resolvedUrl, isLoading, error } = useTeamLogo({
    teamId: team.id,
    apiTeamId: team.apiTeamId,
    apiTeamName: team.apiTeamName,
    resolvedLogoUrl: team.resolvedLogoUrl,
    logoUrl: team.logoUrl,
  });
  // Track the URL that failed rather than a boolean, so a component reused
  // for a different team (e.g. the reveal animation's cycling slot) isn't
  // stuck on the placeholder because an earlier team's image 404'd.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const logoUrl = team.resolvedLogoUrl || (isLoading || error ? '' : resolvedUrl);

  if (!logoUrl || failedUrl === logoUrl) {
    return <TeamBadge name={team.name} size={size} className={className} />;
  }

  return (
    <img
      src={logoUrl}
      alt={`${team.name} logo`}
      loading="lazy"
      decoding="async"
      onError={() => setFailedUrl(logoUrl)}
      className={`flex-none border-2 border-(--color-ink) bg-white object-contain p-1 ${SIZE_CLASSES[size]} ${className}`}
    />
  );
};
