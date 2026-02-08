import React, { useState, useEffect } from 'react';
import { Team } from '../types';

interface MatchComparisonProps {
  team1: Team;
  team2: Team;
}

interface StatRow {
  label: string;
  value1: number;
  value2: number;
}

const MatchComparison: React.FC<MatchComparisonProps> = ({ team1, team2 }) => {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(false);
    const timer = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimate(true);
      });
    });
    return () => cancelAnimationFrame(timer);
  }, [team1.id, team2.id]);

  const stats: StatRow[] = [
    { label: 'OVR', value1: team1.overallRating, value2: team2.overallRating },
    { label: 'ATT', value1: team1.attackRating, value2: team2.attackRating },
    { label: 'MID', value1: team1.midfieldRating, value2: team2.midfieldRating },
    { label: 'DEF', value1: team1.defendRating, value2: team2.defendRating },
  ];

  const maxStat = 99;

  return (
    <div className="w-full max-w-md mx-auto mt-4 bg-white/80 backdrop-blur-sm rounded-lg p-4 shadow-sm border border-brand-light">
      <div className="space-y-3">
        {stats.map((stat) => {
          const pct1 = (stat.value1 / maxStat) * 100;
          const pct2 = (stat.value2 / maxStat) * 100;
          const isHigher1 = stat.value1 > stat.value2;
          const isHigher2 = stat.value2 > stat.value1;
          const isEqual = stat.value1 === stat.value2;

          return (
            <div key={stat.label} className="flex items-center gap-2">
              {/* Team 1 value */}
              <span className={`text-xs font-bold w-7 text-right ${isHigher1 ? 'text-brand-dark' : isEqual ? 'text-gray-500' : 'text-gray-400'}`}>
                {stat.value1}
              </span>

              {/* Bars container */}
              <div className="flex-1 flex items-center gap-0.5">
                {/* Team 1 bar (grows right to left) */}
                <div className="flex-1 flex justify-end">
                  <div
                    className={`h-5 rounded-l-sm transition-all duration-700 ease-out ${
                      isHigher1 ? 'bg-brand-medium' : isEqual ? 'bg-gray-300' : 'bg-gray-200'
                    }`}
                    style={{ width: animate ? `${pct1}%` : '0%' }}
                  />
                </div>

                {/* Label */}
                <span className="text-[10px] font-bold text-gray-600 w-8 text-center shrink-0">
                  {stat.label}
                </span>

                {/* Team 2 bar (grows left to right) */}
                <div className="flex-1 flex justify-start">
                  <div
                    className={`h-5 rounded-r-sm transition-all duration-700 ease-out ${
                      isHigher2 ? 'bg-brand-medium' : isEqual ? 'bg-gray-300' : 'bg-gray-200'
                    }`}
                    style={{ width: animate ? `${pct2}%` : '0%' }}
                  />
                </div>
              </div>

              {/* Team 2 value */}
              <span className={`text-xs font-bold w-7 text-left ${isHigher2 ? 'text-brand-dark' : isEqual ? 'text-gray-500' : 'text-gray-400'}`}>
                {stat.value2}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MatchComparison;
