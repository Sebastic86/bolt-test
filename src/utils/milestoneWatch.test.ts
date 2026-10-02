import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_SHOWN_IDS, RECENT_WINDOW_MS, SEEN_STORAGE_KEY, SHOWN_STORAGE_KEY,
  resultKey, runMilestoneWatch, summarizePredictions, WatchInput,
} from './milestoneWatch';
import { makeMatch, makePlayer, makePrediction, makeTeam } from '../test/fixtures';
import { MatchHistoryItem, Prediction } from '../types';

const [ana, bob] = ['ana', 'bob'].map(id => makePlayer(id, id === 'ana' ? 'Ana' : 'Bob'));
const players = [ana, bob];
const teams = [makeTeam('t1', 80), makeTeam('t2', 80)];

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

let storage: MemoryStorage;
/** "now" = 30 minutes after the fixture's base time (2026-10-24 18:00Z). */
const NOW = Date.UTC(2026, 9, 24, 18, 30);

const run = (matches: MatchHistoryItem[], extra: Partial<WatchInput> = {}) =>
  runMilestoneWatch({ matches, teams, players, predictions: [], storage, now: NOW, ...extra });

const unscored = (m: MatchHistoryItem): MatchHistoryItem => ({ ...m, team1_score: null, team2_score: null });
const fc26 = (m: MatchHistoryItem): MatchHistoryItem => ({ ...m, team1_version: 'FC26', team2_version: 'FC26' });

beforeEach(() => {
  storage = new MemoryStorage();
});

describe('resultKey', () => {
  it('is null for unscored or undecided matches', () => {
    expect(resultKey(unscored(makeMatch([ana], [bob], 0, 0)))).toBeNull();
    expect(resultKey(makeMatch([ana], [bob], 1, 1))).toBeNull();
  });

  it('includes score and penalties winner', () => {
    const m = makeMatch([ana], [bob], 2, 2, { penalties_winner: 1 });
    expect(resultKey(m)).toBe(`${m.id}:2-2:1`);
    const n = makeMatch([ana], [bob], 3, 1);
    expect(resultKey(n)).toBe(`${n.id}:3-1:`);
  });
});

