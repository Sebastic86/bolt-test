import { describe, expect, it } from 'vitest';
import { combineMatchData } from './matchTransforms';
import { Match, MatchPlayer, Player, Team } from '../types';

function team(id: string): Team {
  return {
    id,
    name: `Team ${id}`,
    league: 'Test League',
    rating: 4,
    logoUrl: `https://example.com/${id}.png`,
    overallRating: 80,
    attackRating: 80,
    midfieldRating: 80,
    defendRating: 80,
    version: 'FC26',
  };
}

function player(id: string): Player {
  return { id, name: `Player ${id}`, created_at: '2026-01-01T00:00:00Z' };
}

function match(id: string, team1Id: string, team2Id: string): Match {
  return {
    id,
    team1_id: team1Id,
    team2_id: team2Id,
    team1_score: 1,
    team2_score: 0,
    penalties_winner: null,
    played_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    created_by: null,
  };
}

function matchPlayer(matchId: string, playerId: string, teamNumber: 1 | 2): MatchPlayer {
  return { id: `mp-${matchId}-${playerId}`, match_id: matchId, player_id: playerId, team_number: teamNumber, created_at: '2026-01-01T00:00:00Z' };
}

describe('combineMatchData', () => {
  it('gives a match with no match_players rows empty player arrays on both sides', () => {
    const m = match('m1', 'a', 'b');
    const [result] = combineMatchData([m], [], [team('a'), team('b')], []);

    expect(result.team1_players).toEqual([]);
    expect(result.team2_players).toEqual([]);
    expect(result.team1_name).toBe('Team a');
    expect(result.team2_name).toBe('Team b');
  });

  it('falls back to "Unknown Team" and empty logo/version when a team_id has no matching team', () => {
    const m = match('m1', 'missing-team', 'b');
    const [result] = combineMatchData([m], [], [team('b')], []);

    expect(result.team1_name).toBe('Unknown Team');
    expect(result.team1_logoUrl).toBe('');
    expect(result.team1_version).toBe('');
    expect(result.team2_name).toBe('Team b');
  });

  it('filters out a match_players row whose player_id has no matching player', () => {
    const m = match('m1', 'a', 'b');
    const p1 = player('p1');
    const mp = [
      matchPlayer('m1', p1.id, 1),
      matchPlayer('m1', 'orphaned-player-id', 1),
    ];

    const [result] = combineMatchData([m], mp, [team('a'), team('b')], [p1]);

    expect(result.team1_players).toEqual([p1]);
  });

  it('splits players onto the correct side by team_number and only for their own match', () => {
    const m1 = match('m1', 'a', 'b');
    const m2 = match('m2', 'a', 'b');
    const p1 = player('p1');
    const p2 = player('p2');
    const p3 = player('p3');

    const mp = [
      matchPlayer('m1', p1.id, 1),
      matchPlayer('m1', p2.id, 2),
      matchPlayer('m2', p3.id, 1), // belongs to m2, must not leak into m1
    ];

    const [r1, r2] = combineMatchData([m1, m2], mp, [team('a'), team('b')], [p1, p2, p3]);

    expect(r1.team1_players).toEqual([p1]);
    expect(r1.team2_players).toEqual([p2]);
    expect(r2.team1_players).toEqual([p3]);
    expect(r2.team2_players).toEqual([]);
  });

  it('returns an empty array for an empty matches list', () => {
    expect(combineMatchData([], [], [], [])).toEqual([]);
  });
});
