import { PlayerStanding, MatchHistoryItem, Player, Team } from '../types';

/**
 * Calculate player standings from a set of matches.
 * This is a shared utility used by App.tsx (today + overall standings)
 * and PlayerStandings.tsx (version-filtered standings).
 */
export function calculateStandings(
  matches: MatchHistoryItem[],
  players: Player[],
  teams: Team[]
): PlayerStanding[] {
  const standingsMap = new Map<string, PlayerStanding>();
  const teamMap = new Map(teams.map(t => [t.id, t]));

  players.forEach(player => {
    standingsMap.set(player.id, {
      playerId: player.id,
      playerName: player.name,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      totalOverallRating: 0,
      matchesPlayed: 0,
    });
  });

  matches.forEach(match => {
    const team1 = teamMap.get(match.team1_id);
    const team2 = teamMap.get(match.team2_id);

    const hasScores = match.team1_score !== null && match.team2_score !== null;
    if (!hasScores) return;

    let winnerTeamNumber: 1 | 2 | null = null;
    const score1 = match.team1_score!;
    const score2 = match.team2_score!;
    if (score1 > score2) winnerTeamNumber = 1;
    else if (score2 > score1) winnerTeamNumber = 2;
    else if (score1 === score2 && match.penalties_winner) {
      winnerTeamNumber = match.penalties_winner;
    }

    match.team1_players.forEach(player => {
      const standing = standingsMap.get(player.id);
      if (standing) {
        standing.goalsFor += match.team1_score!;
        standing.goalsAgainst += match.team2_score!;
        if (winnerTeamNumber === 1) {
          standing.points += 1;
        }
        if (team1) {
          standing.totalOverallRating += team1.overallRating;
          standing.matchesPlayed += 1;
        }
      }
    });

    match.team2_players.forEach(player => {
      const standing = standingsMap.get(player.id);
      if (standing) {
        standing.goalsFor += match.team2_score!;
        standing.goalsAgainst += match.team1_score!;
        if (winnerTeamNumber === 2) {
          standing.points += 1;
        }
        if (team2) {
          standing.totalOverallRating += team2.overallRating;
          standing.matchesPlayed += 1;
        }
      }
    });
  });

  const standingsArray = Array.from(standingsMap.values()).map(s => ({
    ...s,
    goalDifference: s.goalsFor - s.goalsAgainst
  }));

  standingsArray.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });

  return standingsArray;
}
