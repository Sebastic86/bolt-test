import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { matchKeys } from '../queries/matches';
import { nightKeys } from '../queries/nights';

/**
 * Subscribes once to Supabase realtime changes and invalidates the matching
 * queries so every open phone refetches. Mount this once, high in the tree
 * (AppLayout) — not per-component.
 *
 * A match insert also invalidates nights: DB triggers link the match to the
 * active night and attach open predictions to it.
 */
export function useMatchesRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidateMatches = () => {
      queryClient.invalidateQueries({ queryKey: matchKeys.all });
      queryClient.invalidateQueries({ queryKey: nightKeys.all });
    };
    const invalidateNights = () => queryClient.invalidateQueries({ queryKey: nightKeys.all });

    const channel = supabase
      .channel('app-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, invalidateMatches)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_nights' }, invalidateNights)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, invalidateNights)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'night_jokers' }, invalidateNights)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
