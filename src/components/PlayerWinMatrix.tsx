import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Player, MatchHistoryItem } from '../types';
import PlayerBadge from './PlayerBadge';

interface PlayerWinMatrixProps {
  allPlayers: Player[];
  allMatches: MatchHistoryItem[];
  loading: boolean;
  error: string | null;
  hideTitle?: boolean;
}

interface PlayerPairStats {
  wins: number;
  losses: number;
  totalMatches: number;
  winPercentage: number;
}

const PlayerWinMatrix: React.FC<PlayerWinMatrixProps> = ({
  allPlayers,
  allMatches,
  loading,
  error,
  hideTitle = false,
}) => {
  const [selectedVersion, setSelectedVersion] = useState<string>('All');
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [versionsLoading, setVersionsLoading] = useState<boolean>(false);

  // Fetch available versions
  useEffect(() => {
    const fetchVersions = async () => {
      setVersionsLoading(true);
      try {
        const { data, error } = await supabase
          .from('teams')
          .select('version')
          .order('version');
        if (error) throw error;
        const versions = Array.from(new Set((data || []).map((item: any) => item.version)));
        setAvailableVersions(versions);
      } catch (err) {
        console.error('[PlayerWinMatrix] Error fetching versions:', err);
        setAvailableVersions(['FC25', 'FC26']);
      } finally {
        setVersionsLoading(false);
      }
    };
    fetchVersions();
  }, []);

  // Filter matches by selected version
  const filteredMatches = useMemo(() => {
    if (selectedVersion === 'All') return allMatches;
    return allMatches.filter(
      (m) => m.team1_version === selectedVersion && m.team2_version === selectedVersion
    );
  }, [selectedVersion, allMatches]);

  // Filter players who have actually played matches
  const activePlayers = useMemo(() => {
    const playerIds = new Set<string>();
    filteredMatches.forEach((match) => {
      match.team1_players.forEach(p => playerIds.add(p.id));
      match.team2_players.forEach(p => playerIds.add(p.id));
    });
    return allPlayers
      .filter(p => playerIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allPlayers, filteredMatches]);

  // Calculate player pair statistics
  const pairStats = useMemo(() => {
    console.log("[PlayerWinMatrix] Calculating player pair statistics...");

    // Map to store stats for each player pair: "playerId1-playerId2" -> stats
    const statsMap = new Map<string, PlayerPairStats>();

    // Helper function to get or create stats for a pair
    const getOrCreateStats = (player1Id: string, player2Id: string): PlayerPairStats => {
      // Always use consistent ordering: smaller ID first
      const key = player1Id < player2Id ? `${player1Id}-${player2Id}` : `${player2Id}-${player1Id}`;
      if (!statsMap.has(key)) {
        statsMap.set(key, {
          wins: 0,
          losses: 0,
          totalMatches: 0,
          winPercentage: 0,
        });
      }
      return statsMap.get(key)!;
    };

    // Process each match
    filteredMatches.forEach((match) => {
      const hasScores = match.team1_score !== null && match.team2_score !== null;
      if (!hasScores) return; // Skip matches without scores

      const score1 = match.team1_score!;
      const score2 = match.team2_score!;

      // Determine winner
      let winnerTeamNumber: 1 | 2 | null = null;
      if (score1 > score2) {
        winnerTeamNumber = 1;
      } else if (score2 > score1) {
        winnerTeamNumber = 2;
      } else if (score1 === score2 && match.penalties_winner) {
        winnerTeamNumber = match.penalties_winner;
      }

      // Only process if there's a winner
      if (winnerTeamNumber === null) return;

      // Process team 1 player pairs
      const team1Players = match.team1_players;
      for (let i = 0; i < team1Players.length; i++) {
        for (let j = i + 1; j < team1Players.length; j++) {
          const stats = getOrCreateStats(team1Players[i].id, team1Players[j].id);
          stats.totalMatches += 1;
          if (winnerTeamNumber === 1) {
            stats.wins += 1;
          } else {
            stats.losses += 1;
          }
        }
      }

      // Process team 2 player pairs
      const team2Players = match.team2_players;
      for (let i = 0; i < team2Players.length; i++) {
        for (let j = i + 1; j < team2Players.length; j++) {
          const stats = getOrCreateStats(team2Players[i].id, team2Players[j].id);
          stats.totalMatches += 1;
          if (winnerTeamNumber === 2) {
            stats.wins += 1;
          } else {
            stats.losses += 1;
          }
        }
      }
    });

    // Calculate win percentages
    statsMap.forEach((stats) => {
      stats.winPercentage = stats.totalMatches > 0
        ? (stats.wins / stats.totalMatches) * 100
        : 0;
    });

    console.log("[PlayerWinMatrix] Player pair statistics calculated:", statsMap);
    return statsMap;
  }, [filteredMatches]);

  // Helper function to get stats for a specific pair
  const getStatsForPair = (player1Id: string, player2Id: string): PlayerPairStats | null => {
    const key = player1Id < player2Id ? `${player1Id}-${player2Id}` : `${player2Id}-${player1Id}`;
    return pairStats.get(key) || null;
  };

  // Get color based on win percentage
  const getColorClass = (winPercentage: number): string => {
    if (winPercentage >= 70) return 'bg-green-100 text-green-800';
    if (winPercentage >= 50) return 'bg-yellow-100 text-yellow-800';
    if (winPercentage >= 30) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="w-full max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        {!hideTitle && <h2 className="text-2xl font-semibold text-gray-700">Player Win Percentage Matrix</h2>}
        <div className="flex items-center gap-2">
          <label htmlFor="version-filter-matrix" className="text-sm font-medium text-gray-700">
            Version:
          </label>
          <select
            id="version-filter-matrix"
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(e.target.value)}
            disabled={versionsLoading}
            className="px-3 py-1.5 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-brand-medium focus:border-brand-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="All">All Versions</option>
            {availableVersions.map((version) => (
              <option key={version} value={version}>
                {version}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p className="text-center text-gray-600">Loading player statistics...</p>}
      {error && <p className="text-center text-red-600 bg-red-100 p-3 rounded-sm">{error}</p>}

      {!loading && !error && activePlayers.length === 0 && (
        <p className="text-center text-gray-500">No player data available for the selected version.</p>
      )}

      {!loading && !error && activePlayers.length > 0 && (
        <>
          <div className="overflow-x-auto bg-white rounded-lg shadow-sm border border-brand-light">
            <table className="min-w-full divide-y divide-brand-light">
              <thead className="bg-brand-light">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sticky left-0 bg-brand-light z-10">
                    Player
                  </th>
                  {activePlayers.map((player) => (
                    <th
                      key={player.id}
                      scope="col"
                      className="px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider min-w-[120px]"
                    >
                      <div className="flex justify-center">
                        <PlayerBadge player={player} size="xs" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-brand-light">
                {activePlayers.map((rowPlayer, rowIndex) => (
                  <tr key={rowPlayer.id} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-brand-lighter'}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 z-10" style={{backgroundColor: rowIndex % 2 === 0 ? 'white' : '#f0f9ff'}}>
                      <PlayerBadge player={rowPlayer} size="xs" />
                    </td>
                    {activePlayers.map((colPlayer) => {
                      if (rowPlayer.id === colPlayer.id) {
                        // Same player - show diagonal marker
                        return (
                          <td
                            key={colPlayer.id}
                            className="px-2 py-3 text-center text-sm bg-gray-100"
                          >
                            <span className="text-gray-400">—</span>
                          </td>
                        );
                      }

                      const stats = getStatsForPair(rowPlayer.id, colPlayer.id);

                      if (!stats || stats.totalMatches === 0) {
                        // No matches played together
                        return (
                          <td
                            key={colPlayer.id}
                            className="px-2 py-3 text-center text-sm text-gray-400"
                          >
                            —
                          </td>
                        );
                      }

                      return (
                        <td
                          key={colPlayer.id}
                          className={`px-2 py-3 text-center text-sm font-medium ${getColorClass(stats.winPercentage)}`}
                          title={`${stats.wins}W - ${stats.losses}L (${stats.totalMatches} matches)`}
                        >
                          {stats.winPercentage.toFixed(0)}%
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 space-y-1">
            <p className="text-xs text-gray-500 text-center">
              Matrix shows win percentage when two players are on the same team. Hover over cells to see match details.
            </p>
            <div className="flex justify-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 bg-green-100 border border-green-200 rounded"></span>
                <span className="text-gray-600">≥70%</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 bg-yellow-100 border border-yellow-200 rounded"></span>
                <span className="text-gray-600">50-69%</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 bg-orange-100 border border-orange-200 rounded"></span>
                <span className="text-gray-600">30-49%</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 bg-red-100 border border-red-200 rounded"></span>
                <span className="text-gray-600">&lt;30%</span>
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PlayerWinMatrix;
