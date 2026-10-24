import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Team } from '../types';
import {
  isTvMatchup, pickNewerMatchup, TV_CHANNEL, TV_EVENT_HELLO, TV_EVENT_MATCHUP, TvMatchup,
} from '../utils/tvSync';

type Channel = ReturnType<typeof supabase.channel>;

const openChannel = () => supabase.channel(TV_CHANNEL, { config: { broadcast: { self: false } } });

/**
 * Sends over Realtime's HTTP endpoint instead of the websocket: the
 * self-hosted Realtime server (older than v2.97) closes the socket with 1011
 * on every websocket broadcast from this client version, while HTTP
 * broadcasts are delivered to subscribers fine. (`httpSend()` needs v2.97+.)
 * The mock client has no server, so it keeps using the channel.
 */
export async function sendBroadcast(channel: Channel, event: string, payload: unknown): Promise<void> {
  if (import.meta.env.MODE === 'mock') {
    await channel.send({ type: 'broadcast', event, payload });
    return;
  }
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${data.session?.access_token ?? anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages: [{ topic: TV_CHANNEL, event, payload }] }),
  });
  if (!response.ok) throw new Error(`Realtime broadcast failed: HTTP ${response.status}`);
}

const send = (channel: Channel | null, event: string, payload: unknown) => {
  if (!channel) return;
  void sendBroadcast(channel, event, payload).catch(err => {
    // Best effort: the TV also falls back to tonight's predictions.
    console.warn(`[tv] ${event} not sent:`, err instanceof Error ? err.message : err);
  });
};

interface PublisherOptions {
  match: [Team, Team] | null;
  /** When `match` was last set by an explicit action (null = only the automatic first draw). */
  matchSetAt: number | null;
  pendingMatch: [Team, Team] | null;
  isAnimating: boolean;
}

/**
 * Phone side (mounted once in AppLayout): announces the matchup to any TV
 * after an explicit action, and answers a TV's "hello". The automatic draw
 * on page load is never announced — otherwise every phone that opens the app
 * would flip the TV to its own random matchup.
 */
export function useTvMatchupPublisher({ match, matchSetAt, pendingMatch, isAnimating }: PublisherOptions) {
  const channelRef = useRef<Channel | null>(null);
  const latestRef = useRef<TvMatchup | null>(null);

  useEffect(() => {
    const channel = openChannel();
    channel
      .on('broadcast', { event: TV_EVENT_HELLO }, () => {
        if (latestRef.current) send(channel, TV_EVENT_MATCHUP, { ...latestRef.current, reveal: false });
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, []);

  // A reveal just started on this phone: let the TV play it along.
  const pending1 = pendingMatch?.[0].id;
  const pending2 = pendingMatch?.[1].id;
  useEffect(() => {
    if (!isAnimating || !pending1 || !pending2) return;
    const message: TvMatchup = { team1Id: pending1, team2Id: pending2, at: Date.now(), reveal: true };
    latestRef.current = message;
    send(channelRef.current, TV_EVENT_MATCHUP, message);
  }, [isAnimating, pending1, pending2]);

  // Matchup committed or changed by hand (joker, edit, rematch swap).
  const match1 = match?.[0].id;
  const match2 = match?.[1].id;
  useEffect(() => {
    if (matchSetAt === null || !match1 || !match2) return;
    const message: TvMatchup = { team1Id: match1, team2Id: match2, at: matchSetAt };
    latestRef.current = message;
    send(channelRef.current, TV_EVENT_MATCHUP, message);
  }, [matchSetAt, match1, match2]);
}

/**
 * TV side: listens for announcements and asks the phones for their current
 * matchup on connect and whenever the TV page becomes visible again.
 */
export function useTvMatchupSubscriber(): TvMatchup | null {
  const [matchup, setMatchup] = useState<TvMatchup | null>(null);

  useEffect(() => {
    const channel = openChannel();
    const sayHello = () => send(channel, TV_EVENT_HELLO, {});
    channel
      .on('broadcast', { event: TV_EVENT_MATCHUP }, ({ payload }: { payload: unknown }) => {
        if (isTvMatchup(payload)) setMatchup(current => pickNewerMatchup(current, payload));
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') sayHello();
      });

    const onVisible = () => {
      if (document.visibilityState === 'visible') sayHello();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, []);

  return matchup;
}
