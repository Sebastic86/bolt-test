import React from 'react';
import { Player } from '../../types';
import { NightPlayerLine } from '../../utils/nightStats';
import { formatGoalDifference } from '../../utils/recapData';
import PlayerBadge from '../PlayerBadge';

interface NightTableProps {
  table: NightPlayerLine[];
  players: Player[];
}

const GRID = 'grid grid-cols-[1.5rem_minmax(0,1fr)_2rem_2rem_2.5rem_2.5rem] items-center gap-1';

/** Compact live table (W, L, GD, Pts) — fits a 390px phone without horizontal scroll. */
const NightTable: React.FC<NightTableProps> = ({ table, players }) => {
  if (table.length === 0) {
    return <p className="py-3 text-center text-sm text-gray-500">No scored matches yet tonight.</p>;
  }
  const playerMap = new Map(players.map(p => [p.id, p]));

  return (
    <div className="border-2 border-(--color-ink) bg-white">
      <div className={`${GRID} bg-(--color-ink) px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white`}>
        <span>#</span>
        <span>Player</span>
        <span className="text-right">W</span>
        <span className="text-right">L</span>
        <span className="text-right">GD</span>
        <span className="text-right text-(--color-green-bright)">Pts</span>
      </div>
      {table.map((line, i) => {
        const player = playerMap.get(line.playerId) ?? { id: line.playerId, name: line.playerName };
        return (
          <div key={line.playerId} className={`${GRID} min-h-11 border-t border-gray-200 px-2`}>
            <span
              className={`flex h-5 w-5 items-center justify-center text-[11px] font-black text-white ${i === 0 ? 'bg-(--color-green-bright)' : 'bg-(--color-ink)'}`}
            >
              {i + 1}
            </span>
            <PlayerBadge player={player} size="sm" className="max-w-full uppercase tracking-wide" />
            <span className="text-right text-sm font-black tabular-nums">{line.wins}</span>
            <span className="text-right text-sm font-black tabular-nums">{line.losses}</span>
            <span className="text-right text-sm font-black tabular-nums">{formatGoalDifference(line.goalDifference)}</span>
            <span className="text-right text-base font-black tabular-nums text-(--color-green-mid)">{line.points}</span>
          </div>
        );
      })}
    </div>
  );
};

export default NightTable;
