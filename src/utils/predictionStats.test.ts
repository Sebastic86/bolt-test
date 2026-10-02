import { describe, expect, it } from 'vitest';
import { calculatePredictionLeaderboard, getOpenPredictionsForMatchup, scorePrediction } from './predictionStats';
import { makeMatch, makePlayer, makePrediction } from '../test/fixtures';

const [ana, bob, cas] = ['ana', 'bob', 'cas'].map(id => makePlayer(id));

describe('scorePrediction', () => {
  const match = makeMatch([ana], [bob, cas], 2, 1);

  it('gives 1 point for the winner and 2 more for the exact score', () => {
    expect(scorePrediction(makePrediction({ player_id: 'ana', predicted_winner: 1 }), match))
      .toEqual({ correctWinner: true, exactScore: false, points: 1 });
    expect(scorePrediction(makePrediction({
      player_id: 'ana', predicted_winner: 1, predicted_team1_score: 2, predicted_team2_score: 1,
    }), match)).toEqual({ correctWinner: true, exactScore: true, points: 3 });
    expect(scorePrediction(makePrediction({ player_id: 'bob', predicted_winner: 2 }), match))
      .toEqual({ correctWinner: false, exactScore: false, points: 0 });
  });

  it('counts the penalty winner, and the exact draw score as exact', () => {
    const pens = makeMatch([ana], [bob], 1, 1, { penalties_winner: 2 });
    expect(scorePrediction(makePrediction({
      player_id: 'cas', predicted_winner: 2, predicted_team1_score: 1, predicted_team2_score: 1,
    }), pens)).toEqual({ correctWinner: true, exactScore: true, points: 3 });
  });

  it('is null for an unscored match', () => {
    const open = makeMatch([ana], [bob], 0, 0, { team1_score: null, team2_score: null });
    expect(scorePrediction(makePrediction({ player_id: 'ana', predicted_winner: 1 }), open)).toBeNull();
  });
});

describe('calculatePredictionLeaderboard', () => {
  it('ranks by points, then exact scores, ignoring unlinked picks', () => {
    const m1 = makeMatch([ana], [bob], 3, 0);
    const m2 = makeMatch([ana], [bob], 0, 1);
    const predictions = [
      makePrediction({ player_id: 'ana', predicted_winner: 1, match_id: m1.id }),
      makePrediction({ player_id: 'ana', predicted_winner: 1, match_id: m2.id }),
      makePrediction({ player_id: 'bob', predicted_winner: 1, match_id: m1.id, predicted_team1_score: 3, predicted_team2_score: 0 }),
      makePrediction({ player_id: 'cas', predicted_winner: 2, match_id: null }),
    ];
    const board = calculatePredictionLeaderboard(predictions, [m1, m2], [ana, bob, cas]);

    expect(board.map(l => l.playerId)).toEqual(['bob', 'ana']);
    expect(board[0]).toMatchObject({ settled: 1, correct: 1, exact: 1, points: 3, accuracy: 1 });
    expect(board[1]).toMatchObject({ settled: 2, correct: 1, exact: 0, points: 1, accuracy: 0.5 });
  });
});

describe('getOpenPredictionsForMatchup', () => {
  it('matches night, orientation and open status', () => {
    const open = makePrediction({ player_id: 'ana', predicted_winner: 1 });
    const flipped = makePrediction({ player_id: 'bob', predicted_winner: 1, team1_id: 't2', team2_id: 't1' });
    const linked = makePrediction({ player_id: 'cas', predicted_winner: 1, match_id: 'm1' });
    const otherNight = makePrediction({ player_id: 'cas', predicted_winner: 1, game_night_id: 'n2' });
    expect(getOpenPredictionsForMatchup([open, flipped, linked, otherNight], 'n1', 't1', 't2')).toEqual([open]);
  });
});
