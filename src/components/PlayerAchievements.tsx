import React, { useMemo, useState } from 'react';
import { ChevronDown, Trophy } from 'lucide-react';
import { MatchHistoryItem, Player, Team } from '../types';
import { Achievement, calculatePlayerAchievements, PlayerAchievementData } from '../utils/achievementUtils';
import { TeamBadge } from './TeamBadge';
import PlayerBadge from './PlayerBadge';
import { BottomSheet, LoadingState, ErrorState, Select } from './ui';

interface PlayerAchievementsProps {
  allMatches: MatchHistoryItem[];
  players: Player[];
  teams: Team[];
  loading: boolean;
  error: string | null;
}

const formatDate = (isoString: string): string =>
  new Date(isoString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const PlayerAchievements: React.FC<PlayerAchievementsProps> = ({ allMatches, players, teams, loading, error }) => {
  const [selectedVersion, setSelectedVersion] = useState('All');
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [selectedAchievement, setSelectedAchievement] = useState<{ playerName: string; achievement: Achievement } | null>(null);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  const availableVersions = useMemo(
    () => Array.from(new Set(teams.map(t => t.version))).sort(),
    [teams]
  );

  const filteredMatches = useMemo(() => {
    if (selectedVersion === 'All') return allMatches;
    return allMatches.filter(m => m.team1_version === selectedVersion || m.team2_version === selectedVersion);
  }, [selectedVersion, allMatches]);

  const playerData = useMemo(
    () => calculatePlayerAchievements(filteredMatches, players, teams),
    [filteredMatches, players, teams]
  );

  const achievementMatches = selectedAchievement
    ? filteredMatches.filter(m => selectedAchievement.achievement.matchIds.includes(m.id))
    : [];

  const closeSheet = () => {
    setSelectedAchievement(null);
    setExpandedMatchId(null);
  };

  return (
    <div>
      <div className="mb-2.5 flex justify-end">
        <Select value={selectedVersion} onChange={e => setSelectedVersion(e.target.value)} className="w-auto" aria-label="Filter by version">
          <option value="All">All Versions</option>
          {availableVersions.map(v => <option key={v} value={v}>{v}</option>)}
        </Select>
      </div>

      {loading && playerData.length === 0 && <LoadingState label="Calculating achievements..." />}
      {error && <ErrorState message={error} />}
      {!loading && !error && playerData.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-500">No match data available for achievements.</p>
      )}

      {playerData.length > 0 && (
        <div className="space-y-2.5">
          {playerData.map(player => (
            <PlayerAchievementCard
              key={player.playerId}
              player={player}
              isExpanded={expandedPlayerId === player.playerId}
              onToggle={() => setExpandedPlayerId(prev => (prev === player.playerId ? null : player.playerId))}
              onAchievementClick={achievement => setSelectedAchievement({ playerName: player.playerName, achievement })}
            />
          ))}
        </div>
      )}

      <BottomSheet
        isOpen={selectedAchievement !== null}
        onClose={closeSheet}
        title={selectedAchievement ? `${selectedAchievement.achievement.emoji} ${selectedAchievement.achievement.name}` : ''}
      >
        {selectedAchievement && (
          <>
            <p className="mb-3 text-xs text-gray-500">{selectedAchievement.achievement.description}</p>
            <div className="space-y-2">
              {achievementMatches.map(match => {
                const isExpanded = expandedMatchId === match.id;
                return (
                  <button
                    key={match.id}
                    onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                    className="w-full border-2 border-(--color-ink) bg-white p-2.5 text-left"
                  >
                    <div className="mb-1.5 text-[10px] uppercase tracking-wide text-gray-400">{formatDate(match.played_at)}</div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <TeamBadge name={match.team1_name} size="sm" />
                        <span className="truncate text-xs font-bold text-(--color-ink)">{match.team1_name}</span>
                      </div>
                      <div className="flex-none text-sm font-black tabular-nums text-(--color-ink)">
                        {match.team1_score} - {match.team2_score}
                      </div>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-xs font-bold text-(--color-ink)">{match.team2_name}</span>
                        <TeamBadge name={match.team2_name} size="sm" />
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-2 grid grid-cols-2 gap-2 border-t-2 border-(--color-ink) pt-2 text-xs">
                        <div>
                          {match.team1_players.map(p => <PlayerBadge key={p.id} player={p} size="xs" className="mb-1" />)}
                        </div>
                        <div>
                          {match.team2_players.map(p => <PlayerBadge key={p.id} player={p} size="xs" className="mb-1" />)}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </BottomSheet>
    </div>
  );
};

interface PlayerAchievementCardProps {
  player: PlayerAchievementData;
  isExpanded: boolean;
  onToggle: () => void;
  onAchievementClick: (achievement: Achievement) => void;
}

const PlayerAchievementCard: React.FC<PlayerAchievementCardProps> = ({ player, isExpanded, onToggle, onAchievementClick }) => {
  const { streak, achievements } = player;

  return (
    <div className="border-2 border-(--color-ink) bg-white">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-2 p-3" aria-expanded={isExpanded}>
        <div className="flex min-w-0 items-center gap-2.5">
          <Trophy className="h-4 w-4 flex-none text-(--color-green-deep)" />
          <div className="min-w-0 text-left">
            <PlayerBadge player={{ id: player.playerId, name: player.playerName }} size="sm" />
            <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-gray-500">
              <span>{player.totalMatches} matches</span>
              {streak.isHotStreak && (
                <span className="border border-orange-300 bg-orange-50 px-1.5 py-0.5 font-bold text-orange-700">🔥 {streak.currentWinStreak}W streak</span>
              )}
              {!streak.isHotStreak && streak.currentWinStreak > 0 && (
                <span className="border border-(--color-green-mid) bg-green-50 px-1.5 py-0.5 font-bold text-(--color-green-deep)">✅ {streak.currentWinStreak}W</span>
              )}
              {streak.currentLossStreak > 0 && (
                <span className="border border-red-300 bg-red-50 px-1.5 py-0.5 font-bold text-red-700">❄️ {streak.currentLossStreak}L</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          {achievements.length > 0 && (
            <span className="border border-(--color-ink) bg-(--color-green-bright)/20 px-1.5 py-0.5 text-xs font-black text-(--color-ink)">
              {achievements.length}
            </span>
          )}
          <ChevronDown className={`h-4 w-4 text-(--color-ink) transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isExpanded && (
        <div className="border-t-2 border-(--color-ink) p-3">
          <div className="mb-2.5 grid grid-cols-2 gap-2">
            <div className="border border-(--color-green-mid) bg-green-50 py-1.5 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wide text-(--color-green-deep)">Best Win Streak</p>
              <p className="text-lg font-black text-(--color-green-deep)">{streak.longestWinStreak}</p>
            </div>
            <div className="border border-red-300 bg-red-50 py-1.5 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wide text-red-600">Worst Loss Streak</p>
              <p className="text-lg font-black text-red-700">{streak.longestLossStreak}</p>
            </div>
          </div>

          {achievements.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {achievements.map(achievement => (
                <button
                  key={achievement.id}
                  onClick={() => onAchievementClick(achievement)}
                  title={achievement.description}
                  className="inline-flex items-center gap-1 border border-(--color-ink) bg-yellow-50 px-2 py-1 text-xs"
                >
                  <span>{achievement.emoji}</span>
                  <span className="font-bold text-(--color-ink)">{achievement.name}</span>
                  {achievement.earnedCount > 1 && (
                    <span className="bg-(--color-ink) px-1 text-[10px] font-black text-white">x{achievement.earnedCount}</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs italic text-gray-400">No special achievements yet. Keep playing!</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PlayerAchievements;
