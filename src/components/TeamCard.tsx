import React, { useState } from 'react';
import { Team } from '../types';
import * as LucideIcons from 'lucide-react'; // Keep Star icon import
import { Pencil, Shield } from 'lucide-react'; // Import Pencil and Shield icons
import { AdminOnly } from './RoleBasedComponents';

interface TeamCardProps {
  team: Team;
  differences?: {
    overall?: number;
    attack?: number;
    midfield?: number;
    defend?: number;
  };
  onEdit?: () => void; // Add onEdit prop
}

// Helper function to get rating color classes (Kept semantic colors)
const getRatingClasses = (rating: number): string => {
  if (rating > 85) {
    return 'bg-emerald-100 text-emerald-800'; // Very High
  } else if (rating > 80) {
    return 'bg-green-100 text-green-800'; // High
  } else if (rating > 75) {
    return 'bg-lime-100 text-lime-800'; // Good
  } else if (rating > 70) {
    return 'bg-yellow-100 text-yellow-800'; // Average
  } else {
    return 'bg-red-100 text-red-800'; // Below Average
  }
};

// Helper function to format rating difference
const formatDifference = (diff: number | undefined): string => {
  if (diff === undefined) return '';
  if (diff > 0) {
    return `(+${diff})`;
  } else if (diff < 0) {
    return `(${diff})`; // Negative sign is already included
  } else {
    return `(0)`;
  }
};

// Helper function to get color class for difference (Kept semantic colors)
const getDifferenceColor = (diff: number | undefined): string => {
  if (diff === undefined) return '';
  if (diff > 0) {
    return 'text-green-600'; // Positive difference
  } else if (diff < 0) {
    return 'text-red-600'; // Negative difference
  } else {
    return 'text-gray-500'; // No difference
  }
};


const TeamCard: React.FC<TeamCardProps> = ({ team, differences, onEdit }) => {
  const [logoError, setLogoError] = useState(false); // State to track logo loading error

  const handleLogoError = () => {
    setLogoError(true);
  };

  // Reset error state if the team prop changes (e.g., new match generated)
  React.useEffect(() => {
    setLogoError(false);
  }, [team.logoUrl]);

  return (
    <div className="relative bg-white rounded-lg shadow-md p-4 w-full max-w-sm mx-auto border border-brand-light flex items-center space-x-4">
      {/* Edit Button */}
      <AdminOnly>
        {onEdit && (
          <button
            onClick={onEdit}
            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-brand-dark rounded-full hover:bg-gray-100 transition-colors duration-150"
            aria-label="Edit team"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </AdminOnly>

      {/* Left Side: Logo or Fallback Icon */}
      <div className="shrink-0 w-16 h-16 flex items-center justify-center overflow-hidden rounded-sm bg-gray-100 text-gray-400">
        {logoError ? (
          // Use Shield as a generic fallback
          <Shield className="w-10 h-10" aria-label="Team logo fallback" />
        ) : (
          <img
            src={team.logoUrl}
            alt={`${team.name} logo`}
            className="w-full h-full object-contain"
            onError={handleLogoError} // Use the handler
          />
        )}
      </div>

      {/* Right Side: Details */}
      <div className="grow min-w-0">
        <h3 className="text-lg font-semibold mb-0.5 truncate text-gray-800 pr-8">
          {team.name} <span className="text-sm font-normal text-gray-500">({team.version})</span>
        </h3> {/* Added version display */}
        <p className="text-sm text-gray-500 mb-1 truncate">{team.league}</p>

        {/* Star Rating & Overall */}
        <div className="flex items-center space-x-2 mb-2">
          <div className="flex items-center text-yellow-500">
            <LucideIcons.Star className="w-4 h-4 mr-1" fill="currentColor" />
            <span className="text-sm font-medium">{team.rating.toFixed(1)}</span>
          </div>
          <div className="text-sm text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded-sm flex items-center space-x-1">
            <span className="font-semibold">OVR:</span>
            <span>{team.overallRating}</span>
            {differences?.overall !== undefined && (
              <span className={`text-xs font-medium ${getDifferenceColor(differences.overall)}`}>
                {formatDifference(differences.overall)}
              </span>
            )}
          </div>
        </div>

        {/* Attack, Midfield, Defend Ratings */}
        <div className="grid grid-cols-3 gap-2 text-xs text-center">
          {/* Attack Rating */}
          <div className={`${getRatingClasses(team.attackRating)} p-1 rounded-sm flex flex-col sm:flex-row sm:items-center sm:justify-center sm:space-x-1`}>
            <div>
              <span className="font-semibold">ATT:</span> {team.attackRating}
            </div>
            {differences?.attack !== undefined && (
              <span className={`font-medium ${getDifferenceColor(differences.attack)}`}>
                {formatDifference(differences.attack)}
              </span>
            )}
          </div>
          {/* Midfield Rating */}
          <div className={`${getRatingClasses(team.midfieldRating)} p-1 rounded-sm flex flex-col sm:flex-row sm:items-center sm:justify-center sm:space-x-1`}>
             <div>
               <span className="font-semibold">MID:</span> {team.midfieldRating}
             </div>
            {differences?.midfield !== undefined && (
              <span className={`font-medium ${getDifferenceColor(differences.midfield)}`}>
                {formatDifference(differences.midfield)}
              </span>
            )}
          </div>
          {/* Defend Rating */}
          <div className={`${getRatingClasses(team.defendRating)} p-1 rounded-sm flex flex-col sm:flex-row sm:items-center sm:justify-center sm:space-x-1`}>
            <div>
              <span className="font-semibold">DEF:</span> {team.defendRating}
            </div>
            {differences?.defend !== undefined && (
              <span className={`font-medium ${getDifferenceColor(differences.defend)}`}>
                {formatDifference(differences.defend)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamCard;
