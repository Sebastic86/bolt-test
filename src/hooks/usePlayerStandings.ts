import { useMemo } from 'react';
import { PlayerStanding, MatchHistoryItem, Player, Team } from '../types';
import { calculateStandings } from '../utils/standingsUtils';

export function usePlayerStandings(
  matchesToday: MatchHistoryItem[],
  allMatches: MatchHistoryItem[],
  allPlayers: Player[],
  allTeams: Team[]
) {
  // Calculate Player Standings (today)
  const playerStandings = useMemo(() => {
    console.log("[usePlayerStandings] Calculating today's player standings...");
    return calculateStandings(matchesToday, allPlayers, allTeams);
  }, [matchesToday, allPlayers, allTeams]);

  // Calculate Overall Player Standings (all matches)
  const overallPlayerStandings = useMemo(() => {
    console.log("[usePlayerStandings] Calculating overall player standings...");
    return calculateStandings(allMatches, allPlayers, allTeams);
  }, [allMatches, allPlayers, allTeams]);

  return {
    playerStandings,
    overallPlayerStandings,
  };
}
