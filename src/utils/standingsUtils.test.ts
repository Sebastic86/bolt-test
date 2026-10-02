import { describe, expect, it } from 'vitest';
import { calculateStandings } from './standingsUtils';
import { MatchHistoryItem, Player, Team } from '../types';

function makePlayer(id: string, name = id): Player {
  return { id, name, created_at: '2026-01-01T00:00:00Z' };
}

function makeTeam(id: string, overallRating = 80): Team {
  return {
    id,
    name: `Team ${id}`,
    league: 'Test League',
    rating: 4,
    logoUrl: '',
    overallRating,
    attackRating: overallRating,
    midfieldRating: overallRating,
    defendRating: overallRating,
    version: 'FC26',
  };
}

function makeMatch(overrides: Partial<MatchHistoryItem> & {
  team1_id: string;
  team2_id: string;
  team1_players: Player[];
  team2_players: Player[];
}): MatchHistoryItem {
  return {
    id: 'm-' + Math.random().toString(36).slice(2),
    team1_score: null,
    team2_score: null,
    penalties_winner: null,
    played_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    created_by: null,
    team1_name: 'Team 1',
    team1_logoUrl: '',
    team1_version: 'FC26',
    team2_name: 'Team 2',
    team2_logoUrl: '',
    team2_version: 'FC26',
    ...overrides,
  };
}

describe('calculateStandings', () => {
  it('returns a zeroed standing for every player when there are no matches', () => {
    const players = [makePlayer('p1'), makePlayer('p2')];
    const result = calculateStandings([], players, []);

    expect(result).toHaveLength(2);
    for (const standing of result) {
      expect(standing.points).toBe(0);
      expect(standing.goalsFor).toBe(0);
      expect(standing.goalsAgainst).toBe(0);
      expect(standing.goalDifference).toBe(0);
      expect(standing.matchesPlayed).toBe(0);
      expect(standing.totalOverallRating).toBe(0);
    }
  });

  it('excludes matches with a null score (unplayed) entirely', () => {
    const p1 = makePlayer('p1');
    const teamA = makeTeam('a');
    const teamB = makeTeam('b');
    const match = makeMatch({
      team1_id: teamA.id,
      team2_id: teamB.id,
      team1_players: [p1],
      team2_players: [],
      team1_score: null,
      team2_score: null,
    });

    const result = calculateStandings([match], [p1], [teamA, teamB]);
    expect(result[0].matchesPlayed).toBe(0);
    expect(result[0].goalsFor).toBe(0);
  });

  it('awards the point to the penalties winner on a draw', () => {
    const p1 = makePlayer('p1');
    const p2 = makePlayer('p2');
    const teamA = makeTeam('a');
    const teamB = makeTeam('b');
    const match = makeMatch({
      team1_id: teamA.id,
      team2_id: teamB.id,
      team1_players: [p1],
      team2_players: [p2],
      team1_score: 2,
      team2_score: 2,
      penalties_winner: 1,
    });

    const result = calculateStandings([match], [p1, p2], [teamA, teamB]);
    const s1 = result.find(s => s.playerId === 'p1')!;
    const s2 = result.find(s => s.playerId === 'p2')!;
    expect(s1.points).toBe(1);
    expect(s2.points).toBe(0);
    // both sides still get their goals/matches counted regardless of who won
    expect(s1.matchesPlayed).toBe(1);
    expect(s2.matchesPlayed).toBe(1);
  });

  it('awards no points to either side on a draw with no penalties winner', () => {
    const p1 = makePlayer('p1');
    const p2 = makePlayer('p2');
    const teamA = makeTeam('a');
    const teamB = makeTeam('b');
    const match = makeMatch({
      team1_id: teamA.id,
      team2_id: teamB.id,
      team1_players: [p1],
      team2_players: [p2],
      team1_score: 1,
      team2_score: 1,
      penalties_winner: null,
    });

    const result = calculateStandings([match], [p1, p2], [teamA, teamB]);
    expect(result.find(s => s.playerId === 'p1')!.points).toBe(0);
    expect(result.find(s => s.playerId === 'p2')!.points).toBe(0);
  });

  it('accumulates a player\'s stats across matches even when they switch sides', () => {
    const p1 = makePlayer('p1');
    const teamA = makeTeam('a');
    const teamB = makeTeam('b');
    const teamC = makeTeam('c');

    const match1 = makeMatch({
      team1_id: teamA.id,
      team2_id: teamB.id,
      team1_players: [p1],
      team2_players: [],
      team1_score: 3,
      team2_score: 1,
    });
    const match2 = makeMatch({
      team1_id: teamB.id,
      team2_id: teamC.id,
      team1_players: [],
      team2_players: [p1],
      team1_score: 0,
      team2_score: 2,
    });

    const result = calculateStandings([match1, match2], [p1], [teamA, teamB, teamC]);
    const standing = result[0];
    // match1: won as team1 (3-1) => +1 point, +3 GF, +1 GA
    // match2: won as team2 (0-2) => +1 point, +2 GF, +0 GA
    expect(standing.points).toBe(2);
    expect(standing.goalsFor).toBe(5);
    expect(standing.goalsAgainst).toBe(1);
    expect(standing.goalDifference).toBe(4);
    expect(standing.matchesPlayed).toBe(2);
  });

  it('still counts goals/points when the team_id has no matching team, but not matchesPlayed/avgOvr', () => {
    const p1 = makePlayer('p1');
    const teamB = makeTeam('b');
    const match = makeMatch({
      team1_id: 'unknown-team-id',
      team2_id: teamB.id,
      team1_players: [p1],
      team2_players: [],
      team1_score: 2,
      team2_score: 0,
    });

    // Note: teams list deliberately omits the team referenced by team1_id.
    const result = calculateStandings([match], [p1], [teamB]);
    const standing = result[0];
    expect(standing.points).toBe(1);
    expect(standing.goalsFor).toBe(2);
    // matchesPlayed/totalOverallRating are only incremented when the team lookup succeeds
    expect(standing.matchesPlayed).toBe(0);
    expect(standing.totalOverallRating).toBe(0);
  });

  it('sorts by points, then goal difference, then goals for', () => {
    const p1 = makePlayer('p1');
    const p2 = makePlayer('p2');
    const p3 = makePlayer('p3');
    const teamA = makeTeam('a');
    const teamB = makeTeam('b');

    // p1: 1 win 4-0 (points=1, GD=4, GF=4)
    const m1 = makeMatch({
      team1_id: teamA.id, team2_id: teamB.id,
      team1_players: [p1], team2_players: [],
      team1_score: 4, team2_score: 0,
    });
    // p2: 1 win 2-0 (points=1, GD=2, GF=2)
    const m2 = makeMatch({
      team1_id: teamA.id, team2_id: teamB.id,
      team1_players: [p2], team2_players: [],
      team1_score: 2, team2_score: 0,
    });
    // p3: 1 loss (points=0)
    const m3 = makeMatch({
      team1_id: teamA.id, team2_id: teamB.id,
      team1_players: [], team2_players: [p3],
      team1_score: 3, team2_score: 0,
    });

    const result = calculateStandings([m1, m2, m3], [p1, p2, p3], [teamA, teamB]);
    expect(result.map(s => s.playerId)).toEqual(['p1', 'p2', 'p3']);
  });
});
