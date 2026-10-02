import { describe, expect, it } from 'vitest';
import { groupMatchesIntoSessions } from './gameSessionUtils';
import { MatchHistoryItem } from '../types';

function makeMatch(overrides: Partial<MatchHistoryItem> & { id: string; played_at: string }): MatchHistoryItem {
  return {
    team1_id: 'a', team2_id: 'b', team1_score: null, team2_score: null, penalties_winner: null,
    created_at: overrides.played_at, created_by: null,
    team1_name: 'Team 1', team1_logoUrl: '', team1_version: 'FC26',
    team2_name: 'Team 2', team2_logoUrl: '', team2_version: 'FC26',
    team1_players: [], team2_players: [],
    ...overrides,
  };
}

describe('groupMatchesIntoSessions', () => {
  it('returns no sessions when there are no matches', () => {
    expect(groupMatchesIntoSessions([])).toEqual([]);
  });

  it('drops a day with only a single match — not a "session"', () => {
    const match = makeMatch({ id: 'm1', played_at: '2026-01-01T10:00:00Z' });
    expect(groupMatchesIntoSessions([match])).toEqual([]);
  });

  it('groups 2+ matches on the same day into one session', () => {
    const m1 = makeMatch({ id: 'm1', played_at: '2026-01-01T10:00:00Z' });
    const m2 = makeMatch({ id: 'm2', played_at: '2026-01-01T14:00:00Z' });

    const sessions = groupMatchesIntoSessions([m1, m2]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].date).toBe('2026-01-01');
    expect(sessions[0].displayDate).toBe('01/01/2026');
    expect(sessions[0].matches).toHaveLength(2);
  });

  it('keeps matches on different days in separate sessions, sorted most-recent-first', () => {
    const day1a = makeMatch({ id: 'm1', played_at: '2026-01-01T10:00:00Z' });
    const day1b = makeMatch({ id: 'm2', played_at: '2026-01-01T14:00:00Z' });
    const day2a = makeMatch({ id: 'm3', played_at: '2026-01-05T10:00:00Z' });
    const day2b = makeMatch({ id: 'm4', played_at: '2026-01-05T14:00:00Z' });

    const sessions = groupMatchesIntoSessions([day1a, day1b, day2a, day2b]);
    expect(sessions.map(s => s.date)).toEqual(['2026-01-05', '2026-01-01']);
  });

  it('sorts a session\'s own matches most-recent-first', () => {
    const earlier = makeMatch({ id: 'm1', played_at: '2026-01-01T10:00:00Z' });
    const later = makeMatch({ id: 'm2', played_at: '2026-01-01T14:00:00Z' });

    const sessions = groupMatchesIntoSessions([earlier, later]);
    expect(sessions[0].matches.map(m => m.id)).toEqual(['m2', 'm1']);
  });
});
