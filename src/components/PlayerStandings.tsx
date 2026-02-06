import React, { useState, useEffect, useMemo } from 'react';
import { PlayerStanding, MatchHistoryItem, Player, Team } from '../types';
import PlayerMatchDetails from './PlayerMatchDetails';
import { supabase } from '../lib/supabaseClient';

interface PlayerStandingsProps {
  standings: PlayerStanding[];
  loading: boolean; // Pass loading state if calculation depends on async data
  error: string | null; // Pass error state
  title?: string; // Optional title prop
  matches: MatchHistoryItem[]; // Matches data to show when clicking on a player
  allPlayers?: Player[]; // All players for recalculating standings
  allTeams?: Team[]; // All teams for recalculating standings
  enableVersionFilter?: boolean; // Flag to enable version filtering (only for Overall standings)
}

const PlayerStandings: React.FC<PlayerStandingsProps> = ({ 
  standings, 
  loading, 
  error, 
  title = "Player Standings", 
  matches,
  allPlayers,
  allTeams,
  enableVersionFilter = false
}) => {
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; name: string } | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string>('All');
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [versionsLoading, setVersionsLoading] = useState<boolean>(false);

  // Fetch available versions when version filter is enabled
  useEffect(() => {
    if (enableVersionFilter) {
      const fetchVersions = async () => {
        setVersionsLoading(true);
        try {
          console.log('[PlayerStandings] Fetching available versions...');
          const { data, error } = await supabase
            .from('teams')
            .select('version')
            .order('version');
          
          if (error) {
            console.error('[PlayerStandings] Error fetching versions:', error);
            throw error;
          }
          
          const versions = Array.from(new Set(data?.map(item => item.version) || []));
          console.log('[PlayerStandings] Available versions:', versions);
          setAvailableVersions(versions);
        } catch (error) {
          console.error('[PlayerStandings] Error in fetchVersions:', error);
          // Fallback to default versions if fetch fails
          setAvailableVersions(['FC25', 'FC26']);
        } finally {
          setVersionsLoading(false);
        }
      };
      
      fetchVersions();
    }
  }, [enableVersionFilter]);

  // Filter matches by version and recalculate standings if version filter is enabled
  const filteredStandings = useMemo(() => {
    if (!enableVersionFilter || selectedVersion === 'All' || !allPlayers || !allTeams) {
      return standings;
    }

    console.log(`[PlayerStandings] Filtering matches for version: ${selectedVersion}`);
    
    // Filter matches by version
    const versionFilteredMatches = matches.filter(match => 
      match.team1_version === selectedVersion && match.team2_version === selectedVersion
    );

    console.log(`[PlayerStandings] Filtered ${versionFilteredMatches.length} matches for version ${selectedVersion}`);

    // Recalculate standings based on filtered matches
    const standingsMap = new Map<string, PlayerStanding>();
    const teamMap = new Map(allTeams.map(t => [t.id, t]));

    allPlayers.forEach(player => {
      standingsMap.set(player.id, {
        playerId: player.id,
        playerName: player.name,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        totalOverallRating: 0,
        matchesPlayed: 0,
      });
    });

    versionFilteredMatches.forEach(match => {
      const team1 = teamMap.get(match.team1_id);
      const team2 = teamMap.get(match.team2_id);

      const hasScores = match.team1_score !== null && match.team2_score !== null;
      let winnerTeamNumber: 1 | 2 | null = null;
      if (hasScores) {
        const score1 = match.team1_score!;
        const score2 = match.team2_score!;
        if (score1 > score2) winnerTeamNumber = 1;
        else if (score2 > score1) winnerTeamNumber = 2;
        else if (score1 === score2 && match.penalties_winner) {
          winnerTeamNumber = match.penalties_winner;
        }
      }

      match.team1_players.forEach(player => {
        const standing = standingsMap.get(player.id);
        if (standing) {
          if (hasScores) {
            standing.goalsFor += match.team1_score!;
            standing.goalsAgainst += match.team2_score!;
            if (winnerTeamNumber === 1) {
              standing.points += 1;
            }
          }
          if (team1) {
            standing.totalOverallRating += team1.overallRating;
            standing.matchesPlayed += 1;
          }
        }
      });

      match.team2_players.forEach(player => {
        const standing = standingsMap.get(player.id);
        if (standing) {
          if (hasScores) {
            standing.goalsFor += match.team2_score!;
            standing.goalsAgainst += match.team1_score!;
            if (winnerTeamNumber === 2) {
              standing.points += 1;
            }
          }
          if (team2) {
            standing.totalOverallRating += team2.overallRating;
            standing.matchesPlayed += 1;
          }
        }
      });
    });

    const standingsArray = Array.from(standingsMap.values()).map(s => ({
      ...s,
      goalDifference: s.goalsFor - s.goalsAgainst
    }));

    standingsArray.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });

    console.log('[PlayerStandings] Recalculated standings:', standingsArray);
    return standingsArray;
  }, [enableVersionFilter, selectedVersion, matches, allPlayers, allTeams, standings]);

  // Use filtered matches for the player details modal
  const filteredMatches = useMemo(() => {
    if (!enableVersionFilter || selectedVersion === 'All') {
      return matches;
    }
    return matches.filter(match => 
      match.team1_version === selectedVersion && match.team2_version === selectedVersion
    );
  }, [enableVersionFilter, selectedVersion, matches]);
  
  return (
    <div className="w-full max-w-4xl mt-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        <h2 className="text-2xl font-semibold text-gray-700">{title}</h2>
        
        {/* Version Filter Dropdown - only shown when enableVersionFilter is true */}
        {enableVersionFilter && (
          <div className="flex items-center gap-2">
            <label htmlFor="version-filter" className="text-sm font-medium text-gray-700">
              Version:
            </label>
            <select
              id="version-filter"
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(e.target.value)}
              disabled={versionsLoading}
              className="px-3 py-1.5 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-brand-medium focus:border-brand-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="All">All Versions</option>
              {availableVersions.map(version => (
                <option key={version} value={version}>{version}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && <p className="text-center text-gray-600">Calculating standings...</p>}
      {error && <p className="text-center text-red-600 bg-red-100 p-3 rounded-sm">{error}</p>}

      {!loading && !error && filteredStandings.length === 0 && (
        <p className="text-center text-gray-500">No completed matches with players to calculate standings.</p>
      )}

      {!loading && !error && filteredStandings.length > 0 && (
        <div className="overflow-x-auto bg-white rounded-lg shadow-sm border border-brand-light">
          <table className="min-w-full divide-y divide-brand-light">
            <thead className="bg-brand-light">
              <tr>
                <th scope="col" className="px-1 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-12">
                  Rank
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-20">
                  Pts
                </th>
                <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-20" title="Win Rate">
                  Win %
                </th>
                <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-20">
                  GF
                </th>
                <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-20">
                  GA
                </th>
                 <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-20">
                  GD
                </th>
                <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-20">
                  Matches
                </th>
                <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-24" title="Average Overall Rating of Teams Played">
                  Avg OVR
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-brand-light">
              {filteredStandings.map((player, index) => (
                <tr 
                  key={player.playerId} 
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-brand-lighter'} hover:bg-blue-50 cursor-pointer transition-colors duration-150`}
                  onClick={() => setSelectedPlayer({ id: player.playerId, name: player.playerName })}
                >
                  <td className="px-1 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {player.playerName}
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                    {player.points}
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                    {player.matchesPlayed > 0 ? `${((player.points / player.matchesPlayed) * 100).toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                    {player.goalsFor}
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                    {player.goalsAgainst}
                  </td>
                   <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                    {player.goalDifference >= 0 ? `+${player.goalDifference}` : player.goalDifference} {/* Display calculated difference with sign */}
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                    {player.matchesPlayed} {/* Display total matches played */}
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                    {player.matchesPlayed > 0 ? (player.totalOverallRating / player.matchesPlayed).toFixed(1) : '-'} {/* Display average OVR or dash */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
       <p className="text-xs text-gray-500 mt-2 text-center">Pts: Points (1 per win, including penalties wins), Win %: Win Rate percentage, GF: Goals For, GA: Goals Against, GD: Goal Difference, Matches: Total matches played, Avg OVR: Average Overall Rating of Teams Played. Sorted by Pts, then GD, then GF. Click on a player to see all their matches.</p>
      
      {/* Player Match Details Modal */}
      {selectedPlayer && (
        <PlayerMatchDetails
          playerId={selectedPlayer.id}
          playerName={selectedPlayer.name}
          matches={filteredMatches}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
};

export default PlayerStandings;
