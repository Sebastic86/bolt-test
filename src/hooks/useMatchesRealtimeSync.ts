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
 *
 * Night tables use a separate channel: Realtime rejects a whole channel if
 * any of its tables isn't published, and matches must keep syncing even if
 * the match_nights migration hasn't been applied.
 */
export function useMatchesRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidateMatches = () => {
      queryClient.invalidateQueries({ queryKey: matchKeys.all });
      queryClient.invalidateQueries({ queryKey: nightKeys.all });
    };
    const invalidateNights = () => queryClient.invalidateQueries({ queryKey: nightKeys.all });

    const matchesChannel = supabase
      .channel('matches-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, invalidateMatches)
      .subscribe();

    const nightsChannel = supabase
      .channel('nights-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_nights' }, invalidateNights)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, invalidateNights)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'night_jokers' }, invalidateNights)
      .subscribe();

    return () => {
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(nightsChannel);
    };
  }, [queryClient]);
}
