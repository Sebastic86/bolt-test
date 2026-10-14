import { describe, expect, it } from 'vitest';
import { getMatchupFromPredictions, isTvMatchup, pickNewerMatchup, resolveTvMatchup, TvMatchup } from './tvSync';
import { Prediction } from '../types';

const m = (team1Id: string, team2Id: string, at: number): TvMatchup => ({ team1Id, team2Id, at });

const pick = (overrides: Partial<Prediction>): Prediction => ({
  id: 'p', game_night_id: 'n1', player_id: 'alex', team1_id: 'a', team2_id: 'b',
  predicted_winner: 1, predicted_team1_score: null, predicted_team2_score: null,
  match_id: null, created_by: null, created_at: '2026-10-13T19:00:00Z',
  ...overrides,
});

describe('isTvMatchup', () => {
  it('accepts a well-formed payload and rejects junk', () => {
    expect(isTvMatchup(m('a', 'b', 1))).toBe(true);
    expect(isTvMatchup({ team1Id: 'a', team2Id: 'a', at: 1 })).toBe(false);
    expect(isTvMatchup({ team1Id: 'a', team2Id: 'b' })).toBe(false);
    expect(isTvMatchup({ team1Id: '', team2Id: 'b', at: 1 })).toBe(false);
    expect(isTvMatchup(null)).toBe(false);
  });
});

describe('pickNewerMatchup', () => {
  it('keeps the newest announcement', () => {
    expect(pickNewerMatchup(null, m('a', 'b', 1))).toEqual(m('a', 'b', 1));
    expect(pickNewerMatchup(m('a', 'b', 5), m('c', 'd', 3))).toEqual(m('a', 'b', 5));
    expect(pickNewerMatchup(m('a', 'b', 5), m('c', 'd', 9))).toEqual(m('c', 'd', 9));
  });

  it('keeps the current one on a tie', () => {
    const current = m('a', 'b', 5);
    expect(pickNewerMatchup(current, m('c', 'd', 5))).toBe(current);
  });
});

describe('getMatchupFromPredictions', () => {
  it("uses tonight's newest open pick", () => {
    const predictions = [
      pick({ id: '1', team1_id: 'a', team2_id: 'b', created_at: '2026-10-13T19:00:00Z' }),
      pick({ id: '2', team1_id: 'c', team2_id: 'd', created_at: '2026-10-13T19:30:00Z' }),
      pick({ id: '3', team1_id: 'e', team2_id: 'f', created_at: '2026-10-13T20:00:00Z', match_id: 'm1' }),
      pick({ id: '4', team1_id: 'g', team2_id: 'h', created_at: '2026-10-13T21:00:00Z', game_night_id: 'other' }),
    ];
    expect(getMatchupFromPredictions(predictions, 'n1')).toEqual(m('c', 'd', Date.parse('2026-10-13T19:30:00Z')));
  });

  it('returns null without a night or open picks', () => {
    expect(getMatchupFromPredictions([pick({})], null)).toBeNull();
    expect(getMatchupFromPredictions([pick({ match_id: 'm1' })], 'n1')).toBeNull();
  });
});

describe('resolveTvMatchup', () => {
  it('takes whichever source is newer', () => {
    expect(resolveTvMatchup(null, null)).toBeNull();
    expect(resolveTvMatchup(m('a', 'b', 1), null)).toEqual(m('a', 'b', 1));
    expect(resolveTvMatchup(null, m('c', 'd', 1))).toEqual(m('c', 'd', 1));
    expect(resolveTvMatchup(m('a', 'b', 10), m('c', 'd', 5))).toEqual(m('a', 'b', 10));
    expect(resolveTvMatchup({ ...m('a', 'b', 5), reveal: true }, m('c', 'd', 10))).toEqual(m('c', 'd', 10));
  });
});
