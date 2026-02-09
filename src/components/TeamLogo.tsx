import React from 'react';
import { useTeamLogo } from '../hooks/useTeamLogo';
import { Team } from '../types';

interface TeamLogoProps {
  team: {
    id?: string; // Optional: if provided, resolved URLs will be saved to database
    name: string;
    logoUrl?: string | null;
    apiTeamId?: string | null;
    apiTeamName?: string | null;
    resolvedLogoUrl?: string | null;
  };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  useApiFirst?: boolean; // If true, use API; if false, use local (default: true)
  showSpinner?: boolean; // Show loading spinner (default: false)
  alt?: string; // Override alt text
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16'
};

/**
 * TeamLogo Component - Displays team logos with API loading and fallback
 *
 * Features:
 * - Automatically loads logos from TheSportsDB API
 * - **NEW**: Saves resolved URLs to database for instant future loads!
 * - Falls back to local logos if API fails
 * - Shows placeholder on error
 * - Optional loading spinner
 * - Responsive sizing
 *
 * Usage:
 * ```tsx
 * <TeamLogo team={team} size="md" />
 * ```
 *
 * Performance: After first load, logos load instantly from database (no API call!)
 */
export const TeamLogo: React.FC<TeamLogoProps> = ({
  team,
  size = 'md',
  className = '',
  useApiFirst = true,
  showSpinner = false,
  alt
}) => {
  const { logoUrl, isLoading, error } = useTeamLogo({
    teamId: team.id,
    apiTeamId: team.apiTeamId,
    apiTeamName: team.apiTeamName,
    fallbackLogoUrl: team.logoUrl,
    resolvedLogoUrl: team.resolvedLogoUrl,
    useApiFirst
  });

  const sizeClass = sizeClasses[size];
  const altText = alt || `${team.name} logo`;

  // Show loading spinner if enabled
  if (isLoading && showSpinner) {
    return (
      <div className={`${sizeClass} ${className} flex items-center justify-center`}>
        <div className="animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 w-full h-full"></div>
      </div>
    );
  }

  // Show placeholder if error or no logo
  if (error || !logoUrl) {
    return (
      <div
        className={`${sizeClass} ${className} flex items-center justify-center bg-gray-200 rounded text-gray-500 text-xs font-bold`}
        title={altText}
      >
        {team.name.substring(0, 2).toUpperCase()}
      </div>
    );
  }

  // Show logo
  return (
    <img
      src={logoUrl}
      alt={altText}
      className={`${sizeClass} ${className} object-contain`}
      onError={(e) => {
        // Fallback to placeholder on image load error
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
        const placeholder = target.nextElementSibling as HTMLDivElement;
        if (placeholder) {
          placeholder.style.display = 'flex';
        }
      }}
    />
  );
};

export default TeamLogo;
