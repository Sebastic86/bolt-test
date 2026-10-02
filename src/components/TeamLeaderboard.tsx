import React, { useMemo, useState } from 'react';
import { MatchHistoryItem, Player, Team } from '../types';
import { calculateTeamStandings } from '../utils/teamStatsUtils';
import { TeamBadge } from './TeamBadge';
import MatchDetailsSheet from './MatchDetailsSheet';
import { LoadingState, ErrorState, Select } from './ui';

interface TeamLeaderboardProps {
  mode: 'win' | 'loss';
  teams: Team[];
  allMatches: MatchHistoryItem[];
  players: Player[];
  loading: boolean;
  error: string | null;
  currentUserId?: string;
}

/**
 * Top 5 teams by win% or loss%. One component covering both — the old app
 * had TopWinPercentageTeams and TopLossPercentageTeams as two ~250-line
 * near-identical files differing only in sort direction and title.
 */
const TeamLeaderboard: React.FC<TeamLeaderboardProps> = ({ mode, teams, allMatches, players, loading, error, currentUserId }) => {
  const [selectedVersion, setSelectedVersion] = useState('All');
  const [selectedTeam, setSelectedTeam] = useState<{ id: string; name: string } | null>(null);

  const availableVersions = useMemo(
    () => Array.from(new Set(teams.map(t => t.version))).sort(),
    [teams]
  );

  const filteredMatches = useMemo(() => {
    if (selectedVersion === 'All') return allMatches;
    return allMatches.filter(m => m.team1_version === selectedVersion && m.team2_version === selectedVersion);
  }, [selectedVersion, allMatches]);

  const topTeams = useMemo(() => {
    const standings = calculateTeamStandings(filteredMatches, teams).filter(t => t.totalMatches > 0);
    const sorted = mode === 'win'
      ? standings.sort((a, b) => b.winPercentage - a.winPercentage || b.totalMatches - a.totalMatches)
      : standings.sort((a, b) => b.lossPercentage - a.lossPercentage || b.totalMatches - a.totalMatches);
    return sorted.slice(0, 5);
  }, [filteredMatches, teams, mode]);

  return (
    <div>
      <div className="mb-2.5 flex justify-end">
        <Select value={selectedVersion} onChange={e => setSelectedVersion(e.target.value)} className="w-auto" aria-label="Filter by version">
          <option value="All">All Versions</option>
          {availableVersions.map(v => <option key={v} value={v}>{v}</option>)}
        </Select>
      </div>

      {loading && topTeams.length === 0 && <LoadingState label="Calculating team stats..." />}
      {error && <ErrorState message={error} />}
      {!loading && !error && topTeams.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-500">No completed matches for this version yet.</p>
      )}

      {topTeams.length > 0 && (
        <div className="space-y-2">
          {topTeams.map((team, index) => {
            const pct = mode === 'win' ? team.winPercentage : team.lossPercentage;
            return (
              <button
                key={team.teamId}
                onClick={() => setSelectedTeam({ id: team.teamId, name: team.teamName })}
                className="flex w-full items-center gap-2.5 border-2 border-(--color-ink) bg-white p-2.5 text-left"
              >
                <div className="flex h-6 w-6 flex-none items-center justify-center bg-(--color-ink) text-xs font-black text-white">
                  {index + 1}
                </div>
                <TeamBadge name={team.teamName} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black uppercase tracking-wide text-(--color-ink)">{team.teamName}</div>
                  <div className="text-xs text-gray-500">{team.totalMatches} played &middot; {team.totalWins}W-{team.totalLosses}L</div>
                </div>
                <div className={`flex-none text-lg font-black tabular-nums ${mode === 'win' ? 'text-(--color-green-mid)' : 'text-red-600'}`}>
                  {pct.toFixed(0)}%
                </div>
              </button>
            );
          })}
        </div>
      )}

      <MatchDetailsSheet
        isOpen={selectedTeam !== null}
        onClose={() => setSelectedTeam(null)}
        title={selectedTeam ? `Matches — ${selectedTeam.name}` : ''}
        matches={selectedTeam ? filteredMatches.filter(m => m.team1_id === selectedTeam.id || m.team2_id === selectedTeam.id) : []}
        players={players}
        currentUserId={currentUserId}
      />
    </div>
  );
};

export default TeamLeaderboard;
