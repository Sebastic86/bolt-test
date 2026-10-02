import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as nightService from '../services/nightService';

export const nightKeys = {
  all: ['nights'] as const,
  active: () => [...nightKeys.all, 'active'] as const,
  list: () => [...nightKeys.all, 'list'] as const,
  predictions: (nightId?: string) => [...nightKeys.all, 'predictions', nightId ?? 'all'] as const,
  jokers: (nightId: string) => [...nightKeys.all, 'jokers', nightId] as const,
};

/** The running game night, or null. Realtime-invalidated (useMatchesRealtimeSync). */
export function useActiveNightQuery() {
  return useQuery({
    queryKey: nightKeys.active(),
    queryFn: nightService.fetchActiveNight,
  });
}

/** Every night, newest first — for numbering ("Night #3") and past recaps. */
export function useNightsQuery() {
  return useQuery({
    queryKey: nightKeys.list(),
    queryFn: nightService.fetchNights,
  });
}

/** Predictions for one night, or for all nights when nightId is omitted (season leaderboard). */
export function usePredictionsQuery(nightId?: string | null, options: { allNights?: boolean } = {}) {
  const enabled = options.allNights || !!nightId;
  return useQuery({
    queryKey: nightKeys.predictions(options.allNights ? undefined : nightId ?? undefined),
    queryFn: () => nightService.fetchPredictions(options.allNights ? undefined : nightId ?? undefined),
    enabled,
  });
}

export function useJokersQuery(nightId: string | null | undefined) {
  return useQuery({
    queryKey: nightKeys.jokers(nightId ?? 'none'),
    queryFn: () => nightService.fetchJokers(nightId!),
    enabled: !!nightId,
  });
}

function useInvalidateNights() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: nightKeys.all });
}

export function useStartNightMutation() {
  const invalidate = useInvalidateNights();
  return useMutation({ mutationFn: nightService.startNight, onSuccess: invalidate });
}

export function useEndNightMutation() {
  const invalidate = useInvalidateNights();
  return useMutation({ mutationFn: nightService.endNight, onSuccess: invalidate });
}

export function usePlacePredictionMutation() {
  const invalidate = useInvalidateNights();
  return useMutation({ mutationFn: nightService.placePrediction, onSuccess: invalidate });
}

export function useDeletePredictionMutation() {
  const invalidate = useInvalidateNights();
  return useMutation({ mutationFn: nightService.deletePrediction, onSuccess: invalidate });
}

export function useJokerMutation() {
  const invalidate = useInvalidateNights();
  return useMutation({ mutationFn: nightService.spendJoker, onSuccess: invalidate });
}
