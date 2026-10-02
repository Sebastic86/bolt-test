import { describe, expect, it } from 'vitest';
import { calculateTeamStandings } from './teamStatsUtils';
import { MatchHistoryItem, Team } from '../types';

function makeTeam(id: string): Team {
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
  };
}

function makeMatch(overrides: Partial<MatchHistoryItem> & { team1_id: string; team2_id: string }): MatchHistoryItem {
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
    team1_players: [],
    team2_players: [],
    ...overrides,
  };
}

describe('calculateTeamStandings', () => {
  it('returns a zeroed standing for every team when there are no matches', () => {
    const teamA = makeTeam('a');
    const result = calculateTeamStandings([], [teamA]);
    expect(result).toEqual([
      { teamId: 'a', teamName: 'Team a', logoUrl: '', totalMatches: 0, totalWins: 0, totalLosses: 0, winPercentage: 0, lossPercentage: 0 },
    ]);
  });

  it('excludes matches with a null score', () => {
    const teamA = makeTeam('a');
    const teamB = makeTeam('b');
    const match = makeMatch({ team1_id: teamA.id, team2_id: teamB.id, team1_score: null, team2_score: null });

    const result = calculateTeamStandings([match], [teamA, teamB]);
    expect(result.find(t => t.teamId === 'a')!.totalMatches).toBe(0);
  });

  it('awards the win to the penalties winner on a draw', () => {
    const teamA = makeTeam('a');
    const teamB = makeTeam('b');
    const match = makeMatch({ team1_id: teamA.id, team2_id: teamB.id, team1_score: 1, team2_score: 1, penalties_winner: 2 });

    const result = calculateTeamStandings([match], [teamA, teamB]);
    expect(result.find(t => t.teamId === 'a')!.totalLosses).toBe(1);
    expect(result.find(t => t.teamId === 'b')!.totalWins).toBe(1);
  });

  it('leaves both teams without a win/loss on a draw with no penalties winner', () => {
    const teamA = makeTeam('a');
    const teamB = makeTeam('b');
    const match = makeMatch({ team1_id: teamA.id, team2_id: teamB.id, team1_score: 1, team2_score: 1, penalties_winner: null });

    const result = calculateTeamStandings([match], [teamA, teamB]);
    expect(result.find(t => t.teamId === 'a')!.totalWins).toBe(0);
    expect(result.find(t => t.teamId === 'a')!.totalLosses).toBe(0);
    // but the match still counts toward totalMatches for both
    expect(result.find(t => t.teamId === 'a')!.totalMatches).toBe(1);
  });

  it('computes win/loss percentages across multiple matches', () => {
    const teamA = makeTeam('a');
    const teamB = makeTeam('b');
    const m1 = makeMatch({ team1_id: teamA.id, team2_id: teamB.id, team1_score: 3, team2_score: 0 });
    const m2 = makeMatch({ team1_id: teamA.id, team2_id: teamB.id, team1_score: 0, team2_score: 2 });

    const result = calculateTeamStandings([m1, m2], [teamA, teamB]);
    const a = result.find(t => t.teamId === 'a')!;
    expect(a.totalMatches).toBe(2);
    expect(a.totalWins).toBe(1);
    expect(a.totalLosses).toBe(1);
    expect(a.winPercentage).toBe(50);
    expect(a.lossPercentage).toBe(50);
  });

  it('ignores matches referencing a team not in the provided team list', () => {
    const teamB = makeTeam('b');
    const match = makeMatch({ team1_id: 'unknown', team2_id: teamB.id, team1_score: 1, team2_score: 0 });

    const result = calculateTeamStandings([match], [teamB]);
    expect(result.find(t => t.teamId === 'b')!.totalMatches).toBe(0);
  });
});
