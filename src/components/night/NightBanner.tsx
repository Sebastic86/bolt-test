import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Moon, Trophy } from 'lucide-react';
import { GameNight, MatchHistoryItem, Player, Team } from '../../types';
import { calculateNightSummary, isNightStale } from '../../utils/nightStats';

interface NightBannerProps {
  night: GameNight | null;
  /** Tonight's matches (getNightMatches). */
  nightMatches: MatchHistoryItem[];
  players: Player[];
  teams: Team[];
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Dashboard header strip: "start a night" prompt, or the live night at a glance. */
const NightBanner: React.FC<NightBannerProps> = ({ night, nightMatches, players, teams }) => {
  const summary = useMemo(
    () => (night ? calculateNightSummary(nightMatches, players, teams) : null),
    [night, nightMatches, players, teams]
  );

  if (!night || !summary) {
    return (
      <div className="flex items-center gap-2.5 border-2 border-(--color-ink) bg-white p-2.5">
        <Moon className="h-4 w-4 flex-none text-gray-500" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-xs font-bold uppercase tracking-wide text-gray-500">No game night running</p>
        <Link
          to="/night"
          className="flex h-10 flex-none items-center gap-1 border-2 border-(--color-ink) bg-(--color-green-bright) px-3 text-xs font-black uppercase tracking-wide text-(--color-ink)"
        >
          Start night
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const stale = isNightStale(night);
  const potn = summary.playerOfTheNight;

  return (
    <Link
      to="/night"
      className="block border-2 border-(--color-ink) bg-(--color-ink) text-white shadow-hard"
      aria-label="Open game night"
    >
      <div className="flex items-center gap-2.5 p-3">
        <span className="flex flex-none items-center gap-1.5 bg-(--color-green-bright) px-2 py-0.5 text-xs font-black uppercase tracking-wide text-(--color-ink)">
          <span className="h-2 w-2 animate-pulse rounded-full bg-(--color-ink)" aria-hidden="true" />
          Live
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black uppercase tracking-wide">
            Game night{night.version ? ` · ${night.version}` : ''}
          </p>
          <p className="truncate text-xs font-semibold text-gray-300">
            since {formatTime(night.started_at)} · {summary.matchCount} {summary.matchCount === 1 ? 'match' : 'matches'}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 flex-none text-(--color-green-bright)" aria-hidden="true" />
      </div>
      <div className="flex items-center gap-1.5 border-t border-white/20 px-3 py-2 text-xs font-bold">
        <Trophy className="h-3.5 w-3.5 flex-none text-(--color-green-bright)" aria-hidden="true" />
        {potn ? (
          <span className="min-w-0 truncate">
            <span className="uppercase tracking-wide text-gray-300">Player of the night </span>
            {summary.playerOfTheNightName} · {potn.points} pts
          </span>
        ) : (
          <span className="text-gray-300">No results yet tonight</span>
        )}
      </div>
      {stale && (
        <div className="flex items-center gap-1.5 border-t border-white/20 bg-yellow-300 px-3 py-2 text-xs font-bold text-(--color-ink)">
          <AlertTriangle className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
          Started yesterday — end it on the Night page
        </div>
      )}
    </Link>
  );
};

export default NightBanner;
