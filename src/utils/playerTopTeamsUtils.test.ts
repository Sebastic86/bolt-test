import { describe, expect, it } from 'vitest';
import { calculatePlayerTopTeams } from './playerTopTeamsUtils';
import { MatchHistoryItem, Player, Team } from '../types';

function makePlayer(id: string, name = id): Player {
  return { id, name, created_at: '2026-01-01T00:00:00Z' };
}

function makeTeam(id: string, name = `Team ${id}`): Team {
  return {
    id, name, league: 'Test League', rating: 4, logoUrl: `logo-${id}`,
    overallRating: 80, attackRating: 80, midfieldRating: 80, defendRating: 80, version: 'FC26',
  };
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

describe('calculatePlayerTopTeams', () => {
  it('excludes players with no completed matches', () => {
    const p1 = makePlayer('p1');
    const result = calculatePlayerTopTeams([p1], [], []);
    expect(result).toEqual([]);
  });

  it('excludes matches with a null score', () => {
    const p1 = makePlayer('p1');
    const teamA = makeTeam('a');
    const teamB = makeTeam('b');
    const match = makeMatch({ team1_id: teamA.id, team2_id: teamB.id, team1_players: [p1], team2_players: [], team1_score: null, team2_score: null });

    const result = calculatePlayerTopTeams([p1], [match], [teamA, teamB]);
    expect(result).toEqual([]);
  });

  it('tracks wins, goals, and matches played per team for a player', () => {
    const p1 = makePlayer('p1');
    const teamA = makeTeam('a');
    const teamB = makeTeam('b');
    const m1 = makeMatch({ team1_id: teamA.id, team2_id: teamB.id, team1_players: [p1], team2_players: [], team1_score: 3, team2_score: 1 });
    const m2 = makeMatch({ team1_id: teamA.id, team2_id: teamB.id, team1_players: [p1], team2_players: [], team1_score: 0, team2_score: 2 });

    const result = calculatePlayerTopTeams([p1], [m1, m2], [teamA, teamB]);
    expect(result).toHaveLength(1);
    const teamAStats = result[0].topTeams.find(t => t.teamId === 'a')!;
    expect(teamAStats.matchesPlayed).toBe(2);
    expect(teamAStats.wins).toBe(1);
    expect(teamAStats.goals).toBe(3);
  });

  it('caps at the top 3 teams, ranked by wins then goals', () => {
    const p1 = makePlayer('p1');
    const teams = ['a', 'b', 'c', 'd'].map(id => makeTeam(id));
    const opponent = makeTeam('x');

    // team a: 2 wins, team b: 1 win + 5 goals, team c: 1 win + 1 goal, team d: 0 wins
    const matches = [
      makeMatch({ team1_id: 'a', team2_id: opponent.id, team1_players: [p1], team2_players: [], team1_score: 1, team2_score: 0 }),
      makeMatch({ team1_id: 'a', team2_id: opponent.id, team1_players: [p1], team2_players: [], team1_score: 1, team2_score: 0 }),
      makeMatch({ team1_id: 'b', team2_id: opponent.id, team1_players: [p1], team2_players: [], team1_score: 5, team2_score: 0 }),
      makeMatch({ team1_id: 'c', team2_id: opponent.id, team1_players: [p1], team2_players: [], team1_score: 1, team2_score: 0 }),
      makeMatch({ team1_id: 'd', team2_id: opponent.id, team1_players: [p1], team2_players: [], team1_score: 0, team2_score: 1 }),
    ];

    const result = calculatePlayerTopTeams([p1], matches, [...teams, opponent]);
    expect(result[0].topTeams).toHaveLength(3);
    expect(result[0].topTeams.map(t => t.teamId)).toEqual(['a', 'b', 'c']);
  });

  it('sorts players alphabetically by name', () => {
    const p1 = makePlayer('p1', 'Zed');
    const p2 = makePlayer('p2', 'Alice');
    const teamA = makeTeam('a');
    const teamB = makeTeam('b');
    const m1 = makeMatch({ team1_id: teamA.id, team2_id: teamB.id, team1_players: [p1], team2_players: [p2], team1_score: 1, team2_score: 0 });

    const result = calculatePlayerTopTeams([p1, p2], [m1], [teamA, teamB]);
    expect(result.map(r => r.playerName)).toEqual(['Alice', 'Zed']);
  });
});
