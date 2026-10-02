import { describe, expect, it } from 'vitest';
import { MatchHistoryItem, Player } from '../types';
import {
  formatStatDifference,
  getFilterWarning,
  getHighlightedMatchIds,
  getLocalDateKey,
  getMatchResult,
  getMatchResultForSide,
  getStatDifferences,
  groupMatchesIntoLocalSessions,
  inferPerspective,
} from './matchDisplay';

const player = (id: string, name = `Player ${id}`): Player => ({ id, name, created_at: '2026-01-01T00:00:00Z' });

function makeMatch(overrides: Partial<MatchHistoryItem> & { id: string }): MatchHistoryItem {
  return {
    team1_id: 'a', team2_id: 'b', team1_score: null, team2_score: null, penalties_winner: null,
    played_at: '2026-01-01T12:00:00', created_at: '2026-01-01T12:00:00', created_by: null,
    team1_name: 'Arsenal', team1_logoUrl: '', team1_version: 'FC26',
    team2_name: 'Chelsea', team2_logoUrl: '', team2_version: 'FC26',
    team1_players: [], team2_players: [],
    ...overrides,
  };
}

describe('getMatchResultForSide / getMatchResult', () => {
  it('reports No Score for an unscored match', () => {
    expect(getMatchResultForSide(makeMatch({ id: 'm' }), 1)).toBe('No Score');
  });

  it('reports Win/Loss from each side', () => {
    const m = makeMatch({ id: 'm', team1_score: 3, team2_score: 1 });
    expect(getMatchResultForSide(m, 1)).toBe('Win');
    expect(getMatchResultForSide(m, 2)).toBe('Loss');
  });

  it('reports Win (P)/Loss (P) for a draw settled on penalties', () => {
    const m = makeMatch({ id: 'm', team1_score: 2, team2_score: 2, penalties_winner: 2 });
    expect(getMatchResultForSide(m, 1)).toBe('Loss (P)');
    expect(getMatchResultForSide(m, 2)).toBe('Win (P)');
  });

  it('reports Draw for a level score without a penalties winner', () => {
    expect(getMatchResultForSide(makeMatch({ id: 'm', team1_score: 1, team2_score: 1 }), 1)).toBe('Draw');
  });

  it('resolves the side from a team perspective', () => {
    const m = makeMatch({ id: 'm', team1_score: 0, team2_score: 1 });
    expect(getMatchResult(m, { kind: 'team', teamId: 'b' })).toBe('Win');
    expect(getMatchResult(m, { kind: 'team', teamId: 'a' })).toBe('Loss');
    expect(getMatchResult(m, { kind: 'team', teamId: 'zzz' })).toBeNull();
  });

  it('resolves the side from a player perspective', () => {
    const m = makeMatch({ id: 'm', team1_score: 4, team2_score: 2, team1_players: [player('p1')], team2_players: [player('p2')] });
    expect(getMatchResult(m, { kind: 'player', playerId: 'p1' })).toBe('Win');
    expect(getMatchResult(m, { kind: 'player', playerId: 'p2' })).toBe('Loss');
    expect(getMatchResult(m, { kind: 'player', playerId: 'p3' })).toBeNull();
  });
});

describe('inferPerspective', () => {
  it('infers the team present in every match whose name is in the title', () => {
    const matches = [
      makeMatch({ id: 'm1', team1_id: 'a', team2_id: 'b' }),
      makeMatch({ id: 'm2', team1_id: 'c', team1_name: 'Celtic', team2_id: 'a', team2_name: 'Arsenal' }),
    ];
    expect(inferPerspective(matches, 'Matches — Arsenal')).toEqual({ kind: 'team', teamId: 'a' });
  });

  it('infers the player present in every match whose name is in the title', () => {
    const p1 = player('p1', 'Seb');
    const matches = [
      makeMatch({ id: 'm1', team1_players: [p1] }),
      makeMatch({ id: 'm2', team1_id: 'x', team1_name: 'X', team2_id: 'y', team2_name: 'Y', team2_players: [p1, player('p2', 'Tom')] }),
    ];
    expect(inferPerspective(matches, 'Matches — Seb')).toEqual({ kind: 'player', playerId: 'p1' });
  });

  it('returns null when nothing in the title matches, or for no matches', () => {
    expect(inferPerspective([makeMatch({ id: 'm1' })], 'Matches — Nobody')).toBeNull();
    expect(inferPerspective([], 'Matches — Arsenal')).toBeNull();
  });
});

