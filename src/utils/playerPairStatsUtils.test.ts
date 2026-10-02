import { describe, expect, it } from 'vitest';
import { calculatePlayerPairStandings, getActivePlayers, indexPairStandings, pairKey } from './playerPairStatsUtils';
import { MatchHistoryItem, Player } from '../types';

function makePlayer(id: string, name = id): Player {
  return { id, name, created_at: '2026-01-01T00:00:00Z' };
}

function makeMatch(overrides: Partial<MatchHistoryItem> & {
  team1_id: string; team2_id: string; team1_players: Player[]; team2_players: Player[];
}): MatchHistoryItem {
  return {
    id: 'm-' + Math.random().toString(36).slice(2),
    team1_score: null, team2_score: null, penalties_winner: null,
    played_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z', created_by: null,
    team1_name: 'Team 1', team1_logoUrl: '', team1_version: 'FC26',
    team2_name: 'Team 2', team2_logoUrl: '', team2_version: 'FC26',
    ...overrides,
  };
}

describe('calculatePlayerPairStandings', () => {
  it('returns nothing when no pair has shared a team', () => {
    const p1 = makePlayer('p1');
    const p2 = makePlayer('p2');
    const match = makeMatch({ team1_id: 'a', team2_id: 'b', team1_players: [p1], team2_players: [p2], team1_score: 1, team2_score: 0 });

    expect(calculatePlayerPairStandings([p1, p2], [match])).toEqual([]);
  });

  it('excludes matches with a null score or an undecided draw', () => {
    const p1 = makePlayer('p1');
    const p2 = makePlayer('p2');
    const unplayed = makeMatch({ team1_id: 'a', team2_id: 'b', team1_players: [p1, p2], team2_players: [], team1_score: null, team2_score: null });
    const undecidedDraw = makeMatch({ team1_id: 'a', team2_id: 'b', team1_players: [p1, p2], team2_players: [], team1_score: 1, team2_score: 1, penalties_winner: null });

    expect(calculatePlayerPairStandings([p1, p2], [unplayed, undecidedDraw])).toEqual([]);
  });

  it('counts a win for a pair on the same team and a loss for the pair they faced', () => {
    const p1 = makePlayer('p1');
    const p2 = makePlayer('p2');
    const p3 = makePlayer('p3');
    const p4 = makePlayer('p4');
    const match = makeMatch({
      team1_id: 'a', team2_id: 'b',
      team1_players: [p1, p2], team2_players: [p3, p4],
      team1_score: 2, team2_score: 0,
    });

    const result = calculatePlayerPairStandings([p1, p2, p3, p4], [match]);
    expect(result).toHaveLength(2);
    const winners = result.find(r => [r.player1.id, r.player2.id].includes('p1'))!;
    const losers = result.find(r => [r.player1.id, r.player2.id].includes('p3'))!;
    expect(winners.wins).toBe(1);
    expect(winners.losses).toBe(0);
    expect(losers.wins).toBe(0);
    expect(losers.losses).toBe(1);
  });

  it('ignores a team with only one player (no pair to form)', () => {
    const p1 = makePlayer('p1');
    const p2 = makePlayer('p2');
    const match = makeMatch({ team1_id: 'a', team2_id: 'b', team1_players: [p1], team2_players: [p2], team1_score: 1, team2_score: 0 });

    expect(calculatePlayerPairStandings([p1, p2], [match])).toEqual([]);
  });

  it('sorts by total matches played, then win percentage, descending', () => {
    const p1 = makePlayer('p1');
    const p2 = makePlayer('p2');
    const p3 = makePlayer('p3');
    const p4 = makePlayer('p4');
    // p1+p2: 1 match together (win)
    const m1 = makeMatch({ team1_id: 'a', team2_id: 'b', team1_players: [p1, p2], team2_players: [], team1_score: 1, team2_score: 0 });
    // p3+p4: 2 matches together (1 win, 1 loss)
    const m2 = makeMatch({ team1_id: 'a', team2_id: 'b', team1_players: [p3, p4], team2_players: [], team1_score: 1, team2_score: 0 });
    const m3 = makeMatch({ team1_id: 'a', team2_id: 'b', team1_players: [], team2_players: [p3, p4], team1_score: 1, team2_score: 0 });

    const result = calculatePlayerPairStandings([p1, p2, p3, p4], [m1, m2, m3]);
    expect(result[0].totalMatches).toBe(2);
    expect(result[1].totalMatches).toBe(1);
  });
});

describe('pairKey / indexPairStandings', () => {
  it('produces the same key regardless of argument order', () => {
    expect(pairKey('a', 'b')).toBe(pairKey('b', 'a'));
  });

  it('looks up a pair standing from either player order', () => {
    const p1 = makePlayer('p1');
    const p2 = makePlayer('p2');
    const match = makeMatch({ team1_id: 'a', team2_id: 'b', team1_players: [p2, p1], team2_players: [], team1_score: 3, team2_score: 1 });

    const index = indexPairStandings(calculatePlayerPairStandings([p1, p2], [match]));
    expect(index.get(pairKey('p2', 'p1'))?.wins).toBe(1);
    expect(index.get(pairKey('p1', 'p2'))?.totalMatches).toBe(1);
  });
});

describe('getActivePlayers', () => {
  it('returns only players appearing in the matches, sorted by name', () => {
    const zoe = makePlayer('z', 'Zoe');
    const al = makePlayer('a', 'Al');
    const idle = makePlayer('i', 'Idle');
    const match = makeMatch({ team1_id: 'a', team2_id: 'b', team1_players: [zoe], team2_players: [al], team1_score: 1, team2_score: 0 });

    expect(getActivePlayers([zoe, idle, al], [match]).map(p => p.name)).toEqual(['Al', 'Zoe']);
  });
});
