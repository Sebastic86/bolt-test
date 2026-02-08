import { MatchHistoryItem, Player, Team } from '../types';

export interface PlayerStreak {
  currentWinStreak: number;
  currentLossStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  isHotStreak: boolean;
}

export interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;
  earnedCount: number;
}

export interface PlayerAchievementData {
  playerId: string;
  playerName: string;
  streak: PlayerStreak;
  achievements: Achievement[];
  totalMatches: number;
}

type WinResult = 'win' | 'loss' | null;

function getPlayerResult(
  match: MatchHistoryItem,
  playerId: string
): { result: WinResult; teamNumber: 1 | 2 | null } {
  const isTeam1 = match.team1_players.some(p => p.id === playerId);
  const isTeam2 = match.team2_players.some(p => p.id === playerId);
  if (!isTeam1 && !isTeam2) return { result: null, teamNumber: null };

  const teamNumber: 1 | 2 = isTeam1 ? 1 : 2;

  if (match.team1_score === null || match.team2_score === null) {
    return { result: null, teamNumber };
  }

  const score1 = match.team1_score;
  const score2 = match.team2_score;

  let winnerTeamNumber: 1 | 2 | null = null;
  if (score1 > score2) winnerTeamNumber = 1;
  else if (score2 > score1) winnerTeamNumber = 2;
  else if (score1 === score2 && match.penalties_winner) {
    winnerTeamNumber = match.penalties_winner;
  }

  if (winnerTeamNumber === null) return { result: null, teamNumber };

  return {
    result: winnerTeamNumber === teamNumber ? 'win' : 'loss',
    teamNumber,
  };
}

function calculateStreak(results: WinResult[]): PlayerStreak {
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;

  let tempWin = 0;
  let tempLoss = 0;

  for (const result of results) {
    if (result === 'win') {
      tempWin++;
      tempLoss = 0;
      if (tempWin > longestWinStreak) longestWinStreak = tempWin;
    } else if (result === 'loss') {
      tempLoss++;
      tempWin = 0;
      if (tempLoss > longestLossStreak) longestLossStreak = tempLoss;
    }
  }

  currentWinStreak = tempWin;
  currentLossStreak = tempLoss;

  return {
    currentWinStreak,
    currentLossStreak,
    longestWinStreak,
    longestLossStreak,
    isHotStreak: currentWinStreak >= 3,
  };
}

export function calculatePlayerAchievements(
  allMatches: MatchHistoryItem[],
  allPlayers: Player[],
  allTeams: Team[]
): PlayerAchievementData[] {
  const teamMap = new Map(allTeams.map(t => [t.id, t]));

  // Sort matches ascending by played_at for streak calculation
  const sortedMatches = [...allMatches]
    .filter(m => m.team1_score !== null && m.team2_score !== null)
    .sort((a, b) => new Date(a.played_at).getTime() - new Date(b.played_at).getTime());

  return allPlayers.map(player => {
    const results: WinResult[] = [];
    let giantKillerCount = 0;
    let cleanSheetCount = 0;
    let demolitionCount = 0;
    let penaltySpecialistCount = 0;
    let totalMatches = 0;

    for (const match of sortedMatches) {
      const { result, teamNumber } = getPlayerResult(match, player.id);
      if (result === null || teamNumber === null) continue;

      totalMatches++;
      results.push(result);

      const playerTeamId = teamNumber === 1 ? match.team1_id : match.team2_id;
      const opponentTeamId = teamNumber === 1 ? match.team2_id : match.team1_id;
      const playerTeam = teamMap.get(playerTeamId);
      const opponentTeam = teamMap.get(opponentTeamId);

      const playerScore = teamNumber === 1 ? match.team1_score! : match.team2_score!;
      const opponentScore = teamNumber === 1 ? match.team2_score! : match.team1_score!;

      if (result === 'win') {
        // Giant Killer: won with team OVR 5+ lower
        if (playerTeam && opponentTeam && (opponentTeam.overallRating - playerTeam.overallRating) >= 5) {
          giantKillerCount++;
        }

        // Demolition: won by 4+ goals
        if ((playerScore - opponentScore) >= 4) {
          demolitionCount++;
        }

        // Penalty Specialist: won on penalties
        if (match.team1_score === match.team2_score && match.penalties_winner === teamNumber) {
          penaltySpecialistCount++;
        }
      }

      // Clean Sheet: conceded 0 goals and scored at least 1
      if (opponentScore === 0 && playerScore > 0) {
        cleanSheetCount++;
      }
    }

    const streak = calculateStreak(results);

    const achievements: Achievement[] = [];

    if (giantKillerCount > 0) {
      achievements.push({
        id: 'giant-killer',
        name: 'Giant Killer',
        emoji: '🗡️',
        description: 'Won with a team 5+ OVR lower than opponent',
        earnedCount: giantKillerCount,
      });
    }

    if (cleanSheetCount > 0) {
      achievements.push({
        id: 'clean-sheet',
        name: 'Clean Sheet King',
        emoji: '🧤',
        description: 'Kept a clean sheet (0 goals conceded, 1+ scored)',
        earnedCount: cleanSheetCount,
      });
    }

    if (demolitionCount > 0) {
      achievements.push({
        id: 'demolition',
        name: 'Demolition',
        emoji: '💀',
        description: 'Won by 4+ goals difference',
        earnedCount: demolitionCount,
      });
    }

    if (penaltySpecialistCount > 0) {
      achievements.push({
        id: 'penalty-specialist',
        name: 'Penalty Specialist',
        emoji: '🤝',
        description: 'Won a match on penalties',
        earnedCount: penaltySpecialistCount,
      });
    }

    if (streak.longestWinStreak >= 3) {
      achievements.push({
        id: 'hot-streak',
        name: 'Hot Streak',
        emoji: '🔥',
        description: `Achieved a ${streak.longestWinStreak}-game win streak`,
        earnedCount: 1,
      });
    }

    return {
      playerId: player.id,
      playerName: player.name,
      streak,
      achievements,
      totalMatches,
    };
  })
  .filter(p => p.totalMatches > 0)
  .sort((a, b) => {
    // Sort by longest win streak desc, then current win streak desc
    if (b.streak.longestWinStreak !== a.streak.longestWinStreak) {
      return b.streak.longestWinStreak - a.streak.longestWinStreak;
    }
    if (b.streak.currentWinStreak !== a.streak.currentWinStreak) {
      return b.streak.currentWinStreak - a.streak.currentWinStreak;
    }
    return b.totalMatches - a.totalMatches;
  });
}
