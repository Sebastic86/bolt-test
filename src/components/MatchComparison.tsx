import React from 'react';
import { Team } from '../types';
import { Card } from './ui';

interface MatchComparisonProps {
  team1: Team;
  team2: Team;
}

const STATS: { label: string; key: 'overallRating' | 'attackRating' | 'midfieldRating' | 'defendRating' }[] = [
  { label: 'OVR', key: 'overallRating' },
  { label: 'ATT', key: 'attackRating' },
  { label: 'MID', key: 'midfieldRating' },
  { label: 'DEF', key: 'defendRating' },
];

const MAX_STAT = 99;

const MatchComparison: React.FC<MatchComparisonProps> = ({ team1, team2 }) => {
  return (
    <Card hard className="mx-auto w-full max-w-md p-4">
      <div className="space-y-2.5">
        {STATS.map(stat => {
          const v1 = team1[stat.key];
          const v2 = team2[stat.key];
          const isHigher1 = v1 > v2;
          const isHigher2 = v2 > v1;
          const pct1 = (v1 / MAX_STAT) * 100;
          const pct2 = (v2 / MAX_STAT) * 100;

          return (
            <div key={stat.label} className="flex items-center gap-1.5">
              <span className={`w-6 flex-none text-right text-xs font-black tabular-nums ${isHigher1 ? 'text-(--color-green-mid)' : 'text-gray-400'}`}>
                {v1}
              </span>
              <div className="flex flex-1 items-center gap-0.5">
                <div className="flex flex-1 justify-end">
                  <div className={`h-4 ${isHigher1 ? 'bg-(--color-green-mid)' : 'bg-gray-200'}`} style={{ width: `${pct1}%` }} />
                </div>
                <span className="w-8 flex-none text-center text-[10px] font-black text-(--color-ink)">
                  {stat.label}
                </span>
                <div className="flex flex-1 justify-start">
                  <div className={`h-4 ${isHigher2 ? 'bg-(--color-green-mid)' : 'bg-gray-200'}`} style={{ width: `${pct2}%` }} />
                </div>
              </div>
              <span className={`w-6 flex-none text-left text-xs font-black tabular-nums ${isHigher2 ? 'text-(--color-green-mid)' : 'text-gray-400'}`}>
                {v2}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default MatchComparison;
