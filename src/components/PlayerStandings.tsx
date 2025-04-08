import React from 'react';
import { PlayerStanding } from '../types'; // Assuming PlayerStanding type is defined in types.ts

interface PlayerStandingsProps {
  standings: PlayerStanding[];
  loading: boolean; // Pass loading state if calculation depends on async data
  error: string | null; // Pass error state
}

const PlayerStandings: React.FC<PlayerStandingsProps> = ({ standings, loading, error }) => {
  return (
    <div className="w-full max-w-4xl mt-8">
      <h2 className="text-2xl font-semibold text-gray-700 mb-4">Player Standings (Today)</h2>

      {loading && <p className="text-center text-gray-600">Calculating standings...</p>}
      {error && <p className="text-center text-red-600 bg-red-100 p-3 rounded">{error}</p>}

      {!loading && !error && standings.length === 0 && (
        <p className="text-center text-gray-500">No completed matches with players today to calculate standings.</p>
      )}

      {!loading && !error && standings.length > 0 && (
        <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  Rank
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                  Pts
                </th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                  GF
                </th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                  GA
                </th>
                 <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                  GD
                </th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24" title="Sum of Overall Ratings of Teams Played">
                  OVR Sum
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {standings.map((player, index) => (
                <tr key={player.playerId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-2 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {player.playerName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                    {player.points}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                    {player.goalsFor}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                    {player.goalsAgainst}
                  </td>
                   <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                    {player.goalDifference} {/* Display calculated difference */}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                    {player.totalOverallRating > 0 ? player.totalOverallRating : '-'} {/* Display total OVR or dash */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
       <p className="text-xs text-gray-500 mt-2 text-center">Pts: Points (1 per win), GF: Goals For, GA: Goals Against, GD: Goal Difference, OVR Sum: Sum of Overall Ratings of Teams Played. Sorted by Pts, then GD, then GF.</p>
    </div>
  );
};

export default PlayerStandings;
