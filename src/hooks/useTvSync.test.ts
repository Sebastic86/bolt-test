import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { auth: { getSession }, channel: vi.fn() } }));

import { sendBroadcast } from './useTvSync';

type Channel = Parameters<typeof sendBroadcast>[0];

describe('sendBroadcast', () => {
  const fetchMock = vi.fn();
  const channel = { send: vi.fn() } as unknown as Channel;

  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.example');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 202 }));
    getSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'user-token' } } });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('posts the message to the Realtime HTTP endpoint, not the websocket', async () => {
    await sendBroadcast(channel, 'matchup', { team1Id: 'a', team2Id: 'b', at: 1 });

    expect(channel.send).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://supabase.example/realtime/v1/api/broadcast');
    expect(init.headers).toMatchObject({ apikey: 'anon-key', Authorization: 'Bearer user-token' });
    expect(JSON.parse(init.body)).toEqual({
      messages: [{ topic: 'tv-matchup', event: 'matchup', payload: { team1Id: 'a', team2Id: 'b', at: 1 } }],
    });
  });

  it('falls back to the anon key without a session', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await sendBroadcast(channel, 'hello', {});
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer anon-key');
  });

  it('rejects when the server refuses the broadcast', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    await expect(sendBroadcast(channel, 'hello', {})).rejects.toThrow(/HTTP 500/);
  });

  it('uses the channel in mock mode', async () => {
    vi.stubEnv('MODE', 'mock');
    await sendBroadcast(channel, 'hello', {});
    expect(channel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'hello', payload: {} });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
