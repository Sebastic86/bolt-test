import { describe, expect, it } from 'vitest';
import {
  allPlayersPicked, findLockedPendingMatch, getLastMatchResults, reconcilePick, switchWinner,
} from './predictionPanelUtils';
import { makeMatch, makePlayer, makePrediction } from '../test/fixtures';

const [ana, bob, cas] = ['ana', 'bob', 'cas'].map(id => makePlayer(id));
const players = [ana, bob, cas];

describe('reconcilePick', () => {
  it('lets a non-draw score decide the winner', () => {
    expect(reconcilePick({ winner: 1, team1Score: 0, team2Score: 2 })).toEqual({ winner: 2, team1Score: 0, team2Score: 2 });
    expect(reconcilePick({ winner: 2, team1Score: 3, team2Score: 1 })).toEqual({ winner: 1, team1Score: 3, team2Score: 1 });
  });

  it('keeps the chosen winner as penalties winner on a draw', () => {
    expect(reconcilePick({ winner: 2, team1Score: 1, team2Score: 1 })).toEqual({ winner: 2, team1Score: 1, team2Score: 1 });
  });

  it('drops incomplete or out-of-range scores', () => {
    expect(reconcilePick({ winner: 1, team1Score: 2, team2Score: null })).toEqual({ winner: 1, team1Score: null, team2Score: null });
    expect(reconcilePick({ winner: 1, team1Score: 31, team2Score: 0 })).toEqual({ winner: 1, team1Score: null, team2Score: null });
    expect(reconcilePick({ winner: 1, team1Score: -1, team2Score: 0 })).toEqual({ winner: 1, team1Score: null, team2Score: null });
  });
});

describe('switchWinner', () => {
  it('keeps a score that agrees (or a draw) and drops one that contradicts', () => {
    const draw = { predicted_team1_score: 1, predicted_team2_score: 1 };
    const homeWin = { predicted_team1_score: 2, predicted_team2_score: 0 };
    expect(switchWinner(draw, 2)).toEqual({ winner: 2, team1Score: 1, team2Score: 1 });
    expect(switchWinner(homeWin, 1)).toEqual({ winner: 1, team1Score: 2, team2Score: 0 });
    expect(switchWinner(homeWin, 2)).toEqual({ winner: 2, team1Score: null, team2Score: null });
    expect(switchWinner(null, 1)).toEqual({ winner: 1, team1Score: null, team2Score: null });
  });
});

describe('allPlayersPicked', () => {
  it('is true only once every player has an open pick', () => {
    const picks = [makePrediction({ player_id: 'ana', predicted_winner: 1 }), makePrediction({ player_id: 'bob', predicted_winner: 2 })];
    expect(allPlayersPicked(players, picks)).toBe(false);
    expect(allPlayersPicked(players, [...picks, makePrediction({ player_id: 'cas', predicted_winner: 1 })])).toBe(true);
    expect(allPlayersPicked([], [])).toBe(false);
  });
});

describe('findLockedPendingMatch', () => {
  it('finds tonight\'s unscored match for the matchup with linked picks', () => {
    const pending = makeMatch([ana], [bob], 0, 0, { team1_score: null, team2_score: null, game_night_id: 'n1' });
    const linked = [makePrediction({ player_id: 'ana', predicted_winner: 1, match_id: pending.id })];
    expect(findLockedPendingMatch([pending], linked, 't1', 't2')?.id).toBe(pending.id);
    expect(findLockedPendingMatch([pending], [], 't1', 't2')).toBeNull();
    expect(findLockedPendingMatch([pending], linked, 't2', 't1')).toBeNull();
  });

  it('ignores scored matches', () => {
    const scored = makeMatch([ana], [bob], 1, 0, { game_night_id: 'n1' });
    const linked = [makePrediction({ player_id: 'ana', predicted_winner: 1, match_id: scored.id })];
    expect(findLockedPendingMatch([scored], linked, 't1', 't2')).toBeNull();
  });
});

describe('getLastMatchResults', () => {
  it('scores each player\'s pick on the most recent scored match', () => {
    const older = makeMatch([ana], [bob], 1, 0, { minute: 10 });
    const latest = makeMatch([ana], [bob], 2, 1, { minute: 50 });
    const unscored = makeMatch([ana], [bob], 0, 0, { minute: 90, team1_score: null, team2_score: null });
    const predictions = [
      makePrediction({ player_id: 'ana', predicted_winner: 1, predicted_team1_score: 2, predicted_team2_score: 1, match_id: latest.id }),
      makePrediction({ player_id: 'bob', predicted_winner: 2, match_id: latest.id }),
      makePrediction({ player_id: 'cas', predicted_winner: 1, match_id: older.id }),
    ];
    const result = getLastMatchResults([older, latest, unscored], predictions, players);
    expect(result?.match.id).toBe(latest.id);
    expect(result?.lines.map(l => [l.player.id, l.outcome?.points])).toEqual([['ana', 3], ['bob', 0]]);
  });

  it('is null when the latest scored match had no picks', () => {
    const older = makeMatch([ana], [bob], 1, 0, { minute: 10 });
    const latest = makeMatch([ana], [bob], 2, 1, { minute: 50 });
    const predictions = [makePrediction({ player_id: 'ana', predicted_winner: 1, match_id: older.id })];
    expect(getLastMatchResults([older, latest], predictions, players)).toBeNull();
    expect(getLastMatchResults([], predictions, players)).toBeNull();
  });
});
