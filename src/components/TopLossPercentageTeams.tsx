import React from 'react';
import { TeamStanding } from '../types';

interface TopLossPercentageTeamsProps {
  teamStandings: TeamStanding[];
  loading: boolean;
  error: string | null;
  title?: string;
}

const TopLossPercentageTeams: React.FC<TopLossPercentageTeamsProps> = ({ 
  teamStandings, 
  loading, 
  error, 
  title = "Top 5 Teams with Highest Loss Percentage"
}) => {
  const topLossTeams = teamStandings
    .filter(team => team.totalMatches > 0) // Only include teams that have played matches
    .sort((a, b) => {
      // Sort by loss percentage first (descending), then by number of matches (descending)
      if (b.lossPercentage !== a.lossPercentage) {
        return b.lossPercentage - a.lossPercentage;
      }
      return b.totalMatches - a.totalMatches;
    })
    .slice(0, 5); // Top 5 teams

  return (
    <div className="w-full max-w-4xl mt-8">
      <h2 className="text-2xl font-semibold text-gray-700 mb-4">{title}</h2>

      {loading && <p className="text-center text-gray-600">Loading team statistics...</p>}
      {error && <p className="text-center text-red-600 bg-red-100 p-3 rounded-sm">{error}</p>}

      {!loading && !error && topLossTeams.length === 0 && (
        <p className="text-center text-gray-500">No team data available to calculate loss percentages.</p>
      )}

      {!loading && !error && topLossTeams.length > 0 && (
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
                  Losses
                </th>
                <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-24">
                  Loss %
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-brand-light">
              {topLossTeams.map((team, index) => (
                <tr key={team.teamId} className={index % 2 === 0 ? 'bg-white' : 'bg-brand-lighter'}>
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
                    {team.totalLosses}
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-700 text-center font-medium">
                    {team.lossPercentage.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500 mt-2 text-center">
        Teams ranked by loss percentage. Only teams with at least one match played are included.
      </p>
    </div>
  );
};

export default TopLossPercentageTeams;