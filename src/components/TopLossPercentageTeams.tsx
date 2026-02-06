import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { TeamStanding, MatchHistoryItem } from '../types';
import TeamMatchDetails from './TeamMatchDetails';
import { getLogoPath } from '../utils/logoUtils';

interface TopLossPercentageTeamsProps {
  teamStandings: TeamStanding[];
  loading: boolean;
  error: string | null;
  title?: string;
  allMatches: MatchHistoryItem[];
}

const TopLossPercentageTeams: React.FC<TopLossPercentageTeamsProps> = ({ 
  teamStandings, 
  loading, 
  error, 
  title = "Top 5 Teams with Highest Loss Percentage",
  allMatches
}) => {
  const [selectedTeam, setSelectedTeam] = useState<{ id: string; name: string } | null>(null);
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
        console.error('[TopLossPercentageTeams] Error fetching versions:', err);
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

  // Compute standings from filtered matches when a specific version is selected; otherwise use provided standings
  const computedStandings: TeamStanding[] = useMemo(() => {
    if (selectedVersion === 'All') return teamStandings;

    const map = new Map<string, TeamStanding>();

    filteredMatches.forEach((match) => {
      const hasScores = match.team1_score !== null && match.team2_score !== null;
      if (!hasScores) return;

      if (!map.has(match.team1_id)) {
        map.set(match.team1_id, {
          teamId: match.team1_id,
          teamName: match.team1_name,
          logoUrl: match.team1_logoUrl,
          totalMatches: 0,
          totalWins: 0,
          totalLosses: 0,
          winPercentage: 0,
          lossPercentage: 0,
        });
      }
      if (!map.has(match.team2_id)) {
        map.set(match.team2_id, {
          teamId: match.team2_id,
          teamName: match.team2_name,
          logoUrl: match.team2_logoUrl,
          totalMatches: 0,
          totalWins: 0,
          totalLosses: 0,
          winPercentage: 0,
          lossPercentage: 0,
        });
      }

      let winnerTeamNumber: 1 | 2 | null = null;
      const s1 = match.team1_score as number;
      const s2 = match.team2_score as number;
      if (s1 > s2) winnerTeamNumber = 1;
      else if (s2 > s1) winnerTeamNumber = 2;
      else if (s1 === s2 && match.penalties_winner) {
        winnerTeamNumber = match.penalties_winner;
      }

      const t1 = map.get(match.team1_id)!;
      const t2 = map.get(match.team2_id)!;
      t1.totalMatches += 1;
      t2.totalMatches += 1;

      if (winnerTeamNumber === 1) {
        t1.totalWins += 1;
        t2.totalLosses += 1;
      } else if (winnerTeamNumber === 2) {
        t2.totalWins += 1;
        t1.totalLosses += 1;
      }
    });

    const arr = Array.from(map.values()).map((t) => ({
      ...t,
      winPercentage: t.totalMatches > 0 ? (t.totalWins / t.totalMatches) * 100 : 0,
      lossPercentage: t.totalMatches > 0 ? (t.totalLosses / t.totalMatches) * 100 : 0,
    }));

    return arr;
  }, [selectedVersion, filteredMatches, teamStandings]);
  const topLossTeams = computedStandings
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        <h2 className="text-2xl font-semibold text-gray-700">{title}</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="version-filter-loss" className="text-sm font-medium text-gray-700">
            Version:
          </label>
          <select
            id="version-filter-loss"
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
                      src={getLogoPath(team.logoUrl)}
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
        Teams ranked by loss percentage. Only teams with at least one match played are included. Click on a team to see all their matches and players.
      </p>
      
      {/* Team Match Details Modal */}
      {selectedTeam && (
        <TeamMatchDetails
          teamId={selectedTeam.id}
          teamName={selectedTeam.name}
          matches={filteredMatches}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </div>
  );
};

export default TopLossPercentageTeams;