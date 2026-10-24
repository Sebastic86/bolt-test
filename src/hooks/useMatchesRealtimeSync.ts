import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { matchKeys } from '../queries/matches';
import { nightKeys } from '../queries/nights';

/**
 * Realtime reports a table that isn't in the supabase_realtime publication
 * only as a `system` message — the channel itself still says SUBSCRIBED — so
 * log it, or a missing publication goes unnoticed.
 */
export function logRealtimeSystemError(channel: string, payload: { status?: string; message?: string }) {
  if (payload?.status === 'error') {
    console.warn(`[realtime] ${channel}: ${payload.message ?? 'subscription failed'} — is the table in the supabase_realtime publication?`);
  }
}

/**
 * Subscribes once to Supabase realtime changes and invalidates the matching
 * queries so every open phone refetches. Mount this once, high in the tree
 * (AppLayout) — not per-component.
 *
 * A match insert also invalidates nights: DB triggers link the match to the
 * active night and attach open predictions to it. match_players is watched
 * too: players are saved just after their match, so the match event alone can
 * refetch a result before its players exist.
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
      .on('system', {}, (payload: { status?: string; message?: string }) => logRealtimeSystemError('matches-realtime', payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, invalidateMatches)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_players' }, invalidateMatches)
      .subscribe();

    const nightsChannel = supabase
      .channel('nights-realtime')
      .on('system', {}, (payload: { status?: string; message?: string }) => logRealtimeSystemError('nights-realtime', payload))
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

/** How often TV mode refetches on its own, in case Realtime is down or the tablet's socket dropped. */
export const TV_REFRESH_MS = 45_000;

/**
 * TV mode safety net: nobody touches the TV screen, so it can't rely on
 * Realtime alone. Refetches matches and nights every TV_REFRESH_MS, and right
 * away when the screen wakes up or the network comes back (Realtime doesn't
 * replay events missed while the socket was down).
 */
export function useTvPeriodicRefresh() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: matchKeys.all });
      queryClient.invalidateQueries({ queryKey: nightKeys.all });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    const id = setInterval(refresh, TV_REFRESH_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refresh);
    };
  }, [queryClient]);
}
