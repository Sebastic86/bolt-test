import { MatchHistoryItem, Player, Prediction, Team } from '../types';
import { detectMilestones } from './milestones';
import { getMatchWinner } from './nightStats';
import { scorePrediction } from './predictionStats';

/** Result keys this device has already evaluated (seeded on first load so nothing replays). */
export const SEEN_STORAGE_KEY = 'fcMilestonesSeen.v1';
/** Milestone / prediction-summary ids already toasted on this device. */
export const SHOWN_STORAGE_KEY = 'fcMilestonesShown.v1';
export const MAX_SHOWN_IDS = 500;
/** Scores are entered after playing — only celebrate matches played this recently. */
export const RECENT_WINDOW_MS = 6 * 60 * 60 * 1000;
export const MAX_MILESTONE_TOASTS = 3;

export type WatchToastVariant = 'milestone' | 'success';

export interface WatchToast {
  /** Stable id, also used to de-duplicate in the toast stack. */
  id: string;
  title: string;
  detail?: string;
  variant: WatchToastVariant;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** `${id}:${s1}-${s2}:${penalties}` for scored, decided matches; null otherwise. */
export function resultKey(match: MatchHistoryItem): string | null {
  if (getMatchWinner(match) === null) return null;
  return `${match.id}:${match.team1_score}-${match.team2_score}:${match.penalties_winner ?? ''}`;
}

function readList(storage: StorageLike, key: string): string[] | null {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeList(storage: StorageLike, key: string, values: string[]) {
  try {
    storage.setItem(key, JSON.stringify(values));
  } catch {
    // Storage full / unavailable (private mode) — worst case a toast repeats.
  }
}

/** One-line prediction summary for a just-scored match, or null when nobody predicted it. */
export function summarizePredictions(
  match: MatchHistoryItem,
  predictions: Prediction[],
  players: Player[]
): string | null {
  const linked = predictions.filter(p => p.match_id === match.id);
  if (linked.length === 0) return null;

  const nameOf = (id: string) =>
    players.find(p => p.id === id)?.name
    ?? [...match.team1_players, ...match.team2_players].find(p => p.id === id)?.name
    ?? 'Someone';

  const scored = linked
    .map(p => ({ prediction: p, outcome: scorePrediction(p, match) }))
    .filter((x): x is { prediction: Prediction; outcome: NonNullable<typeof x.outcome> } => !!x.outcome && x.outcome.points > 0)
    .sort((a, b) => b.outcome.points - a.outcome.points || nameOf(a.prediction.player_id).localeCompare(nameOf(b.prediction.player_id)));

  if (scored.length === 0) return 'Nobody saw that coming!';
  return scored
    .map(({ prediction, outcome }) => outcome.exactScore
      ? `${nameOf(prediction.player_id)} called it ${match.team1_score}-${match.team2_score} (+${outcome.points})`
      : `${nameOf(prediction.player_id)} +${outcome.points}`)
    .join(', ');
}

export interface WatchInput {
  matches: MatchHistoryItem[];
  teams: Team[];
  players: Player[];
  /** null when predictions are unavailable (e.g. table not migrated yet) — prediction toasts are skipped. */
  predictions: Prediction[] | null;
  storage: StorageLike;
  now: number;
}

/**
 * Compares the current matches against what this device has already seen,
 * returns the toasts to show and persists the new seen/shown state
 * synchronously (so a second run — e.g. StrictMode — yields nothing).
 *
 * Toasts are ordered least → most important, so with a newest-on-top stack
 * the biggest milestone ends up on top.
 */
export function runMilestoneWatch({ matches, teams, players, predictions, storage, now }: WatchInput): WatchToast[] {
  const currentKeys = new Map<string, MatchHistoryItem>();
  for (const match of matches) {
    const key = resultKey(match);
    if (key) currentKeys.set(key, match);
  }

  const storedSeen = readList(storage, SEEN_STORAGE_KEY);
  if (storedSeen === null) {
    // First load on this device: everything that exists now counts as seen.
    writeList(storage, SEEN_STORAGE_KEY, Array.from(currentKeys.keys()));
    return [];
  }

  const seen = new Set(storedSeen);
  const shownList = readList(storage, SHOWN_STORAGE_KEY) ?? [];
  const shown = new Set(shownList);
  const newlyShown: string[] = [];
  const toasts: WatchToast[] = [];

  for (const [key, match] of currentKeys) {
    if (seen.has(key)) continue;

    const playedAt = Date.parse(match.played_at);
    const recent = Number.isFinite(playedAt) && now - playedAt <= RECENT_WINDOW_MS;
    if (!recent) {
      seen.add(key);
      continue;
    }
    // Players not joined yet — wait for a later update (until the match is too old).
    if (match.team1_players.length === 0 && match.team2_players.length === 0) continue;

    const matchToasts: WatchToast[] = [];

    if (predictions) {
      const predictionId = `predictions:${match.id}:${key}`;
      const summary = shown.has(predictionId) ? null : summarizePredictions(match, predictions, players);
      if (summary) {
        matchToasts.push({ id: predictionId, title: 'Predictions', detail: summary, variant: 'success' });
        shown.add(predictionId);
        newlyShown.push(predictionId);
      }
    }

    const milestones = detectMilestones(match, matches, teams)
      .filter(m => !shown.has(m.id))
      .slice(0, MAX_MILESTONE_TOASTS);
    for (const m of [...milestones].reverse()) {
      matchToasts.push({ id: m.id, title: m.title, detail: m.detail, variant: 'milestone' });
    }
    for (const m of milestones) {
      shown.add(m.id);
      newlyShown.push(m.id);
    }

    toasts.push(...matchToasts);
    seen.add(key);
  }

  // Only keys of current matches can matter again; drop the rest so storage stays small.
  writeList(storage, SEEN_STORAGE_KEY, Array.from(seen).filter(k => currentKeys.has(k)));
  if (newlyShown.length > 0) {
    writeList(storage, SHOWN_STORAGE_KEY, [...shownList, ...newlyShown].slice(-MAX_SHOWN_IDS));
  }
  return toasts;
}
