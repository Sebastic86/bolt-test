import React, { useState } from 'react';
import { TeamStanding, MatchHistoryItem } from '../types';
import TeamMatchDetails from './TeamMatchDetails';

interface TopWinPercentageTeamsProps {
  teamStandings: TeamStanding[];
  loading: boolean;
  error: string | null;
  title?: string;
  allMatches: MatchHistoryItem[];
}

const TopWinPercentageTeams: React.FC<TopWinPercentageTeamsProps> = ({ 
  teamStandings, 
  loading, 
  error, 
  title = "Top 5 Teams by Win Percentage",
  allMatches 
}) => {
  const [selectedTeam, setSelectedTeam] = useState<{ id: string; name: string } | null>(null);
  const topTeams = teamStandings
    .filter(team => team.totalMatches > 0) // Only include teams that have played matches
    .sort((a, b) => {
      // Sort by win percentage first (descending), then by number of matches (descending)
      if (b.winPercentage !== a.winPercentage) {
        return b.winPercentage - a.winPercentage;
      }
      return b.totalMatches - a.totalMatches;
    })
    .slice(0, 5); // Take top 5

  return (
    <div className="w-full max-w-4xl mt-8">
      <h2 className="text-2xl font-semibold text-gray-700 mb-4">{title}</h2>

      {loading && <p className="text-center text-gray-600">Loading team statistics...</p>}
      {error && <p className="text-center text-red-600 bg-red-100 p-3 rounded-sm">{error}</p>}

      {!loading && !error && topTeams.length === 0 && (
        <p className="text-center text-gray-500">No team data available to calculate win percentages.</p>
      )}

      {!loading && !error && topTeams.length > 0 && (
        <div className="overflow-x-auto bg-white rounded-lg shadow-sm border border-brand-light">
          <table className="min-w-full divide-y divide-brand-light">
            <thead className="bg-brand-light">
              <tr>
                <th scope="col" className="px-1 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-12">
                  Rank
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-16">
                  Logo
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Team Name
                </th>
                <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-20">
                  Matches
                </th>
                <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-20">
                  Wins
                </th>
                <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-24">
                  Win %
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-brand-light">
              {topTeams.map((team, index) => (
                <tr 
                  key={team.teamId} 
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-brand-lighter'} hover:bg-blue-50 cursor-pointer transition-colors duration-150`}
                  onClick={() => setSelectedTeam({ id: team.teamId, name: team.teamName })}
                >
                  <td className="px-1 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <img 
                      src={team.logoUrl} 
                      alt={`${team.teamName} logo`}
                      className="h-8 w-8 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {team.teamName}
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                    {team.totalMatches}
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                    {team.totalWins}
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-700 text-center font-medium">
                    {team.winPercentage.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500 mt-2 text-center">
        Top teams ranked by win percentage. Only teams with at least one match played are included. Click on a team to see all their matches and players.
      </p>
      
      {/* Team Match Details Modal */}
      {selectedTeam && (
        <TeamMatchDetails
          teamId={selectedTeam.id}
          teamName={selectedTeam.name}
          matches={allMatches}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </div>
  );
};

export default TopWinPercentageTeams;