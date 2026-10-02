import React, { useMemo, useState } from 'react';
import { MatchHistoryItem, Player, Team } from '../types';
import { calculatePlayerTopTeams } from '../utils/playerTopTeamsUtils';
import { TeamBadge } from './TeamBadge';
import PlayerBadge from './PlayerBadge';
import { LoadingState, ErrorState, Select } from './ui';

interface PlayerTopTeamsProps {
  players: Player[];
  allMatches: MatchHistoryItem[];
  teams: Team[];
  loading: boolean;
  error: string | null;
}

const RANK_STYLES = ['border-yellow-300 bg-yellow-50', 'border-gray-300 bg-gray-50', 'border-orange-300 bg-orange-50'];

const PlayerTopTeams: React.FC<PlayerTopTeamsProps> = ({ players, allMatches, teams, loading, error }) => {
  const [selectedVersion, setSelectedVersion] = useState('All');

  const availableVersions = useMemo(
    () => Array.from(new Set(teams.map(t => t.version))).sort(),
    [teams]
  );

  const filteredMatches = useMemo(() => {
    if (selectedVersion === 'All') return allMatches;
    return allMatches.filter(m => m.team1_version === selectedVersion && m.team2_version === selectedVersion);
  }, [selectedVersion, allMatches]);

  const playerTopTeams = useMemo(
    () => calculatePlayerTopTeams(players, filteredMatches, teams),
    [players, filteredMatches, teams]
  );

  return (
    <div>
      <div className="mb-2.5 flex justify-end">
        <Select value={selectedVersion} onChange={e => setSelectedVersion(e.target.value)} className="w-auto" aria-label="Filter by version">
          <option value="All">All Versions</option>
          {availableVersions.map(v => <option key={v} value={v}>{v}</option>)}
        </Select>
      </div>

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
                <PlayerBadge player={{ id: playerStat.playerId, name: playerStat.playerName }} size="md" />
              </div>
              <div className="space-y-1.5">
                {playerStat.topTeams.map((team, index) => (
                  <div key={team.teamId} className={`flex items-center gap-2 border p-1.5 ${RANK_STYLES[index] ?? 'border-gray-200 bg-gray-50'}`}>
                    <span className="w-5 flex-none text-center text-xs font-black text-gray-500">#{index + 1}</span>
                    <TeamBadge name={team.teamName} size="sm" />
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
        Top 3 teams per player, ranked by wins then goals scored
      </p>
    </div>
  );
};

export default PlayerTopTeams;
