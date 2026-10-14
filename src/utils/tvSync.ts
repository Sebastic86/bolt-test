import { Prediction } from '../types';

// TV mode: phones keep the current matchup in local state only, so the TV
// learns it two ways:
//   1. Realtime broadcast — a phone announces its matchup after an explicit
//      action (New Match, Pick & Ban, joker, edit), and answers a TV's
//      "hello" with the one it holds.
//   2. Predictions — the newest open pick of tonight names a matchup too.
//      Covers a TV that opens while every phone is locked/backgrounded.
// Whichever is newer wins.

export const TV_CHANNEL = 'tv-matchup';
export const TV_EVENT_MATCHUP = 'matchup';
export const TV_EVENT_HELLO = 'hello';

export interface TvMatchup {
  team1Id: string;
  team2Id: string;
  /** Epoch ms of the explicit action on the phone that set this matchup. */
  at: number;
  /** True when the phone is playing the reveal animation for it right now. */
  reveal?: boolean;
}

export function isTvMatchup(value: unknown): value is TvMatchup {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.team1Id === 'string' && v.team1Id.length > 0
    && typeof v.team2Id === 'string' && v.team2Id.length > 0
    && v.team1Id !== v.team2Id
    && typeof v.at === 'number' && Number.isFinite(v.at);
}

/** Keeps the newest announcement; equal timestamps keep the current one (no flicker between phones). */
export function pickNewerMatchup(current: TvMatchup | null, incoming: TvMatchup): TvMatchup {
  if (!current || incoming.at > current.at) return incoming;
  return current;
}

/** The matchup named by tonight's newest open prediction, if any. */
export function getMatchupFromPredictions(predictions: Prediction[], nightId: string | null): TvMatchup | null {
  if (!nightId) return null;
  let newest: Prediction | null = null;
  for (const p of predictions) {
    if (p.game_night_id !== nightId || p.match_id !== null) continue;
    if (!newest || Date.parse(p.created_at) > Date.parse(newest.created_at)) newest = p;
  }
  if (!newest) return null;
  const at = Date.parse(newest.created_at);
  return { team1Id: newest.team1_id, team2Id: newest.team2_id, at: Number.isNaN(at) ? 0 : at };
}

/** What the TV shows: the newer of the broadcast and the prediction-derived matchup. */
export function resolveTvMatchup(broadcast: TvMatchup | null, fromPredictions: TvMatchup | null): TvMatchup | null {
  if (!broadcast) return fromPredictions;
  if (!fromPredictions) return broadcast;
  return fromPredictions.at > broadcast.at ? { ...fromPredictions } : broadcast;
}
