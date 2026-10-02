import { describe, expect, it } from 'vitest';
import { Team } from '../types';
import { countTeamUsage, matchesLogoFilter, prioritizeByUsage } from './logoCandidates';
import { ALL_VERSIONS } from './versionFilter';

const team = (id: string, overrides: Partial<Team> = {}): Team => ({
  id,
  name: id,
  league: 'League',
  rating: 4,
  logoUrl: '',
  overallRating: 80,
  attackRating: 80,
  midfieldRating: 80,
  defendRating: 80,
  version: 'FC27',
  ...overrides,
});

describe('countTeamUsage', () => {
  it('counts both sides of every match', () => {
    const usage = countTeamUsage([
      { team1_id: 'a', team2_id: 'b' },
      { team1_id: 'b', team2_id: 'c' },
      { team1_id: 'a', team2_id: 'b' },
    ]);
    expect(Object.fromEntries(usage)).toEqual({ a: 2, b: 3, c: 1 });
  });
});

describe('matchesLogoFilter', () => {
  it('filters on version and minimum rating', () => {
    expect(matchesLogoFilter(team('a', { version: 'FC27', rating: 4 }), { version: 'FC27', minRating: 4 })).toBe(true);
    expect(matchesLogoFilter(team('a', { version: 'FC26', rating: 5 }), { version: 'FC27', minRating: 4 })).toBe(false);
    expect(matchesLogoFilter(team('a', { version: 'FC27', rating: 3.5 }), { version: 'FC27', minRating: 4 })).toBe(false);
  });

  it('treats All / missing values as no filter', () => {
    expect(matchesLogoFilter(team('a', { version: 'FC25', rating: 0.5 }), { version: ALL_VERSIONS })).toBe(true);
    expect(matchesLogoFilter(team('a', { version: 'FC25', rating: 0.5 }), {})).toBe(true);
  });
});

describe('prioritizeByUsage', () => {
  it('orders by matches played, then rating, then name', () => {
    const teams = [
      team('unused-low', { rating: 3 }),
      team('unused-high', { rating: 5 }),
      team('popular', { rating: 3 }),
      team('b-tie', { rating: 4 }),
      team('a-tie', { rating: 4 }),
    ];
    const usage = new Map([['popular', 9]]);
    expect(prioritizeByUsage(teams, usage).map(t => t.id)).toEqual(['popular', 'unused-high', 'a-tie', 'b-tie', 'unused-low']);
  });

  it('does not mutate the input', () => {
    const teams = [team('a', { rating: 3 }), team('b', { rating: 5 })];
    prioritizeByUsage(teams, new Map());
    expect(teams.map(t => t.id)).toEqual(['a', 'b']);
  });
});
