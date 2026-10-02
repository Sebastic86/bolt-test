import { MatchHistoryItem, Player, Prediction } from '../types';
import { PredictionOutcome, scorePrediction } from './predictionStats';

export const MAX_PREDICTED_SCORE = 30;

export interface PickDraft {
  winner: 1 | 2;
  team1Score: number | null;
  team2Score: number | null;
}

/** A score is either both sides (0..30) or none. */
export function isValidScore(score: number | null): score is number {
  return score !== null && Number.isInteger(score) && score >= 0 && score <= MAX_PREDICTED_SCORE;
}

/**
 * Keeps the winner consistent with the exact-score guess: a non-draw score
 * decides the winner, a draw keeps the chosen winner (= penalties winner).
 * An incomplete/invalid score is dropped.
 */
export function reconcilePick(draft: PickDraft): PickDraft {
  const { team1Score, team2Score } = draft;
  if (!isValidScore(team1Score) || !isValidScore(team2Score)) {
    return { winner: draft.winner, team1Score: null, team2Score: null };
  }
  const winner = team1Score > team2Score ? 1 : team2Score > team1Score ? 2 : draft.winner;
  return { winner, team1Score, team2Score };
}

/**
 * Switching the winner on an existing pick: keep its score only if it still
 * agrees with the new winner (a draw always does), otherwise drop it.
 */
export function switchWinner(existing: Pick<Prediction, 'predicted_team1_score' | 'predicted_team2_score'> | null, winner: 1 | 2): PickDraft {
  const s1 = existing?.predicted_team1_score ?? null;
  const s2 = existing?.predicted_team2_score ?? null;
  if (s1 === null || s2 === null) return { winner, team1Score: null, team2Score: null };
  const scoreWinner = s1 > s2 ? 1 : s2 > s1 ? 2 : null;
  if (scoreWinner !== null && scoreWinner !== winner) return { winner, team1Score: null, team2Score: null };
  return { winner, team1Score: s1, team2Score: s2 };
}

/** Picks stay hidden until every player has an open pick for the matchup. */
export function allPlayersPicked(players: Player[], openPicks: Prediction[]): boolean {
  if (players.length === 0) return false;
  const pickers = new Set(openPicks.map(p => p.player_id));
  return players.every(p => pickers.has(p.id));
}

/** Tonight's saved-but-unscored match for this matchup that already has linked picks. */
export function findLockedPendingMatch(
  nightMatches: MatchHistoryItem[],
  predictions: Prediction[],
  team1Id: string,
  team2Id: string
): MatchHistoryItem | null {
  const linked = new Set(predictions.map(p => p.match_id).filter((id): id is string => !!id));
  const candidates = nightMatches.filter(m =>
    m.team1_id === team1Id
    && m.team2_id === team2Id
    && (m.team1_score === null || m.team2_score === null)
    && linked.has(m.id)
  );
  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

export interface LastMatchResultLine {
  player: Player;
  prediction: Prediction;
  /** Null for an undecided draw. */
  outcome: PredictionOutcome | null;
}

export interface LastMatchResults {
  match: MatchHistoryItem;
  lines: LastMatchResultLine[];
}

/** Per-player results for the most recent scored match tonight — null if it had no picks. */
export function getLastMatchResults(
  nightMatches: MatchHistoryItem[],
  predictions: Prediction[],
  players: Player[]
): LastMatchResults | null {
  const scored = nightMatches.filter(m => m.team1_score !== null && m.team2_score !== null);
  if (scored.length === 0) return null;
  const match = scored.reduce((latest, m) => (m.played_at.localeCompare(latest.played_at) >= 0 ? m : latest));

  const lines: LastMatchResultLine[] = [];
  for (const player of players) {
    const prediction = predictions.find(p => p.match_id === match.id && p.player_id === player.id);
    if (prediction) lines.push({ player, prediction, outcome: scorePrediction(prediction, match) });
  }
  return lines.length > 0 ? { match, lines } : null;
}
