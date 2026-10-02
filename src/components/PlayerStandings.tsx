import React, { useMemo, useState } from 'react';
import { MatchHistoryItem, Player, PlayerStanding, Team } from '../types';
import { calculateStandings, partitionStandingsByPlayed } from '../utils/standingsUtils';
import { ALL_VERSIONS, filterMatchesByVersion, getAvailableVersions } from '../utils/versionFilter';
import MatchDetailsSheet from './MatchDetailsSheet';
import PlayerBadge from './PlayerBadge';
import { SegmentedControl } from './stats/SegmentedControl';
import { VersionFilter } from './stats/VersionFilter';
import { LoadingState, ErrorState } from './ui';

interface PlayerStandingsProps {
  matchesToday: MatchHistoryItem[];
  allMatches: MatchHistoryItem[];
  players: Player[];
  teams: Team[];
  loadingToday: boolean;
  loadingAll: boolean;
  errorToday: string | null;
  errorAll: string | null;
  currentUserId?: string;
}

const MEDAL_GREEN = '#22c55e';

type Tab = 'today' | 'overall';

interface StandingRowProps {
  standing: PlayerStanding;
  player: Player | undefined;
  /** null for players with no matches — shown unranked. */
  rank: number | null;
  onViewMatches: (standing: PlayerStanding) => void;
}

