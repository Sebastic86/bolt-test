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
 */
export const TeamLogo: React.FC<TeamLogoProps> = ({ team, size = 'md', className = '' }) => {
  const { logoUrl, isLoading, error } = useTeamLogo({
    teamId: team.id,
    apiTeamId: team.apiTeamId,
    apiTeamName: team.apiTeamName,
    resolvedLogoUrl: team.resolvedLogoUrl,
    logoUrl: team.logoUrl,
  });
  const [imgFailed, setImgFailed] = useState(false);

  if (isLoading || error || !logoUrl || imgFailed) {
    return <TeamBadge name={team.name} size={size} className={className} />;
  }

  return (
    <img
      src={logoUrl}
      alt={`${team.name} logo`}
      onError={() => setImgFailed(true)}
      className={`flex-none border-2 border-(--color-ink) bg-white object-contain p-1 ${SIZE_CLASSES[size]} ${className}`}
    />
  );
};
