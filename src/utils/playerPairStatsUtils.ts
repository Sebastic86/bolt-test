import { MatchHistoryItem, Player } from '../types';

export interface PlayerPairStanding {
  player1: Player;
  player2: Player;
  wins: number;
  losses: number;
  totalMatches: number;
  winPercentage: number;
}

/**
 * Win/loss record for every pair of players who have been teammates at
 * least once, sorted by matches played then win percentage. The old app
 * rendered this as an N×N matrix table (PlayerWinMatrix); on a phone-width
 * screen that means constant horizontal scrolling, so gamenight surfaces
 * the same data as a sorted list of pair "cards" instead — same stat,
 * mobile-friendly presentation.
 */
export function calculatePlayerPairStandings(players: Player[], matches: MatchHistoryItem[]): PlayerPairStanding[] {
  const playerMap = new Map(players.map(p => [p.id, p]));
  const statsMap = new Map<string, { player1Id: string; player2Id: string; wins: number; losses: number; totalMatches: number }>();

  const getOrCreate = (id1: string, id2: string) => {
    const [player1Id, player2Id] = id1 < id2 ? [id1, id2] : [id2, id1];
    const key = `${player1Id}-${player2Id}`;
    let stats = statsMap.get(key);
    if (!stats) {
      stats = { player1Id, player2Id, wins: 0, losses: 0, totalMatches: 0 };
      statsMap.set(key, stats);
    }
    return stats;
  };

  matches.forEach(match => {
    const hasScores = match.team1_score !== null && match.team2_score !== null;
    if (!hasScores) return;

    const score1 = match.team1_score!;
    const score2 = match.team2_score!;

    let winnerTeamNumber: 1 | 2 | null = null;
    if (score1 > score2) winnerTeamNumber = 1;
    else if (score2 > score1) winnerTeamNumber = 2;
    else if (score1 === score2 && match.penalties_winner) {
      winnerTeamNumber = match.penalties_winner;
    }
    if (winnerTeamNumber === null) return;

    [match.team1_players, match.team2_players].forEach((teamPlayers, index) => {
      const teamNumber = index === 0 ? 1 : 2;
      for (let i = 0; i < teamPlayers.length; i++) {
        for (let j = i + 1; j < teamPlayers.length; j++) {
          const stats = getOrCreate(teamPlayers[i].id, teamPlayers[j].id);
          stats.totalMatches += 1;
          if (winnerTeamNumber === teamNumber) stats.wins += 1;
          else stats.losses += 1;
        }
      }
    });
  });

  return Array.from(statsMap.values())
    .map(stats => {
      const player1 = playerMap.get(stats.player1Id);
      const player2 = playerMap.get(stats.player2Id);
      if (!player1 || !player2) return null;
      return {
        player1,
        player2,
        wins: stats.wins,
        losses: stats.losses,
        totalMatches: stats.totalMatches,
        winPercentage: stats.totalMatches > 0 ? (stats.wins / stats.totalMatches) * 100 : 0,
      };
    })
    .filter((s): s is PlayerPairStanding => s !== null)
    .sort((a, b) => {
      if (b.totalMatches !== a.totalMatches) return b.totalMatches - a.totalMatches;
      return b.winPercentage - a.winPercentage;
    });
}
