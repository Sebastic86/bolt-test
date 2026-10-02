import React, { useMemo } from 'react';
import { MatchHistoryItem, Player } from '../types';
import { calculatePlayerPairStandings } from '../utils/playerPairStatsUtils';
import PlayerBadge from './PlayerBadge';
import { LoadingState, ErrorState } from './ui';

interface PlayerWinMatrixProps {
  players: Player[];
  allMatches: MatchHistoryItem[];
  loading: boolean;
  error: string | null;
}

const colorClass = (winPercentage: number): string => {
  if (winPercentage >= 70) return 'text-(--color-green-mid)';
  if (winPercentage >= 50) return 'text-yellow-600';
  if (winPercentage >= 30) return 'text-orange-600';
  return 'text-red-600';
};

/**
 * Head-to-head "when these two are teammates" win record. The old app
 * rendered this as an N×N matrix table — unusable on a phone without
 * constant horizontal scrolling. Same underlying stat (calculatePlayerPairStandings),
 * presented as a sorted list of pair cards instead.
 */
const PlayerWinMatrix: React.FC<PlayerWinMatrixProps> = ({ players, allMatches, loading, error }) => {
  const pairs = useMemo(() => calculatePlayerPairStandings(players, allMatches), [players, allMatches]);

  return (
    <div>
      {loading && pairs.length === 0 && <LoadingState label="Calculating head-to-head stats..." />}
      {error && <ErrorState message={error} />}
      {!loading && !error && pairs.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-500">No players have shared a team yet.</p>
      )}

      {pairs.length > 0 && (
        <div className="space-y-2">
          {pairs.map(pair => (
            <div key={`${pair.player1.id}-${pair.player2.id}`} className="flex items-center gap-2 border-2 border-(--color-ink) bg-white p-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <PlayerBadge player={pair.player1} size="xs" />
                  <span className="flex-none text-[10px] font-black text-gray-400">+</span>
                  <PlayerBadge player={pair.player2} size="xs" />
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {pair.wins}W-{pair.losses}L &middot; {pair.totalMatches} together
                </div>
              </div>
              <div className={`flex-none text-lg font-black tabular-nums ${colorClass(pair.winPercentage)}`}>
                {pair.winPercentage.toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-2.5 text-center text-[10px] uppercase tracking-wide text-gray-400">
        Win % when both players are on the same team
      </p>
    </div>
  );
};

export default PlayerWinMatrix;
