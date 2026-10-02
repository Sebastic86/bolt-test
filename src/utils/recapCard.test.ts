import { describe, expect, it, vi } from 'vitest';
import { drawRecapCard, fitText, RECAP_HEIGHT, RECAP_WIDTH, RecapContext } from './recapCard';
import { RecapData } from './recapData';

function fakeContext() {
  const ctx = {
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    fillRect: vi.fn(),
    fillText: vi.fn(),
    // ~0.6em per character at the current font size.
    measureText: vi.fn((text: string) => {
      const size = Number(/(\d+)px/.exec(ctx.font)?.[1] ?? 10);
      return { width: text.length * size * 0.6 } as TextMetrics;
    }),
    save: vi.fn(),
    restore: vi.fn(),
  };
  return ctx;
}

const data: RecapData = {
  title: 'FC27 Night #3',
  subtitle: 'Sat 24/10/2026 · 20:14–23:40',
  playerOfTheNight: { playerId: 'bob', name: 'Bob', played: 3, wins: 2, losses: 1, points: 2, gd: '+7' },
  playerOfTheNightName: 'Bob',
  table: [
    { playerId: 'bob', name: 'Bob', played: 3, wins: 2, losses: 1, points: 2, gd: '+7' },
    { playerId: 'ana', name: 'Ana', played: 3, wins: 2, losses: 1, points: 2, gd: '-3' },
  ],
  biggestWin: { winnerTeam: 'Chelsea', loserTeam: 'Arsenal', winnerPlayers: ['Bob'], loserPlayers: ['Ana'], score: '5–0' },
  predictionChampion: { playerId: 'cas', name: 'Cas', points: 3, exact: 1, correct: 1, settled: 1 },
  matchCount: 4,
  scoredCount: 3,
  totalGoals: 13,
  penaltyCount: 1,
};

const drawnTexts = (ctx: ReturnType<typeof fakeContext>) => ctx.fillText.mock.calls.map(c => c[0] as string);

describe('drawRecapCard', () => {
  it('paints the background and writes the uppercase title, player of the night and highlights', () => {
    const ctx = fakeContext();
    drawRecapCard(ctx as unknown as RecapContext, data);

    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, RECAP_WIDTH, RECAP_HEIGHT);
    const texts = drawnTexts(ctx);
    expect(texts).toContain('FC27 NIGHT #3');
    expect(texts).toContain('BOB');
    expect(texts).toContain('ANA');
    expect(texts).toContain('CHELSEA 5–0 ARSENAL');
    expect(texts.some(t => t.startsWith('CAS · 3 PTS'))).toBe(true);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('keeps every text call inside the card', () => {
    const ctx = fakeContext();
    drawRecapCard(ctx as unknown as RecapContext, data);
    for (const [, x, y] of ctx.fillText.mock.calls) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(RECAP_WIDTH);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThanOrEqual(RECAP_HEIGHT);
    }
  });

  it('handles an empty night', () => {
    const ctx = fakeContext();
    drawRecapCard(ctx as unknown as RecapContext, {
      ...data, playerOfTheNight: null, table: [], biggestWin: null, predictionChampion: null,
    });
    const texts = drawnTexts(ctx);
    expect(texts).toContain('NO RESULTS YET');
    expect(texts).toContain('NO SCORED MATCHES');
  });
});

describe('fitText', () => {
  it('ellipsizes text that does not fit', () => {
    const ctx = { measureText: (t: string) => ({ width: t.length * 10 }) as TextMetrics };
    expect(fitText(ctx, 'short', 100)).toBe('short');
    expect(fitText(ctx, 'a very long player name', 100)).toBe('a very lo…');
    expect(fitText(ctx, 'abc', 5)).toBe('');
  });
});
