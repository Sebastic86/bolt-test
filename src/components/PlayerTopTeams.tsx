import React, { useMemo, useState } from 'react';
import { MatchHistoryItem, Player, Team } from '../types';
import { calculatePlayerTopTeams } from '../utils/playerTopTeamsUtils';
import { ALL_VERSIONS, filterMatchesByVersion, getAvailableVersions } from '../utils/versionFilter';
import { TeamLogo } from './TeamLogo';
import PlayerBadge from './PlayerBadge';
import { VersionFilter } from './stats/VersionFilter';
import { LoadingState, ErrorState } from './ui';

interface PlayerTopTeamsProps {
  players: Player[];
  allMatches: MatchHistoryItem[];
  teams: Team[];
  loading: boolean;
  error: string | null;
}

const RANK_STYLES = ['border-yellow-300 bg-yellow-50', 'border-gray-300 bg-gray-50', 'border-orange-300 bg-orange-50'];

const PlayerTopTeams: React.FC<PlayerTopTeamsProps> = ({ players, allMatches, teams, loading, error }) => {
  const [selectedVersion, setSelectedVersion] = useState(ALL_VERSIONS);

  const availableVersions = useMemo(() => getAvailableVersions(teams, allMatches), [teams, allMatches]);
  const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);
  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);

  const filteredMatches = useMemo(
    () => filterMatchesByVersion(allMatches, selectedVersion),
    [selectedVersion, allMatches]
  );

  const playerTopTeams = useMemo(
    () => calculatePlayerTopTeams(players, filteredMatches, teams),
    [players, filteredMatches, teams]
  );

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

      {loading && playerTopTeams.length === 0 && <LoadingState label="Calculating top teams..." />}
      {error && <ErrorState message={error} />}
      {!loading && !error && playerTopTeams.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-500">No completed matches for this version yet.</p>
      )}

      {playerTopTeams.length > 0 && (
        <div className="space-y-2.5">
          {playerTopTeams.map(playerStat => (
            <div key={playerStat.playerId} className="border-2 border-(--color-ink) bg-white p-2.5">
              <div className="mb-2 border-b-2 border-(--color-ink) pb-2">
                <PlayerBadge
                  player={{
                    id: playerStat.playerId,
                    name: playerStat.playerName,
                    avatar_url: playerMap.get(playerStat.playerId)?.avatar_url ?? null,
                  }}
                  size="md"
                  className="max-w-full uppercase tracking-wide"
                />
              </div>
              <div className="space-y-1.5">
                {playerStat.topTeams.map((team, index) => (
                  <div key={team.teamId} className={`flex items-center gap-2 border p-1.5 ${RANK_STYLES[index] ?? 'border-gray-200 bg-gray-50'}`}>
                    <span className="w-5 flex-none text-center text-xs font-black text-gray-500">#{index + 1}</span>
                    <TeamLogo
                      team={teamMap.get(team.teamId) ?? { id: team.teamId, name: team.teamName, logoUrl: team.logoUrl }}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-(--color-ink)">{team.teamName}</p>
                      <p className="text-[11px] text-gray-500">
                        <span className="font-semibold">{team.wins}</span>W &middot; <span className="font-semibold">{team.goals}</span>G &middot; {team.matchesPlayed}M
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-2.5 text-center text-[10px] uppercase tracking-wide text-gray-400">
        Top 3 teams per player, ranked by wins then goals scored &middot; W wins &middot; G goals &middot; M matches played
      </p>
    </div>
  );
};

export default PlayerTopTeams;