describe('runMilestoneWatch', () => {
  it('seeds silently on first load so nothing replays', () => {
    const opener = makeMatch([ana], [bob], 5, 0, { minute: 10 });
    expect(run([opener])).toEqual([]);
    expect(JSON.parse(storage.getItem(SEEN_STORAGE_KEY)!)).toEqual([resultKey(opener)]);
    expect(run([opener])).toEqual([]);
  });

  it('toasts milestones (biggest last) when a new score lands, then never again', () => {
    const pending = unscored(makeMatch([ana], [bob], 0, 0, { minute: 10 }));
    run([pending]); // seed

    const scored = { ...pending, team1_score: 6, team2_score: 0 };
    const toasts = run([scored]);
    // FC27 season opener (6) + demolition (4)
    expect(toasts.map(t => t.variant)).toEqual(['milestone', 'milestone']);
    expect(toasts[toasts.length - 1].title).toBe('FC27 kicks off!');
    expect(toasts[0].title).toBe('Demolition');

    // StrictMode / refetch re-run → nothing.
    expect(run([scored])).toEqual([]);
  });

  it('shows at most 3 milestones', () => {
    const history = [0, 1].map(i => fc26(makeMatch([ana], [bob], 1, 0, { minute: i })));
    const pending = unscored(makeMatch([ana], [bob], 0, 0, { minute: 10 }));
    run([...history, pending]);
    // win streak 3 + season opener + demolition + night hat-trick → capped at 3
    const toasts = run([...history, { ...pending, team1_score: 6, team2_score: 0 }]);
    expect(toasts).toHaveLength(3);
  });

  it('re-evaluates a corrected score without repeating shown milestones', () => {
    const pending = unscored(makeMatch([ana], [bob], 0, 0, { minute: 10 }));
    run([pending]);
    const first = run([{ ...pending, team1_score: 6, team2_score: 0 }]);
    expect(first.map(t => t.title)).toContain('FC27 kicks off!');

    // Corrected to 7-0: opener + demolition ids already shown.
    expect(run([{ ...pending, team1_score: 7, team2_score: 0 }])).toEqual([]);

    // Corrected to a win for Bob: the opener id is the same, nothing new to say.
    expect(run([{ ...pending, team1_score: 0, team2_score: 1 }])).toEqual([]);
  });

  it('waits while the match has no players yet, then toasts', () => {
    const pending = unscored(makeMatch([], [], 0, 0, { minute: 10 }));
    run([pending]);
    const noPlayers = { ...pending, team1_score: 6, team2_score: 0 };
    expect(run([noPlayers])).toEqual([]);
    expect(JSON.parse(storage.getItem(SEEN_STORAGE_KEY)!)).toEqual([]);

    const withPlayers = { ...noPlayers, team1_players: [ana], team2_players: [bob] };
    expect(run([withPlayers]).length).toBeGreaterThan(0);
  });

  it('gives up on matches without players once they are older than the window', () => {
    const pending = unscored(makeMatch([], [], 0, 0, { minute: 10 }));
    run([pending]);
    const noPlayers = { ...pending, team1_score: 6, team2_score: 0 };
    const later = Date.parse(pending.played_at) + RECENT_WINDOW_MS + 1;
    expect(run([noPlayers], { now: later })).toEqual([]);
    expect(JSON.parse(storage.getItem(SEEN_STORAGE_KEY)!)).toEqual([resultKey(noPlayers)]);
  });

  it('ignores scores entered for matches played more than 6h ago', () => {
    const pending = unscored(makeMatch([ana], [bob], 0, 0, { minute: 10 }));
    run([pending]);
    const later = Date.parse(pending.played_at) + RECENT_WINDOW_MS + 1;
    expect(run([{ ...pending, team1_score: 6, team2_score: 0 }], { now: later })).toEqual([]);
  });

  it('caps the shown-id list', () => {
    storage.setItem(SEEN_STORAGE_KEY, '[]');
    storage.setItem(SHOWN_STORAGE_KEY, JSON.stringify(Array.from({ length: MAX_SHOWN_IDS }, (_, i) => `old${i}`)));
    run([makeMatch([ana], [bob], 6, 0, { minute: 10 })]);
    const shown = JSON.parse(storage.getItem(SHOWN_STORAGE_KEY)!) as string[];
    expect(shown).toHaveLength(MAX_SHOWN_IDS);
    expect(shown[0]).not.toBe('old0');
  });

  describe('predictions', () => {
    const setup = (predictionsFor: (matchId: string) => Prediction[] | null) => {
      const pending = unscored(makeMatch([ana], [bob], 0, 0, { minute: 10 }));
      run([pending]);
      const scored = { ...pending, team1_score: 3, team2_score: 1 };
      return { scored, toasts: run([scored], { predictions: predictionsFor(scored.id) }) };
    };

    it('summarises who scored points, first in the list (bottom of the stack)', () => {
      const { scored, toasts } = setup(id => [
        makePrediction({ player_id: 'ana', predicted_winner: 1, match_id: id }),
        makePrediction({ player_id: 'bob', predicted_winner: 1, predicted_team1_score: 3, predicted_team2_score: 1, match_id: id }),
      ]);
      expect(toasts[0]).toEqual({
        id: `predictions:${scored.id}:${resultKey(scored)}`,
        title: 'Predictions',
        detail: 'Bob called it 3-1 (+3), Ana +1',
        variant: 'success',
      });
    });

    it('says nobody saw it coming when every pick was wrong', () => {
      const { toasts } = setup(id => [makePrediction({ player_id: 'ana', predicted_winner: 2, match_id: id })]);
      expect(toasts.find(t => t.variant === 'success')?.detail).toBe('Nobody saw that coming!');
    });

    it('skips the toast when nobody predicted or predictions are unavailable', () => {
      expect(setup(() => []).toasts.some(t => t.variant === 'success')).toBe(false);
      storage = new MemoryStorage();
      expect(setup(() => null).toasts.some(t => t.variant === 'success')).toBe(false);
    });

    it('ignores predictions linked to other matches', () => {
      const m = makeMatch([ana], [bob], 1, 0);
      expect(summarizePredictions(m, [makePrediction({ player_id: 'ana', predicted_winner: 1, match_id: 'other' })], players)).toBeNull();
    });
  });
});
