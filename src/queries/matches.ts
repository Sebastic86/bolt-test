import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as matchService from '../services/matchService';
import { combineMatchData } from '../utils/matchTransforms';
import { useTeamsQuery } from './teams';
import { usePlayersQuery } from './players';
import { MatchHistoryItem } from '../types';

export const matchKeys = {
  all: ['matches'] as const,
  today: () => [...matchKeys.all, 'today'] as const,
  list: () => [...matchKeys.all, 'list'] as const,
};

/**
 * Today's matches, joined with teams/players. Depends on teams/players
 * already being loaded (via useTeamsQuery/usePlayersQuery, which this
 * hook also reads from cache — no duplicate fetch) so the join always has
 * real data rather than the "Unknown Team" fallback.
 */
export function useMatchesTodayQuery() {
  const teamsQuery = useTeamsQuery();
  const playersQuery = usePlayersQuery();

  return useQuery<MatchHistoryItem[]>({
    queryKey: matchKeys.today(),
    queryFn: async () => {
      const { matches, matchPlayers } = await matchService.fetchMatchesToday();
      return combineMatchData(matches, matchPlayers, teamsQuery.data ?? [], playersQuery.data ?? []);
    },
    enabled: teamsQuery.isSuccess && playersQuery.isSuccess,
  });
}

export function useAllMatchesQuery() {
  const teamsQuery = useTeamsQuery();
  const playersQuery = usePlayersQuery();

  return useQuery<MatchHistoryItem[]>({
    queryKey: matchKeys.list(),
    queryFn: async () => {
      const { matches, matchPlayers } = await matchService.fetchAllMatches();
      return combineMatchData(matches, matchPlayers, teamsQuery.data ?? [], playersQuery.data ?? []);
    },
    enabled: teamsQuery.isSuccess && playersQuery.isSuccess,
  });
}

export function useCreateMatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: matchService.createMatch,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: matchKeys.all }),
  });
}

export function useUpdateMatchScoreMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      matchId, team1Score, team2Score, penaltiesWinner,
    }: {
      matchId: string; team1Score: number; team2Score: number; penaltiesWinner: 1 | 2 | null;
    }) => matchService.updateMatchScore(matchId, team1Score, team2Score, penaltiesWinner),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: matchKeys.all }),
  });
}

export function useDeleteMatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (matchId: string) => matchService.deleteMatch(matchId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: matchKeys.all }),
  });
}

export function useMoveMatchPlayerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      matchId, playerId, newTeamNumber,
    }: {
      matchId: string; playerId: string; newTeamNumber: 1 | 2;
    }) => matchService.moveMatchPlayer(matchId, playerId, newTeamNumber),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: matchKeys.all }),
  });
}

export function useAddPlayerToMatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      matchId, playerId, teamNumber,
    }: {
      matchId: string; playerId: string; teamNumber: 1 | 2;
    }) => matchService.addPlayerToMatch(matchId, playerId, teamNumber),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: matchKeys.all }),
  });
}
