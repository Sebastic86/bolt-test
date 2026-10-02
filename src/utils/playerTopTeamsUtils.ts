import { MatchHistoryItem, Player, Team } from '../types';

export interface PlayerTopTeamStats {
  teamId: string;
  teamName: string;
  logoUrl: string;
  wins: number;
  goals: number;
  matchesPlayed: number;
}

export interface PlayerTopTeamsData {
  playerId: string;
  playerName: string;
  topTeams: PlayerTopTeamStats[];
}

/**
 * For each player, the (up to) 3 teams they've won the most with, ranked
 * by wins then goals scored. Ported from the old app's PlayerTopTeams
 * component as a pure function.
 */
export function calculatePlayerTopTeams(
  players: Player[],
  matches: MatchHistoryItem[],
  teams: Team[]
): PlayerTopTeamsData[] {
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const playerTeamMap = new Map<string, Map<string, PlayerTopTeamStats>>();

  players.forEach(player => playerTeamMap.set(player.id, new Map()));

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

    const team1 = teamMap.get(match.team1_id);
    const team2 = teamMap.get(match.team2_id);

    if (team1) {
      match.team1_players.forEach(player => {
        const playerStats = playerTeamMap.get(player.id);
        if (!playerStats) return;
        let teamStats = playerStats.get(match.team1_id);
        if (!teamStats) {
          teamStats = { teamId: match.team1_id, teamName: team1.name, logoUrl: team1.logoUrl, wins: 0, goals: 0, matchesPlayed: 0 };
          playerStats.set(match.team1_id, teamStats);
        }
        teamStats.matchesPlayed += 1;
        teamStats.goals += score1;
        if (winnerTeamNumber === 1) teamStats.wins += 1;
      });
    }

    if (team2) {
      match.team2_players.forEach(player => {
        const playerStats = playerTeamMap.get(player.id);
        if (!playerStats) return;
        let teamStats = playerStats.get(match.team2_id);
        if (!teamStats) {
          teamStats = { teamId: match.team2_id, teamName: team2.name, logoUrl: team2.logoUrl, wins: 0, goals: 0, matchesPlayed: 0 };
          playerStats.set(match.team2_id, teamStats);
        }
        teamStats.matchesPlayed += 1;
        teamStats.goals += score2;
        if (winnerTeamNumber === 2) teamStats.wins += 1;
      });
    }
  });

  return players
    .map(player => {
      const playerStats = playerTeamMap.get(player.id);
      if (!playerStats || playerStats.size === 0) return null;

      const teamsArray = Array.from(playerStats.values()).sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.goals - a.goals;
      });

      return { playerId: player.id, playerName: player.name, topTeams: teamsArray.slice(0, 3) };
    })
    .filter((stat): stat is PlayerTopTeamsData => stat !== null)
    .sort((a, b) => a.playerName.localeCompare(b.playerName));
}
