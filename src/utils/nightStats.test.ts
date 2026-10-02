import { describe, expect, it } from 'vitest';
import {
  calculateNightSummary, getJokersRemaining, getMatchWinner, getNightMatches, getNightNumber, getNightPlayers, isNightStale,
} from './nightStats';
import { makeMatch, makeNight, makePlayer, makeTeam } from '../test/fixtures';
import { NightJoker } from '../types';

const [ana, bob, cas, dan] = ['ana', 'bob', 'cas', 'dan'].map(id => makePlayer(id));
const players = [ana, bob, cas, dan];
const teams = [makeTeam('t1'), makeTeam('t2')];

describe('getMatchWinner', () => {
  it('uses the score, then penalties, else null', () => {
    expect(getMatchWinner({ team1_score: 2, team2_score: 1, penalties_winner: null })).toBe(1);
    expect(getMatchWinner({ team1_score: 0, team2_score: 3, penalties_winner: null })).toBe(2);
    expect(getMatchWinner({ team1_score: 1, team2_score: 1, penalties_winner: 2 })).toBe(2);
    expect(getMatchWinner({ team1_score: 1, team2_score: 1, penalties_winner: null })).toBeNull();
    expect(getMatchWinner({ team1_score: null, team2_score: null, penalties_winner: null })).toBeNull();
  });
});

describe('getNightMatches / getNightNumber / isNightStale', () => {
  it('keeps only the night\'s matches, oldest first', () => {
    const late = makeMatch([ana], [bob], 1, 0, { game_night_id: 'n1', minute: 50 });
    const early = makeMatch([ana], [bob], 1, 0, { game_night_id: 'n1', minute: 10 });
    const other = makeMatch([ana], [bob], 1, 0, { game_night_id: 'n2' });
    expect(getNightMatches([late, other, early], 'n1').map(m => m.id)).toEqual([early.id, late.id]);
  });

  it('numbers nights by start time', () => {
    const nights = [makeNight('b', '2026-10-31T18:00:00Z'), makeNight('a', '2026-10-24T18:00:00Z')];
    expect(getNightNumber(nights, 'a')).toBe(1);
    expect(getNightNumber(nights, 'b')).toBe(2);
    expect(getNightNumber(nights, 'zzz')).toBeNull();
  });

  it('flags open nights older than 12 hours', () => {
    const night = makeNight('n1', '2026-10-24T18:00:00Z');
    expect(isNightStale(night, Date.parse('2026-10-24T23:00:00Z'))).toBe(false);
    expect(isNightStale(night, Date.parse('2026-10-25T07:00:00Z'))).toBe(true);
    expect(isNightStale({ ...night, ended_at: '2026-10-24T23:00:00Z' }, Date.parse('2026-10-26T00:00:00Z'))).toBe(false);
  });
});

describe('calculateNightSummary', () => {
  it('builds a table of tonight\'s players with wins/losses and a player of the night', () => {
    const matches = [
      makeMatch([ana, bob], [cas, dan], 3, 1),
      makeMatch([ana, cas], [bob, dan], 2, 2, { penalties_winner: 1 }),
      makeMatch([ana], [bob, cas], 0, 5),
    ];
    const summary = calculateNightSummary(matches, players, teams);

    expect(summary.matchCount).toBe(3);
    expect(summary.totalGoals).toBe(13);
    expect(summary.penaltyCount).toBe(1);
    expect(summary.biggestWin?.id).toBe(matches[2].id);
    // ana and bob both have 2 points; bob's goal difference (+7) beats ana's (-3).
    expect(summary.playerOfTheNight?.playerId).toBe('bob');
    const anaLine = summary.table.find(l => l.playerId === 'ana')!;
    expect([anaLine.wins, anaLine.losses, anaLine.points]).toEqual([2, 1, 2]);
    expect(summary.table.every(l => l.matchesPlayed > 0)).toBe(true);
  });

  it('has no player of the night before any result', () => {
    const summary = calculateNightSummary([], players, teams);
    expect(summary.table).toEqual([]);
    expect(summary.playerOfTheNight).toBeNull();
    expect(summary.biggestWin).toBeNull();
  });
});

describe('getJokersRemaining', () => {
  it('subtracts used jokers, never below zero', () => {
    const joker = (player_id: string): NightJoker => ({
      id: Math.random().toString(), game_night_id: 'n1', player_id,
      replaced_team_id: null, chosen_team_id: null, used_at: '', created_by: null,
    });
    const left = getJokersRemaining(players, [joker('ana'), joker('ana'), joker('bob')], 1);
    expect(left.get('ana')).toBe(0);
    expect(left.get('bob')).toBe(0);
    expect(left.get('cas')).toBe(1);
  });
});

describe('getNightPlayers', () => {
  it('returns the night\'s players, or everyone when the list is empty or stale', () => {
    expect(getNightPlayers({ player_ids: ['ana', 'cas'] }, players).map(p => p.id)).toEqual(['ana', 'cas']);
    expect(getNightPlayers({ player_ids: [] }, players)).toEqual(players);
    expect(getNightPlayers({ player_ids: ['gone'] }, players)).toEqual(players);
  });
});

describe('players of the night', () => {
  it('shares the title when the top is level on points, GD and GF', () => {
    const summary = calculateNightSummary([makeMatch([ana, bob], [cas, dan], 5, 0)], players, teams);
    expect(summary.playersOfTheNight.map(l => l.playerId).sort()).toEqual(['ana', 'bob']);
    expect(summary.playerOfTheNightName).toMatch(/^(ana & bob|bob & ana)$/);
  });

  it('names a single winner when there is no tie', () => {
    const summary = calculateNightSummary([makeMatch([ana], [bob, cas], 2, 0)], players, teams);
    expect(summary.playerOfTheNightName).toBe('ana');
  });
});
