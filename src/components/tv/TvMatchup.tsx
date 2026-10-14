import React from 'react';
import { Check, Star } from 'lucide-react';
import { Player, Prediction, Team } from '../../types';
import { TeamLogo } from '../TeamLogo';
import PlayerBadge from '../PlayerBadge';

const STATS: { label: string; key: 'overallRating' | 'attackRating' | 'midfieldRating' | 'defendRating' }[] = [
  { label: 'OVR', key: 'overallRating' },
  { label: 'ATT', key: 'attackRating' },
  { label: 'MID', key: 'midfieldRating' },
  { label: 'DEF', key: 'defendRating' },
];

const TeamSide: React.FC<{ team: Team }> = ({ team }) => (
  <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center">
    <TeamLogo team={team} size="lg" className="h-36! w-36! border-[3px]! text-4xl!" />
    <div className="w-full min-w-0">
      <p className="truncate text-4xl font-black uppercase leading-tight tracking-wide text-white" title={team.name}>
        {team.name}
      </p>
      <p className="mt-1 text-lg font-bold uppercase tracking-wide text-gray-400">{team.league}</p>
    </div>
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-1.5 text-2xl font-black text-white">
        <Star className="h-6 w-6 fill-(--color-green-bright) text-(--color-green-bright)" aria-hidden="true" />
        {team.rating.toFixed(1)}
      </span>
      <span className="bg-white px-3 py-1 text-2xl font-black tabular-nums text-(--color-ink)">OVR {team.overallRating}</span>
    </div>
  </div>
);

const StatBars: React.FC<{ team1: Team; team2: Team }> = ({ team1, team2 }) => (
  <div key={`${team1.id}|${team2.id}`} className="mx-auto w-full max-w-3xl space-y-2.5">
    {STATS.map(stat => {
      const v1 = team1[stat.key];
      const v2 = team2[stat.key];
      return (
        <div key={stat.label} className="flex items-center gap-3">
          <span className={`w-12 flex-none text-right text-2xl font-black tabular-nums ${v1 > v2 ? 'text-(--color-green-bright)' : 'text-gray-500'}`}>{v1}</span>
          <div className="flex flex-1 justify-end">
            <div className={`animate-bar-grow-left h-5 ${v1 > v2 ? 'bg-(--color-green-bright)' : 'bg-gray-600'}`} style={{ width: `${(v1 / 99) * 100}%` }} />
          </div>
          <span className="w-14 flex-none text-center text-lg font-black text-white">{stat.label}</span>
          <div className="flex flex-1 justify-start">
            <div className={`animate-bar-grow-right h-5 ${v2 > v1 ? 'bg-(--color-green-bright)' : 'bg-gray-600'}`} style={{ width: `${(v2 / 99) * 100}%` }} />
          </div>
          <span className={`w-12 flex-none text-left text-2xl font-black tabular-nums ${v2 > v1 ? 'text-(--color-green-bright)' : 'text-gray-500'}`}>{v2}</span>
        </div>
      );
    })}
  </div>
);

interface TvPredictionsProps {
  players: Player[];
  picks: Prediction[];
  revealed: boolean;
  team1: Team;
  team2: Team;
}

/** Same rule as the phones: picks stay hidden until everyone tonight has picked. */
const TvPredictions: React.FC<TvPredictionsProps> = ({ players, picks, revealed, team1, team2 }) => {
  const byPlayer = new Map(picks.map(p => [p.player_id, p]));
  return (
    <div className="border-t-2 border-gray-700 pt-4">
      <p className="mb-3 text-center text-sm font-black uppercase tracking-[0.3em] text-gray-400">
        Who wins? {revealed ? '· all picked' : `· ${byPlayer.size}/${players.length} picked`}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {players.map(player => {
          const pick = byPlayer.get(player.id);
          const team = pick ? (pick.predicted_winner === 1 ? team1 : team2) : null;
          const score = pick && pick.predicted_team1_score !== null && pick.predicted_team2_score !== null
            ? `${pick.predicted_team1_score}–${pick.predicted_team2_score}`
            : null;
          return (
            <div
              key={player.id}
              className={`flex min-w-44 items-center gap-2 border-2 bg-white px-3 py-2 text-(--color-ink) ${
                pick ? 'border-(--color-green-bright)' : 'border-dashed border-gray-400 opacity-50'
              }`}
            >
              <PlayerBadge player={player} size="md" className="text-lg font-black" />
              <span className="ml-auto flex items-center gap-1.5 text-base font-black uppercase">
                {!pick && '…'}
                {pick && !revealed && <Check className="h-5 w-5 text-(--color-green-mid)" strokeWidth={3} aria-label="picked" />}
                {pick && revealed && team && (
                  <>
                    <TeamLogo team={{ name: team.name, resolvedLogoUrl: team.resolvedLogoUrl, logoUrl: team.logoUrl }} size="sm" className="h-9! w-9!" />
                    {score && <span className="tabular-nums">{score}</span>}
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface TvMatchupProps {
  team1: Team;
  team2: Team;
  /** Tonight's players + their open picks for this matchup; omitted outside a game night. */
  predictions?: { players: Player[]; picks: Prediction[]; revealed: boolean };
}

const TvMatchup: React.FC<TvMatchupProps> = ({ team1, team2, predictions }) => (
  <div className="flex h-full flex-col justify-center gap-8">
    <div className="flex items-start gap-6">
      <TeamSide team={team1} />
      <div className="flex flex-none flex-col items-center pt-10">
        <span className="flex h-24 w-24 items-center justify-center border-[3px] border-white bg-(--color-green-bright) text-4xl font-black text-(--color-ink)">
          VS
        </span>
      </div>
      <TeamSide team={team2} />
    </div>
    <StatBars team1={team1} team2={team2} />
    {predictions && predictions.players.length > 0 && (
      <TvPredictions {...predictions} team1={team1} team2={team2} />
    )}
  </div>
);

export default TvMatchup;
