import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as teamService from '../services/teamService';
import { Team } from '../types';

export const teamKeys = {
  all: ['teams'] as const,
};

export function useTeamsQuery() {
  return useQuery({
    queryKey: teamKeys.all,
    queryFn: teamService.fetchAllTeams,
  });
}

export function useCreateTeamMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (team: Omit<Team, 'id'>) => teamService.createTeam(team),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.all }),
  });
}

export function useUpdateTeamMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Team> }) =>
      teamService.updateTeam(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.all }),
  });
}

export function useDeleteTeamMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => teamService.deleteTeam(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.all }),
  });
}
