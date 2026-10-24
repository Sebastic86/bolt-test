import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { logRealtimeSystemError, TV_REFRESH_MS, useTvPeriodicRefresh } from './useMatchesRealtimeSync';

function renderRefresh() {
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useTvPeriodicRefresh(), { wrapper });
  const refreshedKeys = () => invalidate.mock.calls.map(([filters]) => filters?.queryKey?.[0]);
  return { ...hook, invalidate, refreshedKeys };
}

describe('logRealtimeSystemError', () => {
  it('warns about a refused subscription and stays quiet otherwise', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logRealtimeSystemError('matches-realtime', { status: 'ok', message: 'Subscribed to PostgreSQL' });
    expect(warn).not.toHaveBeenCalled();

    logRealtimeSystemError('matches-realtime', { status: 'error', message: 'Unable to subscribe to changes' });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/matches-realtime: Unable to subscribe.*supabase_realtime publication/));
    warn.mockRestore();
  });
});

describe('useTvPeriodicRefresh', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('refetches matches and nights on an interval', () => {
    const { invalidate, refreshedKeys } = renderRefresh();
    expect(invalidate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(TV_REFRESH_MS);
    expect(refreshedKeys()).toEqual(['matches', 'nights']);
  });

  it('refetches right away when the screen wakes up or the network returns', () => {
    const { invalidate } = renderRefresh();

    document.dispatchEvent(new Event('visibilitychange'));
    expect(invalidate).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new Event('online'));
    expect(invalidate).toHaveBeenCalledTimes(4);
  });

  it('stops when TV mode closes', () => {
    const { invalidate, unmount } = renderRefresh();
    unmount();
    vi.advanceTimersByTime(TV_REFRESH_MS * 2);
    window.dispatchEvent(new Event('online'));
    expect(invalidate).not.toHaveBeenCalled();
  });
});
