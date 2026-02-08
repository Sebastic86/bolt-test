import { useMemo } from 'react';
import { TeamStanding, MatchHistoryItem, Team } from '../types';

export function useTeamStatistics(
  allMatches: MatchHistoryItem[],
  allTeams: Team[]
) {
  // Calculate Team Statistics (all matches)
  const teamStatistics = useMemo(() => {
    console.log("[useTeamStatistics] Calculating team statistics...");
    const statsMap = new Map<string, TeamStanding>();

    // Initialize all teams
    allTeams.forEach(team => {
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

    // Process all matches
    allMatches.forEach(match => {
      const team1Stats = statsMap.get(match.team1_id);
      const team2Stats = statsMap.get(match.team2_id);

      const hasScores = match.team1_score !== null && match.team2_score !== null;
      if (!hasScores || !team1Stats || !team2Stats) return;

      // Increment matches played for both teams
      team1Stats.totalMatches += 1;
      team2Stats.totalMatches += 1;

      const score1 = match.team1_score!;
      const score2 = match.team2_score!;

      // Determine winner
      let winnerTeamNumber: 1 | 2 | null = null;
      if (score1 > score2) {
        winnerTeamNumber = 1;
      } else if (score2 > score1) {
        winnerTeamNumber = 2;
      } else if (score1 === score2 && match.penalties_winner) {
        winnerTeamNumber = match.penalties_winner;
      }

      // Update win/loss counts
      if (winnerTeamNumber === 1) {
        team1Stats.totalWins += 1;
        team2Stats.totalLosses += 1;
      } else if (winnerTeamNumber === 2) {
        team2Stats.totalWins += 1;
        team1Stats.totalLosses += 1;
      }
    });

    // Calculate percentages
    const statsArray = Array.from(statsMap.values()).map(stats => ({
      ...stats,
      winPercentage: stats.totalMatches > 0 ? (stats.totalWins / stats.totalMatches) * 100 : 0,
      lossPercentage: stats.totalMatches > 0 ? (stats.totalLosses / stats.totalMatches) * 100 : 0,
    }));

    console.log("[useTeamStatistics] Team statistics calculated:", statsArray);
    return statsArray;

  }, [allMatches, allTeams]);

  return { teamStatistics };
}
