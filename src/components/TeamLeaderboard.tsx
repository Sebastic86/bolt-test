import React, { useMemo, useState } from 'react';
import { MatchHistoryItem, Player, Team } from '../types';
import { calculateTeamStandings, topTeamsByPercentage } from '../utils/teamStatsUtils';
import { ALL_VERSIONS, filterMatchesByVersion, getAvailableVersions } from '../utils/versionFilter';
import { TeamLogo } from './TeamLogo';
import MatchDetailsSheet from './MatchDetailsSheet';
import { VersionFilter } from './stats/VersionFilter';
import { LoadingState, ErrorState } from './ui';

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
  const [selectedVersion, setSelectedVersion] = useState(ALL_VERSIONS);
  const [selectedTeam, setSelectedTeam] = useState<{ id: string; name: string } | null>(null);

  const availableVersions = useMemo(() => getAvailableVersions(teams, allMatches), [teams, allMatches]);
  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);

  const filteredMatches = useMemo(
    () => filterMatchesByVersion(allMatches, selectedVersion),
    [selectedVersion, allMatches]
  );

  const topTeams = useMemo(
    () => topTeamsByPercentage(calculateTeamStandings(filteredMatches, teams), mode),
    [filteredMatches, teams, mode]
  );

  const isWin = mode === 'win';

  return (
    <div>
      {availableVersions.length > 0 && (
        <VersionFilter
          className="mb-2.5"
          versions={availableVersions}
          value={selectedVersion}
          onChange={setSelectedVersion}
        />
      )}

      {loading && topTeams.length === 0 && <LoadingState label="Calculating team stats..." />}
      {error && <ErrorState message={error} />}
      {!loading && !error && topTeams.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-500">No completed matches for this version yet.</p>
      )}

      {topTeams.length > 0 && (
        <div className="space-y-2">
          {topTeams.map((team, index) => {
            const pct = isWin ? team.winPercentage : team.lossPercentage;
            const count = isWin ? team.totalWins : team.totalLosses;
            return (
              <button
                key={team.teamId}
                type="button"
                onClick={() => setSelectedTeam({ id: team.teamId, name: team.teamName })}
                className="flex min-h-12 w-full items-center gap-2.5 border-2 border-(--color-ink) bg-white p-2.5 text-left"
              >
                <div className="flex h-6 w-6 flex-none items-center justify-center bg-(--color-ink) text-xs font-black text-white">
                  {index + 1}
                </div>
                <TeamLogo
                  team={teamMap.get(team.teamId) ?? { id: team.teamId, name: team.teamName, logoUrl: team.logoUrl }}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black uppercase tracking-wide text-(--color-ink)">{team.teamName}</div>
                  <div className="text-xs text-gray-500">
                    {team.totalMatches} played &middot; {team.totalWins}W-{team.totalLosses}L
                  </div>
                </div>
                <div className="flex-none text-right">
                  <div className={`text-lg font-black tabular-nums ${isWin ? 'text-(--color-green-mid)' : 'text-red-600'}`}>
                    {pct.toFixed(1)}%
                  </div>
                  <div className="text-[9px] font-black uppercase tracking-wide text-gray-400">
                    {count} {isWin ? (count === 1 ? 'win' : 'wins') : (count === 1 ? 'loss' : 'losses')}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-2.5 text-center text-[10px] uppercase tracking-wide text-gray-400">
        Top 5 teams ranked by {isWin ? 'win' : 'loss'} % (ties: most matches first) &middot; teams with at least one
        match played &middot; tap a team to see its matches and players
      </p>

      <MatchDetailsSheet
        isOpen={selectedTeam !== null}
        onClose={() => setSelectedTeam(null)}
        title={selectedTeam ? `Matches — ${selectedTeam.name}` : ''}
        perspective={selectedTeam ? { kind: 'team', teamId: selectedTeam.id } : null}
        matches={selectedTeam ? filteredMatches.filter(m => m.team1_id === selectedTeam.id || m.team2_id === selectedTeam.id) : []}
        players={players}
        currentUserId={currentUserId}
      />
    </div>
  );
};

export default TeamLeaderboard;
