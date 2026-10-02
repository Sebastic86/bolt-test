import { describe, expect, it } from 'vitest';
import {
  buildMatchupStats,
  getPairKey,
  getPairWeight,
  getSmartMatch,
  getSmartOpponent,
  getTeamWeight,
  getWeightedRandom,
} from './matchupAlgorithm';
import { MatchHistoryItem, Team } from '../types';

function team(id: string, overrides: Partial<Team> = {}): Team {
  return {
    id,
    name: `Team ${id}`,
    league: 'Test League',
    rating: 4,
    logoUrl: '',
    overallRating: 80,
    attackRating: 80,
    midfieldRating: 80,
    defendRating: 80,
    version: 'FC26',
    ...overrides,
  };
}

function match(team1Id: string, team2Id: string, playedAt: string): MatchHistoryItem {
  return {
    id: `${team1Id}-${team2Id}-${playedAt}`,
    team1_id: team1Id,
    team2_id: team2Id,
    team1_score: 1,
    team2_score: 0,
    penalties_winner: null,
    played_at: playedAt,
    created_at: playedAt,
    created_by: null,
    team1_name: '', team1_logoUrl: '', team1_version: 'FC26',
    team2_name: '', team2_logoUrl: '', team2_version: 'FC26',
    team1_players: [], team2_players: [],
  };
}

describe('getWeightedRandom', () => {
  it('returns null for an empty items array', () => {
    expect(getWeightedRandom([], () => 1)).toBeNull();
  });

  it('always returns the only item in a single-item array', () => {
    for (let i = 0; i < 10; i++) {
      expect(getWeightedRandom(['only'], () => Math.random())).toBe('only');
    }
  });

  it('never returns an item with zero relative weight when others have positive weight', () => {
    for (let i = 0; i < 30; i++) {
      const result = getWeightedRandom(['never', 'always'], item => (item === 'never' ? 0 : 1));
      expect(result).toBe('always');
    }
  });
});

describe('getPairKey', () => {
  it('is order-independent', () => {
    expect(getPairKey('a', 'b')).toBe(getPairKey('b', 'a'));
  });
});

describe('buildMatchupStats', () => {
  it('counts team appearances and tracks the most recent played_at per team and pair', () => {
    const stats = buildMatchupStats([
      match('a', 'b', '2026-01-01T00:00:00Z'),
      match('a', 'c', '2026-01-05T00:00:00Z'),
    ]);

    expect(stats.teamCounts.get('a')).toBe(2);
    expect(stats.teamCounts.get('b')).toBe(1);
    expect(stats.maxTeamCount).toBe(2);
    expect(stats.lastPlayed.get('a')).toBe(Date.parse('2026-01-05T00:00:00Z'));
    expect(stats.pairCounts.get(getPairKey('a', 'b'))).toBe(1);
  });

  it('returns empty stats for no matches', () => {
    const stats = buildMatchupStats([]);
    expect(stats.maxTeamCount).toBe(0);
    expect(stats.teamCounts.size).toBe(0);
  });
});

describe('getTeamWeight', () => {
  it('is deterministic for a fixed clock and gives a never-played team the max recency weight', () => {
    const stats = buildMatchupStats([match('a', 'b', '2026-01-01T00:00:00Z')]);
    const now = Date.parse('2026-01-10T00:00:00Z');

    const neverPlayedWeight = getTeamWeight('unseen-team', stats, now);
    const recentlyPlayedWeight = getTeamWeight('a', stats, now);

    // A team with no history gets MAX_RECENCY_DAYS+1 recency weight and the
    // full usage weight (maxTeamCount - 0 + 1); a team played 9 days ago
    // gets a smaller recency weight, so it should be weighted lower.
    expect(neverPlayedWeight).toBeGreaterThan(recentlyPlayedWeight);
  });
});

describe('getPairWeight', () => {
  it('decreases as two teams play each other more often', () => {
    const now = Date.parse('2026-01-10T00:00:00Z');
    const oncePlayed = buildMatchupStats([match('a', 'b', '2026-01-01T00:00:00Z')]);
    const thricePlayed = buildMatchupStats([
      match('a', 'b', '2026-01-01T00:00:00Z'),
      match('a', 'b', '2026-01-02T00:00:00Z'),
      match('a', 'b', '2026-01-03T00:00:00Z'),
    ]);

    const key = getPairKey('a', 'b');
    expect(getPairWeight(key, thricePlayed, now)).toBeLessThan(getPairWeight(key, oncePlayed, now));
  });
});

describe('getSmartOpponent', () => {
  const stats = buildMatchupStats([]);
  const now = Date.parse('2026-01-10T00:00:00Z');

  it('never returns the reference team itself', () => {
    const reference = team('a');
    const teams = [reference, team('b')];
    for (let i = 0; i < 15; i++) {
      const opponent = getSmartOpponent(teams, reference, stats, now);
      expect(opponent?.id).not.toBe('a');
    }
  });

  it('keeps Nation vs Nation and excludes Nation vs non-Nation', () => {
    const reference = team('nation-a', { league: 'Nation' });
    const teams = [reference, team('nation-b', { league: 'Nation' }), team('club-c', { league: 'Premier League' })];

    for (let i = 0; i < 15; i++) {
      const opponent = getSmartOpponent(teams, reference, stats, now, undefined, 'Nation');
      expect(opponent?.league).toBe('Nation');
    }
  });

  it('respects maxOvrDiff', () => {
    const reference = team('a', { overallRating: 80 });
    const teams = [reference, team('close', { overallRating: 82 }), team('far', { overallRating: 95 })];

    for (let i = 0; i < 15; i++) {
      const opponent = getSmartOpponent(teams, reference, stats, now, 5);
      expect(opponent?.id).toBe('close');
    }
  });

  it('returns null when no candidate satisfies the filters', () => {
    const reference = team('a', { overallRating: 80 });
    const teams = [reference, team('far', { overallRating: 95 })];
    expect(getSmartOpponent(teams, reference, stats, now, 5)).toBeNull();
  });
});

describe('getSmartMatch', () => {
  it('returns null when fewer than 2 teams are available', () => {
    const stats = buildMatchupStats([]);
    const now = Date.parse('2026-01-10T00:00:00Z');
    expect(getSmartMatch([team('a')], stats, now)).toBeNull();
    expect(getSmartMatch([], stats, now)).toBeNull();
  });

  it('returns two distinct teams when at least 2 are available', () => {
    const stats = buildMatchupStats([]);
    const now = Date.parse('2026-01-10T00:00:00Z');
    const result = getSmartMatch([team('a'), team('b')], stats, now);
    expect(result).not.toBeNull();
    expect(result![0].id).not.toBe(result![1].id);
  });
});
