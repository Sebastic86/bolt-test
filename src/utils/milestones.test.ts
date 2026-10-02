import { describe, expect, it } from 'vitest';
import { detectMilestones, MilestoneKind } from './milestones';
import { makeMatch, makePlayer, makeTeam } from '../test/fixtures';
import { MatchHistoryItem } from '../types';

const [ana, bob, cas, dan] = ['ana', 'bob', 'cas', 'dan'].map(id => makePlayer(id));
const teams = [makeTeam('t1', 80), makeTeam('t2', 80)];

const kinds = (match: MatchHistoryItem, all: MatchHistoryItem[], t = teams) =>
  detectMilestones(match, all, t).map(m => m.kind);

/** Older FC26 history so the FC27 season opener doesn't fire unless wanted. */
const fc26 = (m: MatchHistoryItem) => ({ ...m, team1_version: 'FC26', team2_version: 'FC26' });

describe('detectMilestones', () => {
  it('celebrates the first match of a new version', () => {
    const old = fc26(makeMatch([ana], [bob], 1, 0, { minute: 0 }));
    const opener = makeMatch([ana], [bob], 2, 1, { minute: 10 });
    expect(kinds(opener, [old, opener])).toContain('season-opener');
    const second = makeMatch([ana], [bob], 2, 1, { minute: 20 });
    expect(kinds(second, [old, opener, second])).not.toContain('season-opener');
  });

  it('detects a 3-win streak and ignores later matches', () => {
    const ms = [0, 1, 2].map(i => fc26(makeMatch([ana], [bob], 1, 0, { minute: i })));
    const later = fc26(makeMatch([bob], [ana], 1, 0, { minute: 9 }));
    const streak = detectMilestones(ms[2], [...ms, later], teams).find(m => m.kind === 'win-streak');
    expect(streak?.detail).toBe('3 wins in a row!');
    expect(streak?.playerIds).toEqual(['ana']);
  });

  it('detects a drought ending and a first win over someone', () => {
    const losses = [0, 1, 2].map(i => fc26(makeMatch([ana], [bob], 0, 1, { minute: i })));
    const win = fc26(makeMatch([ana], [bob], 1, 0, { minute: 5 }));
    const found: MilestoneKind[] = kinds(win, [...losses, win]);
    expect(found).toContain('drought-over');
    expect(found).toContain('first-win-over');
  });

  it('detects revenge only after a heavy defeat', () => {
    const win = fc26(makeMatch([ana], [bob], 1, 0, { minute: 0 }));
    const thrashed = fc26(makeMatch([bob], [ana], 5, 0, { minute: 1 }));
    const revenge = fc26(makeMatch([ana], [bob], 2, 1, { minute: 2 }));
    expect(kinds(revenge, [win, thrashed, revenge])).toContain('revenge');

    const narrow = fc26(makeMatch([bob], [ana], 1, 0, { minute: 1 }));
    const payback = fc26(makeMatch([ana], [bob], 2, 1, { minute: 2 }));
    expect(kinds(payback, [win, narrow, payback])).not.toContain('revenge');
  });

  it('detects hammering, giant killing and penalties', () => {
    const hammer = fc26(makeMatch([ana, bob], [cas, dan], 6, 0));
    expect(kinds(hammer, [hammer])).toContain('hammering');
    expect(detectMilestones(hammer, [hammer], teams).find(m => m.kind === 'hammering')?.title).toBe('Demolition');

    const upset = fc26(makeMatch([ana], [bob], 1, 0));
    expect(kinds(upset, [upset], [makeTeam('t1', 75), makeTeam('t2', 82)])).toContain('giant-killer');

    const pens = fc26(makeMatch([ana], [bob], 2, 2, { penalties_winner: 2 }));
    expect(kinds(pens, [pens])).toContain('penalties');
  });

  it('detects a third win on the same night', () => {
    const nightOf = (i: number, s1: number, s2: number) =>
      fc26(makeMatch([ana], [bob], s1, s2, { minute: i, game_night_id: 'n1' }));
    const ms = [nightOf(0, 1, 0), nightOf(1, 0, 1), nightOf(2, 1, 0), nightOf(3, 1, 0)];
    expect(kinds(ms[3], ms)).toContain('night-hat-trick');
    expect(kinds(ms[2], ms)).not.toContain('night-hat-trick');
  });

  it('counts group and player match milestones', () => {
    const history = Array.from({ length: 49 }, (_, i) => fc26(makeMatch([cas], [dan], 1, 0, { minute: i })));
    const fiftieth = fc26(makeMatch([ana], [bob], 0, 0, { minute: 100, penalties_winner: null }));
    expect(kinds(fiftieth, [...history, fiftieth])).toContain('group-match-count');
  });

  it('sorts by priority and gives stable ids', () => {
    const old = fc26(makeMatch([ana], [bob], 1, 0, { minute: 0 }));
    const opener = makeMatch([ana], [bob], 7, 0, { minute: 10 });
    const result = detectMilestones(opener, [old, opener], teams);
    expect(result[0].kind).toBe('season-opener');
    expect(result.map(m => m.priority)).toEqual([...result.map(m => m.priority)].sort((a, b) => b - a));
    expect(new Set(result.map(m => m.id)).size).toBe(result.length);
  });
});
