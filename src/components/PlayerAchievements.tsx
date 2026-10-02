import React, { useMemo, useState } from 'react';
import { ChevronDown, Trophy } from 'lucide-react';
import { MatchHistoryItem, Player, Team } from '../types';
import { Achievement, calculatePlayerAchievements, PlayerAchievementData } from '../utils/achievementUtils';
import { ALL_VERSIONS, filterMatchesByVersion, getAvailableVersions } from '../utils/versionFilter';
import { TeamLogo } from './TeamLogo';
import PlayerBadge from './PlayerBadge';
import { VersionFilter } from './stats/VersionFilter';
import { BottomSheet, LoadingState, ErrorState } from './ui';

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
  const [selectedVersion, setSelectedVersion] = useState(ALL_VERSIONS);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [selectedAchievement, setSelectedAchievement] = useState<{ playerName: string; achievement: Achievement } | null>(null);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  const availableVersions = useMemo(() => getAvailableVersions(teams, allMatches), [teams, allMatches]);
  const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);
  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);

  // AND logic like every other stats view: a match counts for a version only
  // when both teams are that version. (The old app used OR here, so a
  // FC25-vs-FC26 match counted under both versions.)
  const filteredMatches = useMemo(
    () => filterMatchesByVersion(allMatches, selectedVersion),
    [selectedVersion, allMatches]
  );

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
      {availableVersions.length > 0 && (
        <VersionFilter
          className="mb-2.5"
          versions={availableVersions}
          value={selectedVersion}
          onChange={setSelectedVersion}
        />
      )}

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
              avatarUrl={playerMap.get(player.playerId)?.avatar_url ?? null}
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
            <p className="mb-2 text-xs text-gray-500">{selectedAchievement.achievement.description}</p>
            <div className="mb-3 flex items-center justify-between gap-2 border-y-2 border-(--color-ink) py-1.5 text-[10px] font-black uppercase tracking-wide">
              <span className="min-w-0 truncate text-(--color-ink)">
                {selectedAchievement.playerName} &middot; earned {selectedAchievement.achievement.earnedCount}&times;
              </span>
              <span className="flex-none text-gray-500">
                {achievementMatches.length} {achievementMatches.length === 1 ? 'match' : 'matches'}
              </span>
            </div>
            {achievementMatches.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-500">No matches found for this achievement.</p>
            )}
            <div className="space-y-2">
              {achievementMatches.map(match => {
                const isExpanded = expandedMatchId === match.id;
                return (
                  <button
                    key={match.id}
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                    className="w-full border-2 border-(--color-ink) bg-white p-2.5 text-left"
                  >
                    <div className="mb-1.5 text-[10px] uppercase tracking-wide text-gray-400">{formatDate(match.played_at)}</div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <TeamLogo
                          team={teamMap.get(match.team1_id) ?? { id: match.team1_id, name: match.team1_name, logoUrl: match.team1_logoUrl }}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-(--color-ink)">{match.team1_name}</div>
                          <div className="text-[10px] text-gray-400">{match.team1_version}</div>
                        </div>
                      </div>
                      <div className="flex flex-none flex-col items-center">
                        <div className="text-sm font-black tabular-nums text-(--color-ink)">
                          {match.team1_score} - {match.team2_score}
                        </div>
                        {match.penalties_winner && (
                          <span className="bg-yellow-100 px-1 text-[9px] font-black uppercase text-yellow-800">Pen</span>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                        <div className="min-w-0 text-right">
                          <div className="truncate text-xs font-bold text-(--color-ink)">{match.team2_name}</div>
                          <div className="text-[10px] text-gray-400">{match.team2_version}</div>
                        </div>
                        <TeamLogo
                          team={teamMap.get(match.team2_id) ?? { id: match.team2_id, name: match.team2_name, logoUrl: match.team2_logoUrl }}
                          size="sm"
                        />
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-2 grid grid-cols-2 gap-2 border-t-2 border-(--color-ink) pt-2 text-xs">
                        <div className="min-w-0">
                          {match.team1_players.length > 0
                            ? match.team1_players.map(p => (
                                <div key={p.id} className="mb-1"><PlayerBadge player={playerMap.get(p.id) ?? p} size="xs" className="max-w-full" /></div>
                              ))
                            : <span className="italic text-gray-400">No players recorded</span>}
                        </div>
                        <div className="min-w-0">
                          {match.team2_players.length > 0
                            ? match.team2_players.map(p => (
                                <div key={p.id} className="mb-1 text-right"><PlayerBadge player={playerMap.get(p.id) ?? p} size="xs" className="max-w-full" /></div>
                              ))
                            : <span className="block text-right italic text-gray-400">No players recorded</span>}
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
  avatarUrl: string | null;
  isExpanded: boolean;
  onToggle: () => void;
  onAchievementClick: (achievement: Achievement) => void;
}

const PlayerAchievementCard: React.FC<PlayerAchievementCardProps> = ({ player, avatarUrl, isExpanded, onToggle, onAchievementClick }) => {
  const { streak, achievements } = player;

  return (
    <div className="border-2 border-(--color-ink) bg-white">
      <button type="button" onClick={onToggle} className="flex min-h-12 w-full items-center justify-between gap-2 p-3" aria-expanded={isExpanded}>
        <div className="flex min-w-0 items-center gap-2.5">
          <Trophy className="h-4 w-4 flex-none text-(--color-green-deep)" />
          <div className="min-w-0 text-left">
            <PlayerBadge player={{ id: player.playerId, name: player.playerName, avatar_url: avatarUrl }} size="md" className="max-w-full" />
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
            <div>
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-gray-500">Achievements &middot; tap to view matches</p>
              <div className="flex flex-wrap gap-1.5">
                {achievements.map(achievement => (
                  <button
                    key={achievement.id}
                    type="button"
                    onClick={() => onAchievementClick(achievement)}
                    title={achievement.description}
                    className="inline-flex min-h-10 items-center gap-1 border border-(--color-ink) bg-yellow-50 px-2.5 text-xs"
                  >
                    <span>{achievement.emoji}</span>
                    <span className="font-bold text-(--color-ink)">{achievement.name}</span>
                    {achievement.earnedCount > 1 && (
                      <span className="bg-(--color-ink) px-1 text-[10px] font-black text-white">x{achievement.earnedCount}</span>
                    )}
                  </button>
                ))}
              </div>
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
