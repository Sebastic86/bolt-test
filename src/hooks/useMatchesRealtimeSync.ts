import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { matchKeys } from '../queries/matches';

/**
 * Subscribes once to Supabase realtime changes on the `matches` table and
 * invalidates the match queries so every open view refetches. Mount this
 * once, high in the tree (AppLayout) — not per-component — replacing the
 * old useMatchData hook's per-mount subscription + manual refetch-trigger
 * counter.
 */
export function useMatchesRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('matches-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => {
          queryClient.invalidateQueries({ queryKey: matchKeys.all });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
