import React, { useState } from 'react';
import { EXACT_SCORE_BONUS, PredictionLeaderboardLine, WINNER_POINTS } from '../../utils/predictionStats';
import { SegmentedControl } from '../stats/SegmentedControl';

interface PredictionLeaderboardProps {
  tonight: PredictionLeaderboardLine[];
  season: PredictionLeaderboardLine[];
}

type Scope = 'tonight' | 'season';
const GRID = 'grid grid-cols-[1.5rem_minmax(0,1fr)_2.5rem_2.75rem_3rem] items-center gap-1';

const PredictionLeaderboard: React.FC<PredictionLeaderboardProps> = ({ tonight, season }) => {
  const [scope, setScope] = useState<Scope>('tonight');
  const lines = scope === 'tonight' ? tonight : season;

  return (
    <div>
      <SegmentedControl<Scope>
        ariaLabel="Prediction leaderboard period"
        className="mb-2"
        value={scope}
        onChange={setScope}
        options={[{ value: 'tonight', label: 'Tonight' }, { value: 'season', label: 'All nights' }]}
      />
      {lines.length === 0 ? (
        <p className="py-3 text-center text-sm text-gray-500">
          {scope === 'tonight' ? 'No settled predictions tonight yet.' : 'No settled predictions yet.'}
        </p>
      ) : (
        <div className="border-2 border-(--color-ink) bg-white">
          <div className={`${GRID} bg-(--color-ink) px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white`}>
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Exact</span>
            <span className="text-right">Acc</span>
            <span className="text-right text-(--color-green-bright)">Pts</span>
          </div>
          {lines.map((line, i) => (
            <div key={line.playerId} className={`${GRID} min-h-11 border-t border-gray-200 px-2`}>
              <span
                className={`flex h-5 w-5 items-center justify-center text-[11px] font-black text-white ${i === 0 ? 'bg-(--color-green-bright)' : 'bg-(--color-ink)'}`}
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black uppercase text-(--color-ink)">{line.playerName}</span>
                <span className="block text-[10px] text-gray-500 tabular-nums">{line.correct}/{line.settled} correct</span>
              </span>
              <span className="text-right text-sm font-black tabular-nums">{line.exact}</span>
              <span className="text-right text-sm font-black tabular-nums">{Math.round(line.accuracy * 100)}%</span>
              <span className="text-right text-base font-black tabular-nums text-(--color-green-mid)">{line.points}</span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-1.5 text-center text-[10px] uppercase tracking-wide text-gray-400">
        {WINNER_POINTS} pt right winner · +{EXACT_SCORE_BONUS} exact score
      </p>
    </div>
  );
};

export default PredictionLeaderboard;
