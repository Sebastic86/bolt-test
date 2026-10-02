import React, { useMemo } from 'react';
import { ChevronRight, Trophy } from 'lucide-react';
import { GameNight, MatchHistoryItem, Player, Team } from '../../types';
import { calculateNightSummary, getNightMatches, getNightNumber } from '../../utils/nightStats';
import { formatNightTitle, formatRecapDate } from '../../utils/recapData';

interface PastNightsProps {
  /** Every night (active included) — needed for consistent numbering. */
  nights: GameNight[];
  allMatches: MatchHistoryItem[];
  players: Player[];
  teams: Team[];
  onOpen: (night: GameNight) => void;
}

const PastNights: React.FC<PastNightsProps> = ({ nights, allMatches, players, teams, onOpen }) => {
  const rows = useMemo(
    () => nights
      .filter(n => n.ended_at !== null)
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
      .map(night => {
        const matches = getNightMatches(allMatches, night.id);
        const summary = calculateNightSummary(matches, players, teams);
        return {
          night,
          title: formatNightTitle(night.version, getNightNumber(nights, night.id)),
          date: formatRecapDate(night.started_at),
          matchCount: matches.length,
          potn: summary.playerOfTheNightName,
        };
      }),
    [nights, allMatches, players, teams]
  );

  if (rows.length === 0) {
    return <p className="py-3 text-center text-sm text-gray-500">No finished nights yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {rows.map(row => (
        <li key={row.night.id}>
          <button
            type="button"
            onClick={() => onOpen(row.night)}
            className="flex min-h-14 w-full items-center gap-3 border-2 border-(--color-ink) bg-white p-3 text-left"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black uppercase tracking-wide text-(--color-ink)">{row.title}</p>
              <p className="truncate text-xs text-gray-500">
                {row.date} · <span className="tabular-nums">{row.matchCount}</span> match{row.matchCount === 1 ? '' : 'es'}
              </p>
              {row.potn && (
                <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs font-bold uppercase text-(--color-green-mid)">
                  <Trophy className="h-3.5 w-3.5 flex-none" />
                  <span className="truncate">{row.potn}</span>
                </p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 flex-none text-(--color-ink)" />
          </button>
        </li>
      ))}
    </ul>
  );
};

export default PastNights;
