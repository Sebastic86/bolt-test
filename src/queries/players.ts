import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as playerService from '../services/playerService';

export const playerKeys = {
  all: ['players'] as const,
};

export function usePlayersQuery() {
  return useQuery({
    queryKey: playerKeys.all,
    queryFn: playerService.fetchAllPlayers,
  });
}

export function useCreatePlayerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => playerService.createPlayer(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: playerKeys.all }),
  });
}

export function useUpdatePlayerNameMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      playerService.updatePlayerName(id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: playerKeys.all }),
  });
}

export function useUploadPlayerAvatarMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ playerId, file }: { playerId: string; file: File }) =>
      playerService.uploadPlayerAvatar(playerId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: playerKeys.all }),
  });
}

export function useRemovePlayerAvatarMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (playerId: string) => playerService.removePlayerAvatar(playerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: playerKeys.all }),
  });
}