function StandingRow({ standing, player, rank, onViewMatches }: StandingRowProps) {
  const [expanded, setExpanded] = useState(false);
  const played = standing.matchesPlayed > 0;
  const winRate = played ? (standing.points / standing.matchesPlayed) * 100 : 0;
  const avgOvr = played ? standing.totalOverallRating / standing.matchesPlayed : 0;
  const gd = standing.goalDifference >= 0 ? `+${standing.goalDifference}` : `${standing.goalDifference}`;
  const badgePlayer = { id: standing.playerId, name: standing.playerName, avatar_url: player?.avatar_url ?? null };

  if (!played) {
    return (
      <div className="flex min-h-12 items-center gap-2.5 border-2 border-dashed border-gray-300 bg-white p-2.5 opacity-70">
        <div className="flex h-6 w-6 flex-none items-center justify-center bg-gray-200 text-xs font-black text-gray-500">–</div>
        <div className="min-w-0 flex-1">
          <PlayerBadge player={badgePlayer} size="md" className="max-w-full uppercase tracking-wide" />
        </div>
        <div className="flex-none text-[10px] font-black uppercase tracking-wide text-gray-400">No matches</div>
      </div>
    );
  }

  return (
    <div className="border-2 border-(--color-ink) bg-white">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(e => !e)}
        className="flex min-h-12 w-full items-center gap-2.5 p-3 text-left"
      >
        <div
          className="flex h-6 w-6 flex-none items-center justify-center text-xs font-black text-white"
          style={{ background: rank === 1 ? MEDAL_GREEN : '#111111' }}
        >
          {rank}
        </div>
        <div className="min-w-0 flex-1">
          <PlayerBadge player={badgePlayer} size="md" className="max-w-full uppercase tracking-wide" />
          <div className="mt-0.5 text-xs text-gray-500">
            Win {winRate.toFixed(1)}% &middot; {standing.matchesPlayed} played &middot; GD {gd}
          </div>
        </div>
        <div className="flex-none text-right">
          <div className="text-lg font-black tabular-nums text-(--color-green-mid)">{standing.points}</div>
          <div className="text-[9px] font-black uppercase tracking-wide text-gray-400">Pts</div>
        </div>
      </button>

      {expanded && (
        <div className="border-t-2 border-(--color-ink) p-3 pt-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            <StatChip label="GF" value={standing.goalsFor} />
            <StatChip label="GA" value={standing.goalsAgainst} />
            <StatChip label="GD" value={gd} />
            <StatChip label="MP" value={standing.matchesPlayed} />
            <StatChip label="Win%" value={`${winRate.toFixed(1)}%`} />
            <StatChip label="Avg OVR" value={avgOvr.toFixed(1)} />
          </div>
          <button
            type="button"
            onClick={() => onViewMatches(standing)}
            className="mt-2 min-h-10 w-full border-2 border-(--color-ink) bg-white text-xs font-bold uppercase tracking-wide text-(--color-ink)"
          >
            View Matches
          </button>
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-gray-200 bg-gray-50 py-1 text-center">
      <div className="text-sm font-black tabular-nums text-(--color-ink)">{value}</div>
      <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

const PlayerStandings: React.FC<PlayerStandingsProps> = ({
  matchesToday,
  allMatches,
  players,
  teams,
  loadingToday,
  loadingAll,
  errorToday,
  errorAll,
  currentUserId,
}) => {
  const [tab, setTab] = useState<Tab>('today');
  const [selectedVersion, setSelectedVersion] = useState(ALL_VERSIONS);
  const [selectedStanding, setSelectedStanding] = useState<PlayerStanding | null>(null);

  const availableVersions = useMemo(() => getAvailableVersions(teams, allMatches), [teams, allMatches]);
  const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

  // Version filter applies to the Overall tab only (as in the old app).
  const overallMatches = useMemo(
    () => filterMatchesByVersion(allMatches, selectedVersion),
    [allMatches, selectedVersion]
  );

  const todayStandings = useMemo(
    () => calculateStandings(matchesToday, players, teams).filter(s => s.matchesPlayed > 0),
    [matchesToday, players, teams]
  );
  // Overall keeps players with no matches (old app listed every player),
  // shown unranked below the table.
  const overall = useMemo(
    () => partitionStandingsByPlayed(calculateStandings(overallMatches, players, teams)),
    [overallMatches, players, teams]
  );

  const activeStandings = tab === 'today' ? todayStandings : overall.played;
  const unplayed = tab === 'overall' ? overall.unplayed : [];
  const activeMatches = tab === 'today' ? matchesToday : overallMatches;
  const loading = tab === 'today' ? loadingToday : loadingAll;
  const error = tab === 'today' ? errorToday : errorAll;

  const selectedPlayerMatches = useMemo(() => {
    if (!selectedStanding) return [];
    return activeMatches.filter(m =>
      m.team1_players.some(p => p.id === selectedStanding.playerId)
      || m.team2_players.some(p => p.id === selectedStanding.playerId)
    );
  }, [activeMatches, selectedStanding]);

  return (
    <div>
      <SegmentedControl<Tab>
        ariaLabel="Standings period"
        className="mb-2.5"
        value={tab}
        onChange={setTab}
        options={[{ value: 'today', label: 'Today' }, { value: 'overall', label: 'Overall' }]}
      />

      {tab === 'overall' && availableVersions.length > 0 && (
        <VersionFilter
          className="mb-2.5"
          versions={availableVersions}
          value={selectedVersion}
          onChange={setSelectedVersion}
        />
      )}

      {loading && activeStandings.length === 0 && <LoadingState label="Calculating standings..." />}
      {error && <ErrorState message={error} />}
      {!loading && !error && activeStandings.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-500">
          {tab === 'overall' && selectedVersion !== ALL_VERSIONS
            ? `No completed ${selectedVersion} matches yet.`
            : 'No completed matches yet.'}
        </p>
      )}

      {activeStandings.length > 0 && (
        <div className="space-y-2.5">
          {activeStandings.map((standing, index) => (
            <StandingRow
              key={standing.playerId}
              standing={standing}
              player={playerMap.get(standing.playerId)}
              rank={index + 1}
              onViewMatches={setSelectedStanding}
            />
          ))}
        </div>
      )}

      {!loading && !error && unplayed.length > 0 && (
        <div className="mt-2.5 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Yet to play</p>
          {unplayed.map(standing => (
            <StandingRow
              key={standing.playerId}
              standing={standing}
              player={playerMap.get(standing.playerId)}
              rank={null}
              onViewMatches={setSelectedStanding}
            />
          ))}
        </div>
      )}

      <p className="mt-2.5 text-center text-[10px] uppercase tracking-wide text-gray-400">
        Pts points (1 per win, incl. penalties) &middot; GF/GA goals for/against &middot; GD goal difference &middot;
        MP matches played &middot; Avg OVR average team rating &middot; sorted by Pts, GD, GF &middot; tap a player for full stats
      </p>

      <MatchDetailsSheet
        isOpen={selectedStanding !== null}
        onClose={() => setSelectedStanding(null)}
        title={selectedStanding ? `Matches — ${selectedStanding.playerName}` : ''}
        perspective={selectedStanding ? { kind: 'player', playerId: selectedStanding.playerId } : null}
        matches={selectedPlayerMatches}
        players={players}
        currentUserId={currentUserId}
      />
    </div>
  );
};

export default PlayerStandings;
