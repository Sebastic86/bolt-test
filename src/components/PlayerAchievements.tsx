import React, { useMemo, useState } from 'react';
import { MatchHistoryItem, Player, Team } from '../types';
import { calculatePlayerAchievements, PlayerAchievementData, Achievement } from '../utils/achievementUtils';
import { ChevronDown, Trophy, X, Calendar, Shield } from 'lucide-react';

interface PlayerAchievementsProps {
  allMatches: MatchHistoryItem[];
  allPlayers: Player[];
  allTeams: Team[];
  loading: boolean;
  error: string | null;
}

interface AchievementModalProps {
  achievement: Achievement | null;
  matches: MatchHistoryItem[];
  onClose: () => void;
}

const AchievementModal: React.FC<AchievementModalProps> = ({ achievement, matches, onClose }) => {
  if (!achievement) return null;

  // Filter matches that earned this achievement
  const achievementMatches = matches.filter(m => achievement.matchIds.includes(m.id));

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-dark to-brand-light p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{achievement.emoji}</span>
            <div>
              <h2 className="text-xl font-bold text-white">{achievement.name}</h2>
              <p className="text-sm text-white/90">{achievement.description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-1 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Badge Count */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Earned {achievement.earnedCount} time{achievement.earnedCount !== 1 ? 's' : ''}
            </span>
            <span className="text-sm text-gray-500">
              {achievementMatches.length} match{achievementMatches.length !== 1 ? 'es' : ''}
            </span>
          </div>
        </div>

        {/* Matches List */}
        <div className="flex-1 overflow-y-auto p-4">
          {achievementMatches.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No matches found for this achievement.</p>
          ) : (
            <div className="space-y-3">
              {achievementMatches.map((match) => (
                <div
                  key={match.id}
                  className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow"
                >
                  {/* Date */}
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(match.played_at)}</span>
                  </div>

                  {/* Teams and Score */}
                  <div className="flex items-center justify-between gap-4">
                    {/* Team 1 */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded shrink-0">
                        {match.team1_logoUrl ? (
                          <img
                            src={match.team1_logoUrl}
                            alt={match.team1_name}
                            className="w-6 h-6 object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <Shield className="w-4 h-4 text-gray-400 hidden" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{match.team1_name}</p>
                        <p className="text-xs text-gray-500">{match.team1_version}</p>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-lg font-bold text-gray-800">{match.team1_score}</span>
                      <span className="text-gray-400">-</span>
                      <span className="text-lg font-bold text-gray-800">{match.team2_score}</span>
                      {match.penalties_winner && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                          PEN
                        </span>
                      )}
                    </div>

                    {/* Team 2 */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <div className="min-w-0 text-right">
                        <p className="text-sm font-medium text-gray-800 truncate">{match.team2_name}</p>
                        <p className="text-xs text-gray-500">{match.team2_version}</p>
                      </div>
                      <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded shrink-0">
                        {match.team2_logoUrl ? (
                          <img
                            src={match.team2_logoUrl}
                            alt={match.team2_name}
                            className="w-6 h-6 object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <Shield className="w-4 h-4 text-gray-400 hidden" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full bg-brand-dark text-white py-2 px-4 rounded-sm hover:bg-brand-darker transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const PlayerAchievements: React.FC<PlayerAchievementsProps> = ({
  allMatches,
  allPlayers,
  allTeams,
  loading,
  error,
}) => {
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);

  const playerData = useMemo(() => {
    return calculatePlayerAchievements(allMatches, allPlayers, allTeams);
  }, [allMatches, allPlayers, allTeams]);

  const togglePlayer = (playerId: string) => {
    setExpandedPlayerId(prev => (prev === playerId ? null : playerId));
  };

  const handleAchievementClick = (achievement: Achievement) => {
    setSelectedAchievement(achievement);
  };

  const closeModal = () => {
    setSelectedAchievement(null);
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
    <>
      <div className="w-full max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {playerData.map((player) => (
            <PlayerAchievementCard
              key={player.playerId}
              player={player}
              isExpanded={expandedPlayerId === player.playerId}
              onToggle={() => togglePlayer(player.playerId)}
              onAchievementClick={handleAchievementClick}
            />
          ))}
        </div>
      </div>

      {/* Achievement Details Modal */}
      {selectedAchievement && (
        <AchievementModal
          achievement={selectedAchievement}
          matches={allMatches}
          onClose={closeModal}
        />
      )}
    </>
  );
};

interface PlayerAchievementCardProps {
  player: PlayerAchievementData;
  isExpanded: boolean;
  onToggle: () => void;
  onAchievementClick: (achievement: Achievement) => void;
}

const PlayerAchievementCard: React.FC<PlayerAchievementCardProps> = ({
  player,
  isExpanded,
  onToggle,
  onAchievementClick,
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
              <p className="text-[10px] uppercase font-medium text-gray-500">Achievements (click to view)</p>
              <div className="flex flex-wrap gap-1.5">
                {achievements.map((achievement) => (
                  <button
                    key={achievement.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAchievementClick(achievement);
                    }}
                    className="inline-flex items-center gap-1 bg-gradient-to-r from-yellow-50 to-orange-50 hover:from-yellow-100 hover:to-orange-100 border border-yellow-200 hover:border-yellow-300 text-gray-800 text-xs px-2.5 py-1.5 rounded-full transition-all hover:shadow-md active:scale-95 cursor-pointer"
                    title={achievement.description}
                  >
                    <span className="text-base">{achievement.emoji}</span>
                    <span className="font-semibold">{achievement.name}</span>
                    {achievement.earnedCount > 1 && (
                      <span className="bg-brand-dark text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        x{achievement.earnedCount}
                      </span>
                    )}
                  </button>
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
