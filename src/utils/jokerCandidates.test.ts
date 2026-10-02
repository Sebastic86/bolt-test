import { describe, expect, it } from 'vitest';
import { getEligibleJokerTeams, pickJokerCandidates } from './jokerCandidates';
import { makeTeam } from '../test/fixtures';
import { Team } from '../types';

const nation = (id: string, ovr = 80): Team => ({ ...makeTeam(id, ovr), league: 'Nation' });

/** Deterministic rng cycling through the given values. */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('getEligibleJokerTeams', () => {
  const kept = makeTeam('kept', 80);
  const replaced = makeTeam('replaced', 80);

  it('excludes both current teams and applies the OVR + league rules against the kept team', () => {
    const pool = [kept, replaced, makeTeam('ok1', 83), makeTeam('tooHigh', 84), makeTeam('ok2', 77), nation('nat', 80)];
    const eligible = getEligibleJokerTeams({ pool, opponent: kept, excludeIds: [replaced.id], maxOvrDiff: 3 });
    expect(eligible.map(t => t.id)).toEqual(['ok1', 'ok2']);
  });

  it('only offers nations against a nation', () => {
    const pool = [makeTeam('club', 80), nation('n2', 81)];
    const eligible = getEligibleJokerTeams({ pool, opponent: nation('n1'), excludeIds: [], maxOvrDiff: 5 });
    expect(eligible.map(t => t.id)).toEqual(['n2']);
  });
});

describe('pickJokerCandidates', () => {
  const kept = makeTeam('kept', 80);
  const pool = ['a', 'b', 'c', 'd', 'e'].map(id => makeTeam(id, 80));

  it('draws 3 distinct teams without replacement using the injected rng', () => {
    // index 0 of [a..e] → a; index 0 of [b..e] → b; last of [c,d,e] → e
    const picked = pickJokerCandidates({ pool, opponent: kept, excludeIds: [], maxOvrDiff: 5, random: seq(0, 0, 0.99) });
    expect(picked.map(t => t.id)).toEqual(['a', 'b', 'e']);
  });

  it('never returns duplicates even with a constant rng', () => {
    const picked = pickJokerCandidates({ pool, opponent: kept, excludeIds: [], maxOvrDiff: 5, random: () => 0.5 });
    expect(new Set(picked.map(t => t.id)).size).toBe(3);
  });

  it('returns what is available when fewer than 3 are eligible, and [] when none are', () => {
    expect(pickJokerCandidates({ pool: pool.slice(0, 2), opponent: kept, excludeIds: [], maxOvrDiff: 5 })).toHaveLength(2);
    expect(pickJokerCandidates({ pool, opponent: kept, excludeIds: pool.map(t => t.id), maxOvrDiff: 5 })).toEqual([]);
  });

  it('tolerates an rng that returns exactly 1', () => {
    const picked = pickJokerCandidates({ pool, opponent: kept, excludeIds: [], maxOvrDiff: 5, random: () => 1 });
    expect(picked.map(t => t.id)).toEqual(['e', 'd', 'c']);
  });
});
