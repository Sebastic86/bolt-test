import { MatchHistoryItem, Player, Prediction } from '../types';
import { getMatchWinner } from './nightStats';

/** Points for picking the right winner (penalties count). */
export const WINNER_POINTS = 1;
/** Extra points for also guessing the exact score. */
export const EXACT_SCORE_BONUS = 2;

export interface PredictionOutcome {
  correctWinner: boolean;
  exactScore: boolean;
  points: number;
}

/** Null while the match is unscored or undecided. */
export function scorePrediction(prediction: Prediction, match: MatchHistoryItem): PredictionOutcome | null {
  const winner = getMatchWinner(match);
  if (winner === null) return null;

  const correctWinner = prediction.predicted_winner === winner;
  const exactScore = prediction.predicted_team1_score !== null
    && prediction.predicted_team1_score === match.team1_score
    && prediction.predicted_team2_score === match.team2_score;

  return {
    correctWinner,
    exactScore,
    points: (correctWinner ? WINNER_POINTS : 0) + (exactScore ? EXACT_SCORE_BONUS : 0),
  };
}

export interface PredictionLeaderboardLine {
  playerId: string;
  playerName: string;
  /** Predictions whose match has a result. */
  settled: number;
  correct: number;
  exact: number;
  points: number;
  /** correct / settled, 0..1 (0 when nothing is settled). */
  accuracy: number;
}

/** Players with at least one settled prediction, best first (points, exact scores, accuracy). */
export function calculatePredictionLeaderboard(
  predictions: Prediction[],
  matches: MatchHistoryItem[],
  players: Player[]
): PredictionLeaderboardLine[] {
  const matchById = new Map(matches.map(m => [m.id, m]));
  const lines = new Map<string, PredictionLeaderboardLine>();

  for (const prediction of predictions) {
    if (!prediction.match_id) continue;
    const match = matchById.get(prediction.match_id);
    if (!match) continue;
    const outcome = scorePrediction(prediction, match);
    if (!outcome) continue;

    const player = players.find(p => p.id === prediction.player_id);
    if (!player) continue;

    const line = lines.get(player.id) ?? {
      playerId: player.id, playerName: player.name, settled: 0, correct: 0, exact: 0, points: 0, accuracy: 0,
    };
    line.settled += 1;
    if (outcome.correctWinner) line.correct += 1;
    if (outcome.exactScore) line.exact += 1;
    line.points += outcome.points;
    lines.set(player.id, line);
  }

  return Array.from(lines.values())
    .map(l => ({ ...l, accuracy: l.settled > 0 ? l.correct / l.settled : 0 }))
    .sort((a, b) => b.points - a.points || b.exact - a.exact || b.accuracy - a.accuracy || a.playerName.localeCompare(b.playerName));
}

/** Open (not yet linked to a match) picks for exactly this matchup and orientation. */
export function getOpenPredictionsForMatchup(
  predictions: Prediction[],
  nightId: string,
  team1Id: string,
  team2Id: string
): Prediction[] {
  return predictions.filter(p =>
    p.game_night_id === nightId
    && p.match_id === null
    && p.team1_id === team1Id
    && p.team2_id === team2Id
  );
}
