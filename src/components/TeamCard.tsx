import React from 'react';
import { Pencil, RefreshCw, Star } from 'lucide-react';
import { Team } from '../types';
import { TeamLogo } from './TeamLogo';
import { Card } from './ui';
import { AdminOnly } from './RoleBasedComponents';
import { ratingTier } from '../utils/ratingTier';
import { formatStatDifference, StatDifferences } from '../utils/matchDisplay';

interface TeamCardProps {
  team: Team;
  /** This team's rating minus the opponent's, per stat — rendered as +n / −n under each value. */
  differences?: StatDifferences;
  onEdit?: () => void;
  /** Admin: compare this team with SoFIFA (opens TeamDataCheckSheet). */
  onCheckData?: () => void;
}

const diffColor = (diff: number) =>
  diff > 0 ? 'text-(--color-green-mid)' : diff < 0 ? 'text-red-600' : 'text-gray-400';

const describeDiff = (diff: number) =>
  diff > 0 ? `${diff} higher than opponent` : diff < 0 ? `${-diff} lower than opponent` : 'equal to opponent';

const Diff: React.FC<{ value: number | undefined; className?: string }> = ({ value, className = '' }) =>
  value === undefined ? null : (
    <span className={`text-[11px] font-black tabular-nums ${diffColor(value)} ${className}`}>
      <span aria-hidden="true">{formatStatDifference(value)}</span>
      <span className="sr-only">{describeDiff(value)}</span>
    </span>
  );

const TeamCard: React.FC<TeamCardProps> = ({ team, differences, onEdit, onCheckData }) => {
  const tiles = [
    { label: 'ATT', value: team.attackRating, diff: differences?.attack },
    { label: 'MID', value: team.midfieldRating, diff: differences?.midfield },
    { label: 'DEF', value: team.defendRating, diff: differences?.defend },
  ];

  return (
    <Card hard className="relative mx-auto flex w-full max-w-md items-center gap-3 p-4">
      <AdminOnly>
        {onEdit && (
          <button
            onClick={onEdit}
            className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center border-2 border-(--color-ink) bg-white text-(--color-ink)"
            aria-label={`Edit ${team.name}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {onCheckData && (
          <button
            onClick={onCheckData}
            className={`absolute right-2 flex h-10 w-10 items-center justify-center border-2 border-(--color-ink) bg-white text-(--color-ink) ${onEdit ? 'top-14' : 'top-2'}`}
            aria-label={`Check ${team.name} on SoFIFA`}
            title="Check team data on SoFIFA"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      </AdminOnly>

      <TeamLogo team={team} size="lg" />

      <div className="min-w-0 flex-1">
        <div className={`flex items-baseline gap-1.5 ${onEdit ? 'pr-10' : ''}`}>
          <span className="truncate text-base font-black uppercase tracking-wide text-(--color-ink)">
            {team.name}
          </span>
          <span className="flex-none text-xs font-bold text-gray-500">({team.version})</span>
        </div>
        <div className={`truncate text-xs font-semibold uppercase tracking-wide text-gray-500 ${onEdit ? 'pr-10' : ''}`}>
          {team.league}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="flex items-center gap-1 text-sm font-bold text-(--color-ink)">
            <Star className="h-3.5 w-3.5" fill="currentColor" />
            {team.rating.toFixed(1)}
          </span>
          <span className="bg-(--color-ink) px-2 py-0.5 text-xs font-black text-white">
            OVR {team.overallRating}
          </span>
          <Diff value={differences?.overall} className="text-xs" />
        </div>

        <div className={`mt-2 grid grid-cols-3 gap-1.5 ${onEdit && onCheckData ? 'pr-12' : ''}`}>
          {tiles.map(tile => {
            const tier = ratingTier(tile.value);
            return (
              <div key={tile.label} className="flex min-w-0 flex-col items-stretch">
                <div
                  className="border py-1 text-center text-[11px] font-bold"
                  style={{ background: tier.bg, color: tier.fg, borderColor: tier.bg }}
                >
                  {tile.label} {tile.value}
                </div>
                {tile.diff !== undefined && <Diff value={tile.diff} className="mt-0.5 text-center" />}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

export default TeamCard;
