import React, { useMemo, useState } from 'react';
import { MatchHistoryItem, Player, Team } from '../types';
import { calculatePlayerAchievements, PlayerAchievementData } from '../utils/achievementUtils';
import { ChevronDown, Trophy } from 'lucide-react';

interface PlayerAchievementsProps {
  allMatches: MatchHistoryItem[];
  allPlayers: Player[];
  allTeams: Team[];
  loading: boolean;
  error: string | null;
}

const PlayerAchievements: React.FC<PlayerAchievementsProps> = ({
  allMatches,
  allPlayers,
  allTeams,
  loading,
  error,
}) => {
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  const playerData = useMemo(() => {
    return calculatePlayerAchievements(allMatches, allPlayers, allTeams);
  }, [allMatches, allPlayers, allTeams]);

  const togglePlayer = (playerId: string) => {
    setExpandedPlayerId(prev => (prev === playerId ? null : playerId));
  };

  if (loading) {
    return <p className="text-center text-gray-600">Loading achievements...</p>;
  }

  if (error) {
    return <p className="text-center text-red-600 bg-red-100 p-3 rounded-sm">{error}</p>;
  }

  if (playerData.length === 0) {
    return <p className="text-center text-gray-500">No match data available for achievements.</p>;
  }

  return (
    <div className="w-full max-w-4xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {playerData.map((player) => (
          <PlayerAchievementCard
            key={player.playerId}
            player={player}
            isExpanded={expandedPlayerId === player.playerId}
            onToggle={() => togglePlayer(player.playerId)}
          />
        ))}
      </div>
    </div>
  );
};

interface PlayerAchievementCardProps {
  player: PlayerAchievementData;
  isExpanded: boolean;
  onToggle: () => void;
}

const PlayerAchievementCard: React.FC<PlayerAchievementCardProps> = ({
  player,
  isExpanded,
  onToggle,
}) => {
  const { streak, achievements } = player;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-brand-light overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">
            <Trophy className="w-5 h-5 text-brand-dark" />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-gray-800 text-sm truncate">
              {player.playerName}
            </h4>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{player.totalMatches} matches</span>
              {streak.isHotStreak && (
                <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium animate-pulse">
                  🔥 {streak.currentWinStreak}W streak
                </span>
              )}
              {!streak.isHotStreak && streak.currentWinStreak > 0 && (
                <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                  ✅ {streak.currentWinStreak}W
                </span>
              )}
              {streak.currentLossStreak > 0 && (
                <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
                  ❄️ {streak.currentLossStreak}L
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Achievement count badge */}
          {achievements.length > 0 && (
            <span className="bg-brand-lighter text-brand-dark text-xs font-bold px-2 py-0.5 rounded-full">
              {achievements.length}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-gray-100">
          {/* Streak Stats */}
          <div className="grid grid-cols-2 gap-2 mt-3 mb-3">
            <div className="bg-green-50 rounded-sm p-2 text-center">
              <p className="text-[10px] uppercase font-medium text-green-600">Best Win Streak</p>
              <p className="text-lg font-bold text-green-700">{streak.longestWinStreak}</p>
            </div>
            <div className="bg-red-50 rounded-sm p-2 text-center">
              <p className="text-[10px] uppercase font-medium text-red-600">Worst Loss Streak</p>
              <p className="text-lg font-bold text-red-700">{streak.longestLossStreak}</p>
            </div>
          </div>

          {/* Achievement Badges */}
          {achievements.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] uppercase font-medium text-gray-500">Achievements</p>
              <div className="flex flex-wrap gap-1.5">
                {achievements.map((achievement) => (
                  <span
                    key={achievement.id}
                    className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full hover:bg-gray-200 transition-colors"
                    title={achievement.description}
                  >
                    <span>{achievement.emoji}</span>
                    <span className="font-medium">{achievement.name}</span>
                    {achievement.earnedCount > 1 && (
                      <span className="bg-brand-dark text-white text-[10px] font-bold px-1.5 py-0 rounded-full">
                        x{achievement.earnedCount}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No special achievements yet. Keep playing!</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PlayerAchievements;
