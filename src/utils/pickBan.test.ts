import { describe, expect, it } from 'vitest';
import {
  applyPickBanChoice,
  createPickBanState,
  drawPickBanOptions,
  getBestWindow,
  getPickBanResult,
  getPickBanStep,
  getRemainingOptions,
  undoPickBanChoice,
} from './pickBan';
import { buildMatchupStats } from './matchupAlgorithm';
import { makeTeam } from '../test/fixtures';
import { Team } from '../types';

const nation = (id: string, ovr = 80): Team => ({ ...makeTeam(id, ovr), league: 'Nation' });
const stats = buildMatchupStats([]);
const now = Date.UTC(2026, 9, 11);

/** Deterministic rng cycling through the given values. */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const ids = (teams: Team[]) => teams.map(t => t.id);

describe('getBestWindow', () => {
  it('picks the OVR window around the anchor with the most teams, same league type only', () => {
    const anchor = makeTeam('a', 80);
    const pool = [anchor, makeTeam('b', 82), makeTeam('c', 83), makeTeam('d', 77), makeTeam('e', 76), nation('n', 81)];
    // maxOvrDiff 3: [80,83] holds a,b,c; [77,80] holds a,d — the first wins.
    expect(ids(getBestWindow(pool, anchor, 3)).sort()).toEqual(['a', 'b', 'c']);
  });

  it('keeps nations with nations', () => {
    const anchor = nation('n1', 80);
    const pool = [anchor, nation('n2', 81), makeTeam('club', 80)];
    expect(ids(getBestWindow(pool, anchor, 5)).sort()).toEqual(['n1', 'n2']);
  });
});

describe('drawPickBanOptions', () => {
  const pool = Array.from({ length: 10 }, (_, i) => makeTeam(`t${i}`, 78 + (i % 5)));

  it('gives each side 3 distinct options, all within maxOvrDiff of each other', () => {
    const options = drawPickBanOptions({ pool, stats, now, maxOvrDiff: 4, random: seq(0.1, 0.7, 0.3, 0.9, 0.5) })!;
    expect(options[0]).toHaveLength(3);
    expect(options[1]).toHaveLength(3);
    const all = [...options[0], ...options[1]];
    expect(new Set(ids(all)).size).toBe(6);
    const ovrs = all.map(t => t.overallRating);
    expect(Math.max(...ovrs) - Math.min(...ovrs)).toBeLessThanOrEqual(4);
  });

  it('deals snake-style so the sides are close in total OVR', () => {
    const spread = [90, 88, 86, 84, 82, 80].map((ovr, i) => makeTeam(`s${i}`, ovr));
    const options = drawPickBanOptions({ pool: spread, stats, now, maxOvrDiff: 10, random: seq(0.2) })!;
    const sum = (ts: Team[]) => ts.reduce((a, t) => a + t.overallRating, 0);
    expect(Math.abs(sum(options[0]) - sum(options[1]))).toBeLessThanOrEqual(2);
  });

  it('falls back to 2 options per side when the window is small', () => {
    const small = [80, 81, 81, 82].map((ovr, i) => makeTeam(`x${i}`, ovr));
    const options = drawPickBanOptions({ pool: small, stats, now, maxOvrDiff: 2, random: seq(0.4) })!;
    expect(options[0]).toHaveLength(2);
    expect(options[1]).toHaveLength(2);
  });

  it('returns null when no window can fill 2 options per side', () => {
    const sparse = [70, 80, 90, 99].map((ovr, i) => makeTeam(`y${i}`, ovr));
    expect(drawPickBanOptions({ pool: sparse, stats, now, maxOvrDiff: 3, random: seq(0.5) })).toBeNull();
    expect(drawPickBanOptions({ pool: pool.slice(0, 3), stats, now, maxOvrDiff: 10 })).toBeNull();
  });
});

describe('pick & ban flow', () => {
  const side0 = [makeTeam('a1', 82), makeTeam('a2', 81), makeTeam('a3', 80)];
  const side1 = [makeTeam('b1', 82), makeTeam('b2', 81), makeTeam('b3', 80)];

  it('runs ban, ban, pick, pick and yields the matchup', () => {
    let s = createPickBanState([side0, side1]);
    expect(getPickBanStep(s)).toEqual({ kind: 'ban', actor: 0, target: 1 });

    s = applyPickBanChoice(s, 'b1');
    expect(getPickBanStep(s)).toEqual({ kind: 'ban', actor: 1, target: 0 });
    expect(ids(getRemainingOptions(s, 1))).toEqual(['b2', 'b3']);

    s = applyPickBanChoice(s, 'a2');
    expect(getPickBanStep(s)).toEqual({ kind: 'pick', actor: 0, target: 0 });

    s = applyPickBanChoice(s, 'a3');
    s = applyPickBanChoice(s, 'b2');
    expect(getPickBanStep(s)).toEqual({ kind: 'done' });
    expect(ids(getPickBanResult(s)!)).toEqual(['a3', 'b2']);
  });

  it('ignores invalid choices', () => {
    const s = createPickBanState([side0, side1]);
    expect(applyPickBanChoice(s, 'a1')).toBe(s); // side 0 must ban from side 1
    const banned = applyPickBanChoice(s, 'b1');
    const afterBan2 = applyPickBanChoice(banned, 'a1');
    expect(applyPickBanChoice(afterBan2, 'a1')).toBe(afterBan2); // banned team can't be picked
  });

  it('auto-fills picks with a single option left, and undo rolls them back with the ban', () => {
    let s = createPickBanState([side0.slice(0, 2), side1.slice(0, 2)]);
    s = applyPickBanChoice(s, 'b1');
    s = applyPickBanChoice(s, 'a1');
    expect(getPickBanStep(s)).toEqual({ kind: 'done' });
    expect(ids(getPickBanResult(s)!)).toEqual(['a2', 'b2']);

    s = undoPickBanChoice(s);
    expect(getPickBanStep(s)).toEqual({ kind: 'ban', actor: 1, target: 0 });
    expect(s.picks).toEqual([null, null]);
  });

  it('undo removes one manual step at a time', () => {
    let s = createPickBanState([side0, side1]);
    s = applyPickBanChoice(s, 'b1');
    s = applyPickBanChoice(s, 'a1');
    s = applyPickBanChoice(s, 'a2');
    s = undoPickBanChoice(s);
    expect(getPickBanStep(s)).toEqual({ kind: 'pick', actor: 0, target: 0 });
    s = undoPickBanChoice(s);
    s = undoPickBanChoice(s);
    expect(s).toEqual(createPickBanState([side0, side1]));
  });
});
