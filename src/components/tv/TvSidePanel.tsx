import React from 'react';
import { MatchHistoryItem, Player } from '../../types';
import { NightPlayerLine, getMatchWinner } from '../../utils/nightStats';
import { formatGoalDifference } from '../../utils/recapData';
import PlayerBadge from '../PlayerBadge';
import { TeamLogo } from '../TeamLogo';

const GRID = 'grid grid-cols-[2rem_minmax(0,1fr)_2.5rem_2.5rem_2.5rem_3rem_3.5rem] items-center gap-2';

export const TvTable: React.FC<{ title: string; table: NightPlayerLine[]; players: Player[] }> = ({ title, table, players }) => {
  const playerMap = new Map(players.map(p => [p.id, p]));
  return (
    <section aria-label={title}>
      <h2 className="mb-2 text-sm font-black uppercase tracking-[0.3em] text-gray-400">{title}</h2>
      {table.length === 0 ? (
        <p className="border-2 border-gray-700 p-4 text-center text-lg font-bold text-gray-500">No scored matches yet.</p>
      ) : (
        <div className="border-2 border-white bg-white text-(--color-ink)">
          <div className={`${GRID} bg-(--color-ink) px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white`}>
            <span>#</span>
            <span>Player</span>
            <span className="text-right">P</span>
            <span className="text-right">W</span>
            <span className="text-right">L</span>
            <span className="text-right">GD</span>
            <span className="text-right text-(--color-green-bright)">Pts</span>
          </div>
          {table.map((line, i) => {
            const player = playerMap.get(line.playerId) ?? { id: line.playerId, name: line.playerName };
            return (
              <div key={line.playerId} className={`${GRID} min-h-12 border-t border-gray-200 px-3 ${i === 0 ? 'bg-green-50' : ''}`}>
                <span className={`flex h-7 w-7 items-center justify-center text-sm font-black text-white ${i === 0 ? 'bg-(--color-green-mid)' : 'bg-(--color-ink)'}`}>
                  {i + 1}
                </span>
                <PlayerBadge player={player} size="md" className="max-w-full text-lg font-black uppercase tracking-wide" />
                <span className="text-right text-lg font-bold tabular-nums text-gray-500">{line.matchesPlayed}</span>
                <span className="text-right text-lg font-bold tabular-nums">{line.wins}</span>
                <span className="text-right text-lg font-bold tabular-nums">{line.losses}</span>
                <span className="text-right text-lg font-bold tabular-nums">{formatGoalDifference(line.goalDifference)}</span>
                <span className="text-right text-2xl font-black tabular-nums">{line.points}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export const TvLatestResults: React.FC<{ matches: MatchHistoryItem[] }> = ({ matches }) => (
  <section aria-label="Latest results">
    <h2 className="mb-2 text-sm font-black uppercase tracking-[0.3em] text-gray-400">Latest results</h2>
    {matches.length === 0 ? (
      <p className="border-2 border-gray-700 p-4 text-center text-lg font-bold text-gray-500">Nothing played yet.</p>
    ) : (
      <ul className="space-y-2">
        {matches.map(match => {
          const winner = getMatchWinner(match);
          const pens = match.team1_score !== null && match.team1_score === match.team2_score && match.penalties_winner;
          const sides = [
            { side: 1, name: match.team1_name, crest: { name: match.team1_name, resolvedLogoUrl: match.team1_resolvedLogoUrl, logoUrl: match.team1_logoUrl }, score: match.team1_score, players: match.team1_players },
            { side: 2, name: match.team2_name, crest: { name: match.team2_name, resolvedLogoUrl: match.team2_resolvedLogoUrl, logoUrl: match.team2_logoUrl }, score: match.team2_score, players: match.team2_players },
          ];
          return (
            <li key={match.id} className="border-2 border-gray-700 px-3 py-2">
              {sides.map(s => (
                <div key={s.side} className="flex items-center gap-2.5 py-0.5">
                  <TeamLogo team={s.crest} size="sm" />
                  <span className={`min-w-0 flex-1 truncate text-lg font-black uppercase ${winner === s.side ? 'text-white' : 'text-gray-400'}`}>
                    {s.name}
                    <span className="ml-2 text-sm font-bold normal-case text-gray-500">{s.players.map(p => p.name).join(', ')}</span>
                  </span>
                  <span className={`text-2xl font-black tabular-nums ${winner === s.side ? 'text-(--color-green-bright)' : 'text-gray-400'}`}>
                    {s.score ?? '–'}
                  </span>
                </div>
              ))}
              {pens && (
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Won on penalties: {match.penalties_winner === 1 ? match.team1_name : match.team2_name}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    )}
  </section>
);
