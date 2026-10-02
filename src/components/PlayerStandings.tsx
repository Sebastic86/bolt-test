import React, { useMemo, useState } from 'react';
import { MatchHistoryItem, Player, PlayerStanding, Team } from '../types';
import { calculateStandings } from '../utils/standingsUtils';
import MatchDetailsSheet from './MatchDetailsSheet';
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

function StandingRow({ standing, rank, onViewMatches }: { standing: PlayerStanding; rank: number; onViewMatches: (standing: PlayerStanding) => void }) {
  const [expanded, setExpanded] = useState(false);
  const winRate = standing.matchesPlayed > 0 ? ((standing.points / standing.matchesPlayed) * 100) : 0;
  const avgOvr = standing.matchesPlayed > 0 ? (standing.totalOverallRating / standing.matchesPlayed) : 0;
  const initial = standing.playerName.charAt(0).toUpperCase() || '?';

  return (
    <div
      className="flex cursor-pointer flex-wrap items-center gap-2.5 border-2 border-(--color-ink) bg-white p-3"
      onClick={() => setExpanded(e => !e)}
    >
      <div
        className="flex h-6 w-6 flex-none items-center justify-center text-xs font-black text-white"
        style={{ background: rank === 1 ? MEDAL_GREEN : '#111111' }}
      >
        {rank}
      </div>
      <div className="flex h-8 w-8 flex-none items-center justify-center border border-(--color-ink) bg-gray-100 text-xs font-black text-(--color-ink)">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-black uppercase tracking-wide text-(--color-ink)">
          {standing.playerName}
        </div>
        <div className="text-xs text-gray-500">
          Win {winRate.toFixed(1)}% &middot; {standing.matchesPlayed} played
        </div>
      </div>
      <div className="flex-none text-right">
        <div className="text-lg font-black tabular-nums text-(--color-green-mid)">{standing.points}</div>
        <div className="text-[9px] font-black uppercase tracking-wide text-gray-400">Pts</div>
      </div>

      {expanded && (
        <div className="w-full border-t-2 border-(--color-ink) pt-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            <StatChip label="GF" value={standing.goalsFor} />
            <StatChip label="GA" value={standing.goalsAgainst} />
            <StatChip label="GD" value={standing.goalDifference >= 0 ? `+${standing.goalDifference}` : standing.goalDifference} />
            <StatChip label="MP" value={standing.matchesPlayed} />
            <StatChip label="Win%" value={`${winRate.toFixed(1)}%`} />
            <StatChip label="Avg OVR" value={standing.matchesPlayed > 0 ? avgOvr.toFixed(1) : '-'} />
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onViewMatches(standing); }}
            className="mt-2 w-full border-2 border-(--color-ink) bg-white py-1.5 text-xs font-bold uppercase tracking-wide text-(--color-ink)"
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
  const [tab, setTab] = useState<'today' | 'overall'>('today');
  const [selectedStanding, setSelectedStanding] = useState<PlayerStanding | null>(null);

  const todayStandings = useMemo(
    () => calculateStandings(matchesToday, players, teams).filter(s => s.matchesPlayed > 0),
    [matchesToday, players, teams]
  );
  const overallStandings = useMemo(
    () => calculateStandings(allMatches, players, teams).filter(s => s.matchesPlayed > 0),
    [allMatches, players, teams]
  );

  const activeStandings = tab === 'today' ? todayStandings : overallStandings;
  const activeMatches = tab === 'today' ? matchesToday : allMatches;
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
      <div className="mb-2.5 flex border border-(--color-ink)">
        <button
          onClick={() => setTab('today')}
          className={`flex-1 py-2 text-xs font-black uppercase tracking-wide ${tab === 'today' ? 'bg-(--color-green-deep) text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Today
        </button>
        <button
          onClick={() => setTab('overall')}
          className={`flex-1 py-2 text-xs font-black uppercase tracking-wide ${tab === 'overall' ? 'bg-(--color-green-deep) text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Overall
        </button>
      </div>

      {loading && activeStandings.length === 0 && <LoadingState label="Calculating standings..." />}
      {error && <ErrorState message={error} />}
      {!loading && !error && activeStandings.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-500">No completed matches yet.</p>
      )}

      {activeStandings.length > 0 && (
        <div className="space-y-2.5">
          {activeStandings.map((standing, index) => (
            <StandingRow key={standing.playerId} standing={standing} rank={index + 1} onViewMatches={setSelectedStanding} />
          ))}
        </div>
      )}

      <p className="mt-2.5 text-center text-[10px] uppercase tracking-wide text-gray-400">
        Pts points &middot; GF/GA goals for/against &middot; GD goal difference &middot; MP matches played &middot; tap a player for full stats
      </p>

      <MatchDetailsSheet
        isOpen={selectedStanding !== null}
        onClose={() => setSelectedStanding(null)}
        title={selectedStanding ? `Matches — ${selectedStanding.playerName}` : ''}
        matches={selectedPlayerMatches}
        players={players}
        currentUserId={currentUserId}
      />
    </div>
  );
};

export default PlayerStandings;
