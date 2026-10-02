import { describe, expect, it } from 'vitest';
import {
  buildNightRecapData, buildRecapData, formatGoalDifference, formatNightTitle, formatRecapSubtitle, formatSessionSubtitle, recapFileName,
} from './recapData';
import { makeMatch, makeNight, makePlayer, makePrediction, makeTeam } from '../test/fixtures';

const [ana, bob, cas, dan] = ['ana', 'bob', 'cas', 'dan'].map(id => makePlayer(id, id.toUpperCase()));
const players = [ana, bob, cas, dan];
const teams = [makeTeam('t1'), makeTeam('t2')];

describe('buildRecapData', () => {
  const matches = [
    makeMatch([ana, bob], [cas, dan], 3, 1),
    makeMatch([ana, cas], [bob, dan], 2, 2, { penalties_winner: 1 }),
    makeMatch([ana], [bob, cas], 0, 5, { team1_name: 'Arsenal', team2_name: 'Chelsea' }),
    makeMatch([cas], [dan], 0, 0, { team1_score: null, team2_score: null }),
  ];

  it('summarises table, player of the night, biggest win and counts', () => {
    const data = buildRecapData({ title: 'FC27 Night #3', subtitle: 'Sat', matches, players, teams });

    expect(data.title).toBe('FC27 Night #3');
    expect(data.matchCount).toBe(4);
    expect(data.scoredCount).toBe(3);
    expect(data.totalGoals).toBe(13);
    expect(data.penaltyCount).toBe(1);
    expect(data.playerOfTheNight?.name).toBe('BOB');
    expect(data.playerOfTheNight?.gd).toBe('+7');
    expect(data.table.map(r => r.name)).toContain('ANA');
    const anaRow = data.table.find(r => r.playerId === 'ana')!;
    expect(anaRow).toMatchObject({ wins: 2, losses: 1, played: 3 });
    expect(data.biggestWin).toEqual({
      winnerTeam: 'Chelsea',
      loserTeam: 'Arsenal',
      winnerPlayers: ['BOB', 'CAS'],
      loserPlayers: ['ANA'],
      score: '5–0',
    });
    expect(data.predictionChampion).toBeNull();
  });

  it('picks the prediction champion from settled picks', () => {
    const [m1, m2] = matches;
    const predictions = [
      makePrediction({ player_id: 'cas', predicted_winner: 1, match_id: m1.id, predicted_team1_score: 3, predicted_team2_score: 1 }),
      makePrediction({ player_id: 'dan', predicted_winner: 1, match_id: m1.id }),
      makePrediction({ player_id: 'dan', predicted_winner: 2, match_id: m2.id }),
    ];
    const data = buildRecapData({ title: 't', subtitle: 's', matches, players, teams, predictions });
    expect(data.predictionChampion).toMatchObject({ name: 'CAS', points: 3, exact: 1, settled: 1 });
  });

  it('has no champion when nobody scored a point, and handles an unscored night', () => {
    const unscored = [makeMatch([ana], [bob], 0, 0, { team1_score: null, team2_score: null })];
    const predictions = [makePrediction({ player_id: 'cas', predicted_winner: 1, match_id: unscored[0].id })];
    const data = buildRecapData({ title: 't', subtitle: 's', matches: unscored, players, teams, predictions });
    expect(data.predictionChampion).toBeNull();
    expect(data.playerOfTheNight).toBeNull();
    expect(data.biggestWin).toBeNull();
    expect(data.table).toEqual([]);
    expect(data.matchCount).toBe(1);
    expect(data.scoredCount).toBe(0);
  });
});

describe('buildNightRecapData', () => {
  it('uses only the night matches and predictions, numbered by start time', () => {
    const nights = [
      makeNight('n1', '2026-10-17T18:00:00Z', '2026-10-17T22:00:00Z'),
      makeNight('n2', '2026-10-24T18:00:00Z', '2026-10-24T22:00:00Z'),
    ];
    const tonight = makeMatch([ana], [bob], 2, 0, { game_night_id: 'n2' });
    const lastWeek = makeMatch([ana], [bob], 0, 4, { game_night_id: 'n1' });
    const predictions = [
      makePrediction({ game_night_id: 'n2', player_id: 'cas', predicted_winner: 1, match_id: tonight.id }),
      makePrediction({ game_night_id: 'n1', player_id: 'dan', predicted_winner: 2, match_id: lastWeek.id }),
    ];
    const data = buildNightRecapData(nights[1], { nights, allMatches: [tonight, lastWeek], players, teams, predictions });
    expect(data.title).toBe('FC27 Night #2');
    expect(data.matchCount).toBe(1);
    expect(data.playerOfTheNight?.name).toBe('ANA');
    expect(data.predictionChampion?.name).toBe('CAS');
    expect(data.subtitle).toContain('24/10/2026');
  });
});

describe('formatting helpers', () => {
  it('formats titles with or without version/number', () => {
    expect(formatNightTitle('FC27', 3)).toBe('FC27 · Night #3');
    expect(formatNightTitle('FC27', 3, ' ')).toBe('FC27 Night #3');
    expect(formatNightTitle(null, 2)).toBe('Night #2');
    expect(formatNightTitle(null, null)).toBe('Game night');
  });

  it('formats goal difference', () => {
    expect(formatGoalDifference(4)).toBe('+4');
    expect(formatGoalDifference(-2)).toBe('-2');
    expect(formatGoalDifference(0)).toBe('0');
  });

  it('formats subtitles in local time', () => {
    const start = new Date(2026, 9, 24, 20, 14).toISOString();
    const end = new Date(2026, 9, 24, 23, 40).toISOString();
    expect(formatRecapSubtitle(start, end)).toBe('Sat 24/10/2026 · 20:14–23:40');
    expect(formatRecapSubtitle(start, null)).toBe('Sat 24/10/2026 · 20:14');
  });

  it('builds a session subtitle from first to last match', () => {
    const late = makeMatch([ana], [bob], 1, 0, { played_at: new Date(2026, 9, 24, 22, 5).toISOString() });
    const early = makeMatch([ana], [bob], 1, 0, { played_at: new Date(2026, 9, 24, 20, 0).toISOString() });
    expect(formatSessionSubtitle([late, early])).toBe('Sat 24/10/2026 · 20:00–22:05');
    expect(formatSessionSubtitle([])).toBe('');
  });

  it('slugifies file names', () => {
    expect(recapFileName('FC27 · Night #3')).toBe('fc27-night-3.png');
    expect(recapFileName('Game night · 24/10/2026')).toBe('game-night-24-10-2026.png');
    expect(recapFileName('···')).toBe('recap.png');
  });
});
