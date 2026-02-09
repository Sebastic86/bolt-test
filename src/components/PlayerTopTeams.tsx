import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Player, MatchHistoryItem, Team } from '../types';
import { Shield } from 'lucide-react';
import { TeamLogo } from './TeamLogo';

interface PlayerTopTeamsProps {
  allPlayers: Player[];
  allMatches: MatchHistoryItem[];
  allTeams: Team[];
  loading: boolean;
  error: string | null;
  hideTitle?: boolean;
}

interface TeamStats {
  teamId: string;
  teamName: string;
  logoUrl: string;
  wins: number;
  goals: number;
  matchesPlayed: number;
}

interface PlayerTeamStats {
  playerId: string;
  playerName: string;
  topTeams: TeamStats[];
}

const PlayerTopTeams: React.FC<PlayerTopTeamsProps> = ({
  allPlayers,
  allMatches,
  allTeams,
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
        console.error('[PlayerTopTeams] Error fetching versions:', err);
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

  // Calculate player top teams statistics
  const playerTopTeamsStats = useMemo(() => {
    console.log("[PlayerTopTeams] Calculating player top teams statistics...");

    // Map to store stats for each player-team combination
    const playerTeamMap = new Map<string, Map<string, TeamStats>>();
    const teamMap = new Map(allTeams.map(t => [t.id, t]));

    // Initialize player maps
    allPlayers.forEach(player => {
      playerTeamMap.set(player.id, new Map<string, TeamStats>());
    });

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

      const team1 = teamMap.get(match.team1_id);
      const team2 = teamMap.get(match.team2_id);

      // Process team 1 players
      if (team1) {
        match.team1_players.forEach(player => {
          const playerStats = playerTeamMap.get(player.id);
          if (!playerStats) return;

          let teamStats = playerStats.get(match.team1_id);
          if (!teamStats) {
            teamStats = {
              teamId: match.team1_id,
              teamName: team1.name,
              logoUrl: team1.logoUrl,
              wins: 0,
              goals: 0,
              matchesPlayed: 0,
            };
            playerStats.set(match.team1_id, teamStats);
          }

          teamStats.matchesPlayed += 1;
          teamStats.goals += score1;
          if (winnerTeamNumber === 1) {
            teamStats.wins += 1;
          }
        });
      }

      // Process team 2 players
      if (team2) {
        match.team2_players.forEach(player => {
          const playerStats = playerTeamMap.get(player.id);
          if (!playerStats) return;

          let teamStats = playerStats.get(match.team2_id);
          if (!teamStats) {
            teamStats = {
              teamId: match.team2_id,
              teamName: team2.name,
              logoUrl: team2.logoUrl,
              wins: 0,
              goals: 0,
              matchesPlayed: 0,
            };
            playerStats.set(match.team2_id, teamStats);
          }

          teamStats.matchesPlayed += 1;
          teamStats.goals += score2;
          if (winnerTeamNumber === 2) {
            teamStats.wins += 1;
          }
        });
      }
    });

    // Build result array with top 3 teams per player
    const result: PlayerTeamStats[] = allPlayers
      .map(player => {
        const playerStats = playerTeamMap.get(player.id);
        if (!playerStats || playerStats.size === 0) {
          return null;
        }

        // Convert to array and sort by wins (descending), then goals (descending)
        const teamsArray = Array.from(playerStats.values());
        teamsArray.sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          return b.goals - a.goals;
        });

        // Take top 3
        const topTeams = teamsArray.slice(0, 3);

        return {
          playerId: player.id,
          playerName: player.name,
          topTeams,
        };
      })
      .filter((stat): stat is PlayerTeamStats => stat !== null)
      .sort((a, b) => a.playerName.localeCompare(b.playerName));

    console.log("[PlayerTopTeams] Player top teams statistics calculated:", result);
    return result;
  }, [allPlayers, filteredMatches, allTeams]);

  return (
    <div className="w-full max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        {!hideTitle && <h2 className="text-2xl font-semibold text-gray-700">Top 3 Teams per Player</h2>}
        <div className="flex items-center gap-2">
          <label htmlFor="version-filter-top-teams" className="text-sm font-medium text-gray-700">
            Version:
          </label>
          <select
            id="version-filter-top-teams"
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

      {loading && <p className="text-center text-gray-600">Loading player team statistics...</p>}
      {error && <p className="text-center text-red-600 bg-red-100 p-3 rounded-sm">{error}</p>}

      {!loading && !error && playerTopTeamsStats.length === 0 && (
        <p className="text-center text-gray-500">No player team data available for the selected version.</p>
      )}

      {!loading && !error && playerTopTeamsStats.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {playerTopTeamsStats.map((playerStat) => (
              <div
                key={playerStat.playerId}
                className="bg-white rounded-lg shadow-sm border border-brand-light p-4"
              >
                <h3 className="text-lg font-semibold text-gray-800 mb-3 text-center border-b border-brand-light pb-2">
                  {playerStat.playerName}
                </h3>
                <div className="space-y-3">
                  {playerStat.topTeams.map((team, index) => (
                    <div
                      key={team.teamId}
                      className={`flex items-center gap-3 p-2 rounded ${
                        index === 0
                          ? 'bg-yellow-50 border border-yellow-200'
                          : index === 1
                          ? 'bg-gray-50 border border-gray-200'
                          : 'bg-orange-50 border border-orange-200'
                      }`}
                    >
                      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center font-bold text-gray-600">
                        #{index + 1}
                      </div>
                      <div className="shrink-0">
                        <TeamLogo
                          team={{ name: team.teamName, logoUrl: team.logoUrl, apiTeamId: null, apiTeamName: null }}
                          size="md"
                        />
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate" title={team.teamName}>
                          {team.teamName}
                        </p>
                        <div className="flex gap-3 text-xs text-gray-600">
                          <span title="Wins">
                            <span className="font-semibold">{team.wins}</span>W
                          </span>
                          <span title="Goals">
                            <span className="font-semibold">{team.goals}</span>G
                          </span>
                          <span title="Matches Played" className="text-gray-500">
                            ({team.matchesPlayed}M)
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3 text-center">
            Showing top 3 teams for each player. Ranked by wins, then by goals scored. W: Wins, G: Goals, M: Matches Played.
          </p>
        </>
      )}
    </div>
  );
};

export default PlayerTopTeams;
