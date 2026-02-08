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
  matchIds: string[]; // Track which matches this achievement was earned in
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

    // Track match IDs for each achievement type
    const giantKillerMatches: string[] = [];
    const cleanSheetMatches: string[] = [];
    const demolitionMatches: string[] = [];
    const penaltySpecialistMatches: string[] = [];
    const lightningStrikeMatches: string[] = [];
    const diamondLeagueMatches: string[] = [];
    const underdogHeroMatches: string[] = [];
    const comebackMatches: string[] = [];

    // Track for consistency and versatility
    const teamWinCounts = new Map<string, number>();
    const uniqueTeamsWon = new Set<string>();

    let totalMatches = 0;
    let totalWins = 0;
    let currentLossStreak = 0;
    let maxLossStreakBeforeWin = 0;

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

      // Track loss streaks for Comeback Kid
      if (result === 'loss') {
        currentLossStreak++;
        maxLossStreakBeforeWin = Math.max(maxLossStreakBeforeWin, currentLossStreak);
      } else if (result === 'win') {
        totalWins++;

        // Comeback Kid: won after having 3+ loss streak
        if (currentLossStreak >= 3) {
          comebackMatches.push(match.id);
        }
        currentLossStreak = 0;

        // Track team consistency
        const teamKey = `${playerTeamId}`;
        teamWinCounts.set(teamKey, (teamWinCounts.get(teamKey) || 0) + 1);
        uniqueTeamsWon.add(teamKey);

        // Giant Killer: won with team OVR 5+ lower
        if (playerTeam && opponentTeam && (opponentTeam.overallRating - playerTeam.overallRating) >= 5) {
          giantKillerMatches.push(match.id);
        }

        // Demolition: won by 4+ goals
        if ((playerScore - opponentScore) >= 4) {
          demolitionMatches.push(match.id);
        }

        // Lightning Strike: scored 6+ goals
        if (playerScore >= 6) {
          lightningStrikeMatches.push(match.id);
        }

        // Penalty Specialist: won on penalties
        if (match.team1_score === match.team2_score && match.penalties_winner === teamNumber) {
          penaltySpecialistMatches.push(match.id);
        }

        // Diamond League: won with 90+ OVR team
        if (playerTeam && playerTeam.overallRating >= 90) {
          diamondLeagueMatches.push(match.id);
        }

        // Underdog Hero: won with sub-70 OVR team
        if (playerTeam && playerTeam.overallRating < 70) {
          underdogHeroMatches.push(match.id);
        }
      }

      // Clean Sheet: conceded 0 goals and scored at least 1 (can be in loss/win)
      if (opponentScore === 0 && playerScore > 0) {
        cleanSheetMatches.push(match.id);
      }
    }

    const streak = calculateStreak(results);
    const winRate = totalMatches > 0 ? (totalWins / totalMatches) * 100 : 0;

    const achievements: Achievement[] = [];

    // Giant Killer
    if (giantKillerMatches.length > 0) {
      achievements.push({
        id: 'giant-killer',
        name: 'Giant Killer',
        emoji: '🗡️',
        description: 'Won with a team 5+ OVR lower than opponent',
        earnedCount: giantKillerMatches.length,
        matchIds: giantKillerMatches,
      });
    }

    // Clean Sheet King
    if (cleanSheetMatches.length > 0) {
      achievements.push({
        id: 'clean-sheet',
        name: 'Clean Sheet King',
        emoji: '🧤',
        description: 'Kept a clean sheet (0 goals conceded, 1+ scored)',
        earnedCount: cleanSheetMatches.length,
        matchIds: cleanSheetMatches,
      });
    }

    // Fortress (5+ clean sheets)
    if (cleanSheetMatches.length >= 5) {
      achievements.push({
        id: 'fortress',
        name: 'Fortress',
        emoji: '🛡️',
        description: 'Achieved 5+ clean sheets',
        earnedCount: 1,
        matchIds: cleanSheetMatches,
      });
    }

    // Demolition
    if (demolitionMatches.length > 0) {
      achievements.push({
        id: 'demolition',
        name: 'Demolition',
        emoji: '💀',
        description: 'Won by 4+ goals difference',
        earnedCount: demolitionMatches.length,
        matchIds: demolitionMatches,
      });
    }

    // Lightning Strike
    if (lightningStrikeMatches.length > 0) {
      achievements.push({
        id: 'lightning-strike',
        name: 'Lightning Strike',
        emoji: '⚡',
        description: 'Scored 6+ goals in a match',
        earnedCount: lightningStrikeMatches.length,
        matchIds: lightningStrikeMatches,
      });
    }

    // Penalty Specialist
    if (penaltySpecialistMatches.length > 0) {
      achievements.push({
        id: 'penalty-specialist',
        name: 'Penalty Specialist',
        emoji: '🤝',
        description: 'Won a match on penalties',
        earnedCount: penaltySpecialistMatches.length,
        matchIds: penaltySpecialistMatches,
      });
    }

    // Lucky Charm (3+ penalty wins)
    if (penaltySpecialistMatches.length >= 3) {
      achievements.push({
        id: 'lucky-charm',
        name: 'Lucky Charm',
        emoji: '🎲',
        description: 'Won 3+ matches on penalties',
        earnedCount: 1,
        matchIds: penaltySpecialistMatches,
      });
    }

    // Hot Streak (3+ win streak)
    if (streak.longestWinStreak >= 3) {
      // Find matches that contributed to the longest win streak
      const streakMatches: string[] = [];
      let tempStreak = 0;
      let longestStreakMatches: string[] = [];

      for (let i = 0; i < sortedMatches.length; i++) {
        const match = sortedMatches[i];
        const { result } = getPlayerResult(match, player.id);
        if (result === 'win') {
          tempStreak++;
          streakMatches.push(match.id);
          if (tempStreak === streak.longestWinStreak) {
            longestStreakMatches = [...streakMatches];
          }
        } else if (result === 'loss') {
          tempStreak = 0;
          streakMatches.length = 0;
        }
      }

      achievements.push({
        id: 'hot-streak',
        name: 'Hot Streak',
        emoji: '🔥',
        description: `Achieved a ${streak.longestWinStreak}-game win streak`,
        earnedCount: 1,
        matchIds: longestStreakMatches,
      });
    }

    // Unbeatable (5+ win streak)
    if (streak.longestWinStreak >= 5) {
      const streakMatches: string[] = [];
      let tempStreak = 0;
      let longestStreakMatches: string[] = [];

      for (let i = 0; i < sortedMatches.length; i++) {
        const match = sortedMatches[i];
        const { result } = getPlayerResult(match, player.id);
        if (result === 'win') {
          tempStreak++;
          streakMatches.push(match.id);
          if (tempStreak === streak.longestWinStreak) {
            longestStreakMatches = [...streakMatches];
          }
        } else if (result === 'loss') {
          tempStreak = 0;
          streakMatches.length = 0;
        }
      }

      achievements.push({
        id: 'unbeatable',
        name: 'Unbeatable',
        emoji: '🏆',
        description: `Achieved a ${streak.longestWinStreak}-game win streak`,
        earnedCount: 1,
        matchIds: longestStreakMatches,
      });
    }

    // Consistency King (3+ wins with same team)
    const consistentTeams = Array.from(teamWinCounts.entries()).filter(([_, count]) => count >= 3);
    if (consistentTeams.length > 0) {
      const consistencyMatches: string[] = [];
      for (const match of sortedMatches) {
        const { result, teamNumber } = getPlayerResult(match, player.id);
        if (result === 'win' && teamNumber !== null) {
          const playerTeamId = teamNumber === 1 ? match.team1_id : match.team2_id;
          if (consistentTeams.some(([teamKey]) => teamKey === playerTeamId)) {
            consistencyMatches.push(match.id);
          }
        }
      }

      achievements.push({
        id: 'consistency-king',
        name: 'Consistency King',
        emoji: '🎯',
        description: 'Won 3+ matches with the same team',
        earnedCount: consistentTeams.length,
        matchIds: consistencyMatches,
      });
    }

    // Versatile (5+ different teams won with)
    if (uniqueTeamsWon.size >= 5) {
      const versatileMatches: string[] = [];
      for (const match of sortedMatches) {
        const { result, teamNumber } = getPlayerResult(match, player.id);
        if (result === 'win' && teamNumber !== null) {
          versatileMatches.push(match.id);
        }
      }

      achievements.push({
        id: 'versatile',
        name: 'Versatile',
        emoji: '🎭',
        description: `Won with ${uniqueTeamsWon.size} different teams`,
        earnedCount: 1,
        matchIds: versatileMatches,
      });
    }

    // Diamond League
    if (diamondLeagueMatches.length > 0) {
      achievements.push({
        id: 'diamond-league',
        name: 'Diamond League',
        emoji: '💎',
        description: 'Won with a 90+ OVR rated team',
        earnedCount: diamondLeagueMatches.length,
        matchIds: diamondLeagueMatches,
      });
    }

    // Underdog Hero
    if (underdogHeroMatches.length > 0) {
      achievements.push({
        id: 'underdog-hero',
        name: 'Underdog Hero',
        emoji: '🌟',
        description: 'Won with a team rated below 70 OVR',
        earnedCount: underdogHeroMatches.length,
        matchIds: underdogHeroMatches,
      });
    }

    // Comeback Kid
    if (comebackMatches.length > 0) {
      achievements.push({
        id: 'comeback-kid',
        name: 'Comeback Kid',
        emoji: '🔄',
        description: 'Won a match after having a 3+ loss streak',
        earnedCount: comebackMatches.length,
        matchIds: comebackMatches,
      });
    }

    // Perfectionist (75%+ win rate with 10+ matches)
    if (totalMatches >= 10 && winRate >= 75) {
      // Include all wins for perfectionist
      const perfectionistMatches: string[] = [];
      for (const match of sortedMatches) {
        const { result } = getPlayerResult(match, player.id);
        if (result === 'win') {
          perfectionistMatches.push(match.id);
        }
      }

      achievements.push({
        id: 'perfectionist',
        name: 'Perfectionist',
        emoji: '📈',
        description: `Maintained ${winRate.toFixed(0)}% win rate over ${totalMatches} matches`,
        earnedCount: 1,
        matchIds: perfectionistMatches,
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
