import { MatchHistoryItem, Team, TeamStanding } from '../types';

/**
 * Calculate per-team win/loss statistics across a set of matches. Ported
 * from the old app's useTeamStatistics hook as a pure, independently
 * testable function — feeds both the win% and loss% leaderboards.
 */
export function calculateTeamStandings(matches: MatchHistoryItem[], teams: Team[]): TeamStanding[] {
  const statsMap = new Map<string, TeamStanding>();

  teams.forEach(team => {
    statsMap.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      logoUrl: team.logoUrl,
      totalMatches: 0,
      totalWins: 0,
      totalLosses: 0,
      winPercentage: 0,
      lossPercentage: 0,
    });
  });

  matches.forEach(match => {
    const team1Stats = statsMap.get(match.team1_id);
    const team2Stats = statsMap.get(match.team2_id);

    const hasScores = match.team1_score !== null && match.team2_score !== null;
    if (!hasScores || !team1Stats || !team2Stats) return;

    team1Stats.totalMatches += 1;
    team2Stats.totalMatches += 1;

    const score1 = match.team1_score!;
    const score2 = match.team2_score!;

    let winnerTeamNumber: 1 | 2 | null = null;
    if (score1 > score2) winnerTeamNumber = 1;
    else if (score2 > score1) winnerTeamNumber = 2;
    else if (score1 === score2 && match.penalties_winner) {
      winnerTeamNumber = match.penalties_winner;
    }

    if (winnerTeamNumber === 1) {
      team1Stats.totalWins += 1;
      team2Stats.totalLosses += 1;
    } else if (winnerTeamNumber === 2) {
      team2Stats.totalWins += 1;
      team1Stats.totalLosses += 1;
    }
  });

  return Array.from(statsMap.values()).map(stats => ({
    ...stats,
    winPercentage: stats.totalMatches > 0 ? (stats.totalWins / stats.totalMatches) * 100 : 0,
    lossPercentage: stats.totalMatches > 0 ? (stats.totalLosses / stats.totalMatches) * 100 : 0,
  }));
}

/**
 * Top N teams for the win% / loss% leaderboards: only teams with at least
 * one completed match, sorted by the chosen percentage (descending), ties
 * broken by matches played (descending). Same rules as the old app's
 * TopWinPercentageTeams / TopLossPercentageTeams.
 */
export function topTeamsByPercentage(standings: TeamStanding[], mode: 'win' | 'loss', limit = 5): TeamStanding[] {
  const pct = (t: TeamStanding) => (mode === 'win' ? t.winPercentage : t.lossPercentage);
  return standings
    .filter(t => t.totalMatches > 0)
    .sort((a, b) => pct(b) - pct(a) || b.totalMatches - a.totalMatches)
    .slice(0, limit);
}
