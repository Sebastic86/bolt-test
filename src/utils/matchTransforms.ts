import { Match, MatchPlayer, Player, Team, MatchHistoryItem } from '../types';

/**
 * Joins raw match rows with team and player data into MatchHistoryItem[].
 * Pure — no Supabase, no React — so the query layer can use it as a
 * post-fetch `select` step and it's directly unit-testable.
 */
export function combineMatchData(
  matches: Match[],
  matchPlayers: MatchPlayer[],
  allTeams: Team[],
  allPlayers: Player[]
): MatchHistoryItem[] {
  const playerMap = new Map(allPlayers.map(p => [p.id, p]));
  const teamMap = new Map(allTeams.map(t => [t.id, t]));

  return matches.map(match => {
    const team1 = teamMap.get(match.team1_id);
    const team2 = teamMap.get(match.team2_id);
    const playersInMatch = matchPlayers.filter(mp => mp.match_id === match.id);

    return {
      ...match,
      team1_name: team1?.name ?? 'Unknown Team',
      team1_logoUrl: team1?.logoUrl ?? '',
      team1_version: team1?.version ?? '',
      team2_name: team2?.name ?? 'Unknown Team',
      team2_logoUrl: team2?.logoUrl ?? '',
      team2_version: team2?.version ?? '',
      team1_players: playersInMatch
        .filter(mp => mp.team_number === 1)
        .map(mp => playerMap.get(mp.player_id))
        .filter((p): p is Player => p !== undefined),
      team2_players: playersInMatch
        .filter(mp => mp.team_number === 2)
        .map(mp => playerMap.get(mp.player_id))
        .filter((p): p is Player => p !== undefined),
    };
  });
}
