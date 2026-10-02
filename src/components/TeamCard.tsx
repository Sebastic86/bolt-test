import React from 'react';
import { Pencil, Star } from 'lucide-react';
import { Team } from '../types';
import { TeamLogo } from './TeamLogo';
import { Card } from './ui';
import { AdminOnly } from './RoleBasedComponents';
import { ratingTier } from '../utils/ratingTier';

interface TeamCardProps {
  team: Team;
  onEdit?: () => void;
}

const TeamCard: React.FC<TeamCardProps> = ({ team, onEdit }) => {
  const att = ratingTier(team.attackRating);
  const mid = ratingTier(team.midfieldRating);
  const def = ratingTier(team.defendRating);

  return (
    <Card hard className="relative mx-auto flex w-full max-w-md items-center gap-3 p-4">
      <AdminOnly>
        {onEdit && (
          <button
            onClick={onEdit}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center border border-(--color-ink) bg-white text-(--color-ink)"
            aria-label={`Edit ${team.name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </AdminOnly>

      <TeamLogo team={team} size="lg" />

      <div className="min-w-0 flex-1 pr-8">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-base font-black uppercase tracking-wide text-(--color-ink)">
            {team.name}
          </span>
          <span className="flex-none text-xs font-bold text-gray-500">({team.version})</span>
        </div>
        <div className="truncate text-xs font-semibold uppercase tracking-wide text-gray-500">
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
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <div className="border py-1 text-center text-[11px] font-bold" style={{ background: att.bg, color: att.fg, borderColor: att.bg }}>
            ATT {team.attackRating}
          </div>
          <div className="border py-1 text-center text-[11px] font-bold" style={{ background: mid.bg, color: mid.fg, borderColor: mid.bg }}>
            MID {team.midfieldRating}
          </div>
          <div className="border py-1 text-center text-[11px] font-bold" style={{ background: def.bg, color: def.fg, borderColor: def.bg }}>
            DEF {team.defendRating}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default TeamCard;
