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

const TeamCard: React.FC<TeamCardProps> = ({ team }) => {
  const Icon = getIcon(team.logoIconName);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 w-full max-w-xs mx-auto text-center border border-gray-200">
      <div className="flex justify-center items-center mb-3 h-16">
         <Icon className="w-12 h-12 text-blue-600" />
      </div>
      <h3 className="text-lg font-semibold mb-1 truncate">{team.name}</h3>
      <p className="text-sm text-gray-600 mb-2">{team.league}</p>
      <div className="flex justify-center items-center text-yellow-500">
        <LucideIcons.Star className="w-4 h-4 mr-1" fill="currentColor" />
        <span className="text-sm font-medium">{team.rating.toFixed(1)}</span>
      </div>
    </div>
  );
};

export default TeamCard;
