import { describe, expect, it } from 'vitest';
import { mapScanToMatch, ScanReading, teamNameSimilarity } from './scanResult';

const reading = (overrides: Partial<ScanReading> = {}): ScanReading => ({
  found: true,
  home_team: 'Real Madrid',
  away_team: 'FC Barcelona',
  home_score: 2,
  away_score: 1,
  home_penalties: null,
  away_penalties: null,
  ...overrides,
});

describe('teamNameSimilarity', () => {
  it.each([
    ['Real Madrid', 'Real Madrid', 1],
    ['FC Barcelona', 'Barcelona', 1],
    ['Bayern', 'FC Bayern München', 0.9],
    ['PSG', 'Paris Saint-Germain', 0.9],
  ])('%s ~ %s', (read, ours, expected) => {
    expect(teamNameSimilarity(read, ours)).toBeCloseTo(expected, 5);
  });

  it('matches EA short names by token prefix', () => {
    expect(teamNameSimilarity('Man City', 'Manchester City')).toBeGreaterThan(0.8);
    expect(teamNameSimilarity('Atlético', 'Atlético de Madrid')).toBeGreaterThan(0.5);
  });

  it('keeps similar-sounding clubs apart', () => {
    expect(teamNameSimilarity('Man City', 'Manchester United')).toBeLessThan(teamNameSimilarity('Man City', 'Manchester City'));
    expect(teamNameSimilarity('Real Madrid', 'FC Barcelona')).toBe(0);
  });
});

describe('mapScanToMatch', () => {
  it('keeps screen order when it matches team1/team2', () => {
    const r = mapScanToMatch(reading(), 'Real Madrid', 'FC Barcelona');
    expect(r).toEqual({ ok: true, outcome: { team1Score: 2, team2Score: 1, penaltiesWinner: null, swapped: false, teamsMatched: true, warnings: [] } });
  });

  it('swaps the scores when our team2 was home in the game', () => {
    const r = mapScanToMatch(reading({ home_team: 'Barcelona', away_team: 'Real Madrid', home_score: 3, away_score: 0 }), 'Real Madrid', 'FC Barcelona');
    expect(r.ok && r.outcome).toMatchObject({ team1Score: 0, team2Score: 3, swapped: true, teamsMatched: true });
  });

  it('works out the penalties winner, also when swapped', () => {
    const straight = mapScanToMatch(reading({ home_score: 1, away_score: 1, home_penalties: 4, away_penalties: 5 }), 'Real Madrid', 'FC Barcelona');
    expect(straight.ok && straight.outcome.penaltiesWinner).toBe(2);

    const swapped = mapScanToMatch(
      reading({ home_team: 'Barcelona', away_team: 'Real Madrid', home_score: 1, away_score: 1, home_penalties: 4, away_penalties: 5 }),
      'Real Madrid', 'FC Barcelona'
    );
    expect(swapped.ok && swapped.outcome.penaltiesWinner).toBe(1);
  });

  it('warns on a draw without a shoot-out', () => {
    const r = mapScanToMatch(reading({ home_score: 2, away_score: 2 }), 'Real Madrid', 'FC Barcelona');
    expect(r.ok && r.outcome.penaltiesWinner).toBeNull();
    expect(r.ok && r.outcome.warnings[0]).toMatch(/penalties winner/i);
  });

  it('keeps screen order and warns when the teams are unknown', () => {
    const r = mapScanToMatch(reading({ home_team: 'Ajax', away_team: 'PSV' }), 'Real Madrid', 'FC Barcelona');
    expect(r.ok && r.outcome).toMatchObject({ team1Score: 2, team2Score: 1, swapped: false, teamsMatched: false });
    expect(r.ok && r.outcome.warnings[0]).toMatch(/"Ajax" vs "PSV"/);
  });

  it('fails when nothing or no valid score was read', () => {
    expect(mapScanToMatch(reading({ found: false }), 'A', 'B').ok).toBe(false);
    expect(mapScanToMatch(reading({ home_score: null }), 'A', 'B').ok).toBe(false);
    expect(mapScanToMatch(reading({ away_score: 2.5 }), 'A', 'B').ok).toBe(false);
    expect(mapScanToMatch(reading({ away_score: 99 }), 'A', 'B').ok).toBe(false);
  });
});
