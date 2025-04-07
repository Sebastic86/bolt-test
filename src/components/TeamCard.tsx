import React from 'react';
import { Team } from '../types';
import * as LucideIcons from 'lucide-react'; // Import all icons

interface TeamCardProps {
  team: Team;
}

// Helper to get icon component by name
const getIcon = (name: string): React.ElementType => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = (LucideIcons as any)[name];
  return IconComponent || LucideIcons.ShieldQuestion; // Default icon if not found
};

// Helper function to get rating color classes
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

const TeamCard: React.FC<TeamCardProps> = ({ team }) => {
  const Icon = getIcon(team.logoIconName);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 w-full max-w-sm mx-auto border border-gray-200 flex items-center space-x-4">
      {/* Left Side: Logo */}
      <div className="flex-shrink-0">
        <Icon className="w-16 h-16 text-blue-600" />
      </div>

      {/* Right Side: Details */}
      <div className="flex-grow min-w-0"> {/* Added min-w-0 for better truncation */}
        <h3 className="text-lg font-semibold mb-0.5 truncate text-gray-800">{team.name}</h3>
        <p className="text-sm text-gray-500 mb-1 truncate">{team.league}</p>

        {/* Star Rating & Overall */}
        <div className="flex items-center space-x-2 mb-2">
          <div className="flex items-center text-yellow-500">
            <LucideIcons.Star className="w-4 h-4 mr-1" fill="currentColor" />
            <span className="text-sm font-medium">{team.rating.toFixed(1)}</span>
          </div>
          <div className="text-sm text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
            <span className="font-semibold">OVR:</span> {team.overallRating}
          </div>
        </div>

        {/* Attack, Midfield, Defend Ratings */}
        <div className="grid grid-cols-3 gap-2 text-xs text-center">
          {/* Attack Rating */}
          <div className={`${getRatingClasses(team.attackRating)} p-1 rounded`}>
            <span className="font-semibold block sm:inline">ATT:</span> {team.attackRating}
          </div>
          {/* Midfield Rating */}
          <div className={`${getRatingClasses(team.midfieldRating)} p-1 rounded`}>
            <span className="font-semibold block sm:inline">MID:</span> {team.midfieldRating}
          </div>
          {/* Defend Rating */}
          <div className={`${getRatingClasses(team.defendRating)} p-1 rounded`}>
            <span className="font-semibold block sm:inline">DEF:</span> {team.defendRating}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamCard;