describe('getHighlightedMatchIds', () => {
  it('picks the biggest margin, breaking ties on total goals', () => {
    const matches = [
      makeMatch({ id: 'small', team1_score: 1, team2_score: 0 }),
      makeMatch({ id: 'big-low', team1_score: 3, team2_score: 0 }),
      makeMatch({ id: 'big-high', team1_score: 1, team2_score: 4 }),
      makeMatch({ id: 'unscored' }),
    ];
    expect([...getHighlightedMatchIds(matches)]).toEqual(['big-high']);
  });

  it('is empty when nothing is scored', () => {
    expect(getHighlightedMatchIds([makeMatch({ id: 'm' })]).size).toBe(0);
  });
});

describe('local-day game sessions', () => {
  it('keys a timestamp by its LOCAL calendar day', () => {
    // Constructed from local components, so this holds in any test timezone.
    const lateEvening = new Date(2026, 2, 14, 23, 45).toISOString();
    expect(getLocalDateKey(lateEvening)).toBe('2026-03-14');
    expect(getLocalDateKey('not a date')).toBeNull();
  });

  it('groups 2+ matches per local day, newest first, dropping single-match days', () => {
    const at = (d: number, h: number) => new Date(2026, 2, d, h, 0).toISOString();
    const sessions = groupMatchesIntoLocalSessions([
      makeMatch({ id: 'a1', played_at: at(14, 20) }),
      makeMatch({ id: 'a2', played_at: at(14, 23) }),
      makeMatch({ id: 'b1', played_at: at(15, 1) }),
      makeMatch({ id: 'c1', played_at: at(16, 19) }),
      makeMatch({ id: 'c2', played_at: at(16, 21) }),
    ]);
    expect(sessions.map(s => s.date)).toEqual(['2026-03-16', '2026-03-14']);
    expect(sessions[1].displayDate).toBe('14/03/2026');
    expect(sessions[1].matches.map(m => m.id)).toEqual(['a2', 'a1']);
  });
});

describe('stat differences', () => {
  it('subtracts the opponent per stat', () => {
    const a = { overallRating: 85, attackRating: 88, midfieldRating: 80, defendRating: 82 };
    const b = { overallRating: 82, attackRating: 90, midfieldRating: 80, defendRating: 79 };
    expect(getStatDifferences(a, b)).toEqual({ overall: 3, attack: -2, midfield: 0, defend: 3 });
  });

  it('formats +n, −n and ±0', () => {
    expect(formatStatDifference(4)).toBe('+4');
    expect(formatStatDifference(-2)).toBe('−2');
    expect(formatStatDifference(0)).toBe('±0');
  });
});

describe('getFilterWarning', () => {
  const base = { totalTeams: 50, minRating: 4, maxRating: 5, excludeNations: false, selectedVersion: 'FC26' };

  it('warns when fewer than 2 teams match the filter', () => {
    const w = getFilterWarning({ ...base, filteredCount: 1, availableCount: 1 });
    expect(w?.kind).toBe('too-few-teams');
    expect(w?.message).toContain('Only 1 team matches');
    expect(w?.message).toContain('4.0–5.0 stars, FC26');
  });

  it('warns when every filtered team has played today', () => {
    const w = getFilterWarning({ ...base, filteredCount: 6, availableCount: 0 });
    expect(w?.kind).toBe('all-played-today');
    expect(w?.message).toContain('All 6 teams');
  });

  it('warns when only one filtered team is left unplayed', () => {
    expect(getFilterWarning({ ...base, filteredCount: 6, availableCount: 1 })?.kind).toBe('all-played-today');
  });

  it('is silent when a matchup is possible, or there are no teams at all', () => {
    expect(getFilterWarning({ ...base, filteredCount: 6, availableCount: 2 })).toBeNull();
    expect(getFilterWarning({ ...base, totalTeams: 0, filteredCount: 0, availableCount: 0 })).toBeNull();
  });
});
