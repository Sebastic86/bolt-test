import { Team } from '../types';
import { MatchupStats, getTeamWeight } from './matchupAlgorithm';

// Pure Pick & Ban logic. Instead of one random matchup, each side gets a
// small set of options; each player bans one of the opponent's options and
// then picks one of their own remaining ones.
//
// Turn order (side 0 = top team card, side 1 = bottom):
//   1. side 0 bans one of side 1's options
//   2. side 1 bans one of side 0's options
//   3. side 0 picks from its remaining options
//   4. side 1 picks from its remaining options
// A pick with a single option left is filled in automatically.

export const PICK_BAN_OPTIONS_PER_SIDE = 3;

export type Side = 0 | 1;

export interface PickBanState {
  options: [Team[], Team[]];
  /** bans[s] = the team side `s` banned (taken from the *other* side's options). */
  bans: [string | null, string | null];
  /** picks[s] = the team side `s` picked from its own options. */
  picks: [string | null, string | null];
}

export type PickBanStep =
  | { kind: 'ban'; actor: Side; target: Side }
  | { kind: 'pick'; actor: Side; target: Side }
  | { kind: 'done' };

const other = (s: Side): Side => (s === 0 ? 1 : 0);
const isNation = (t: Team) => t.league === 'Nation';

/**
 * The OVR window [lo, lo + maxOvrDiff] that contains the anchor and holds the
 * most same-league-type teams. Every pair inside one window is at most
 * maxOvrDiff apart, so whatever the players end up picking is a valid matchup.
 * Ties go to the window most centered on the anchor.
 */
export function getBestWindow(pool: Team[], anchor: Team, maxOvrDiff: number): Team[] {
  const sameKind = pool.filter(t => isNation(t) === isNation(anchor));
  const center = anchor.overallRating - maxOvrDiff / 2;
  let best: Team[] = [];
  let bestOffCenter = Infinity;
  for (let lo = anchor.overallRating - maxOvrDiff; lo <= anchor.overallRating; lo++) {
    const hi = lo + maxOvrDiff;
    const inWindow = sameKind.filter(t => t.overallRating >= lo && t.overallRating <= hi);
    const offCenter = Math.abs(lo - center);
    if (inWindow.length > best.length || (inWindow.length === best.length && offCenter < bestOffCenter)) {
      best = inWindow;
      bestOffCenter = offCenter;
    }
  }
  return best;
}

interface DrawOptions {
  /** Teams allowed in the draw (current filters, not played today). */
  pool: Team[];
  stats: MatchupStats;
  now: number;
  maxOvrDiff: number;
  perSide?: number;
  /** Injected for tests; returns [0, 1). */
  random?: () => number;
}

/** Weighted draw without replacement, using the generator's usage/recency weights. */
function drawWeighted(teams: Team[], n: number, stats: MatchupStats, now: number, random: () => number): Team[] {
  const remaining = [...teams];
  const picked: Team[] = [];
  while (picked.length < n && remaining.length > 0) {
    const weights = remaining.map(t => Math.max(0, getTeamWeight(t.id, stats, now)));
    const total = weights.reduce((a, b) => a + b, 0);
    let index = remaining.length - 1;
    if (total <= 0) {
      index = Math.floor(random() * remaining.length);
    } else {
      let threshold = random() * total;
      for (let i = 0; i < remaining.length; i++) {
        threshold -= weights[i];
        if (threshold <= 0) {
          index = i;
          break;
        }
      }
    }
    picked.push(remaining[index]);
    remaining.splice(index, 1);
  }
  return picked;
}

/**
 * Draws the options for both sides: up to `perSide` each, at least 2 each
 * (otherwise a ban would leave nothing to pick). Teams are dealt snake-style
 * by OVR (A B B A A B …) so neither side gets the stronger set. Returns null
 * when the pool can't fill 2 options per side.
 */
export function drawPickBanOptions({
  pool, stats, now, maxOvrDiff, perSide = PICK_BAN_OPTIONS_PER_SIDE, random = Math.random,
}: DrawOptions): [Team[], Team[]] | null {
  if (pool.length < 4) return null;

  // Try anchors in weighted order until one has enough company in its window.
  const anchors = drawWeighted(pool, Math.min(pool.length, 8), stats, now, random);

  for (const anchor of anchors) {
    const window = getBestWindow(pool, anchor, maxOvrDiff);
    const n = Math.min(perSide, Math.floor(window.length / 2));
    if (n < 2) continue;

    const rest = window.filter(t => t.id !== anchor.id);
    const drawn = [anchor, ...drawWeighted(rest, n * 2 - 1, stats, now, random)]
      .sort((a, b) => b.overallRating - a.overallRating);

    const sides: [Team[], Team[]] = [[], []];
    drawn.forEach((team, i) => {
      // Snake order: 0 1 1 0 0 1 1 0 …
      const side: Side = (i % 4 === 0 || i % 4 === 3) ? 0 : 1;
      sides[side].push(team);
    });
    // Coin flip so side 0 doesn't always get the single strongest team.
    return random() < 0.5 ? sides : [sides[1], sides[0]];
  }

  return null;
}

export function createPickBanState(options: [Team[], Team[]]): PickBanState {
  return { options, bans: [null, null], picks: [null, null] };
}

export function getPickBanStep(state: PickBanState): PickBanStep {
  if (state.bans[0] === null) return { kind: 'ban', actor: 0, target: 1 };
  if (state.bans[1] === null) return { kind: 'ban', actor: 1, target: 0 };
  if (state.picks[0] === null) return { kind: 'pick', actor: 0, target: 0 };
  if (state.picks[1] === null) return { kind: 'pick', actor: 1, target: 1 };
  return { kind: 'done' };
}

/** The options of `side` that the opponent hasn't banned. */
export function getRemainingOptions(state: PickBanState, side: Side): Team[] {
  const bannedBy = state.bans[other(side)];
  return state.options[side].filter(t => t.id !== bannedBy);
}

/** Fills in any pick that has only one option left. */
function autoFillPicks(state: PickBanState): PickBanState {
  let next = state;
  for (const side of [0, 1] as const) {
    const step = getPickBanStep(next);
    if (step.kind !== 'pick' || step.actor !== side) continue;
    const remaining = getRemainingOptions(next, side);
    if (remaining.length === 1) {
      const picks: [string | null, string | null] = [...next.picks];
      picks[side] = remaining[0].id;
      next = { ...next, picks };
    }
  }
  return next;
}

/**
 * Applies the current step's ban or pick. Returns the state unchanged if the
 * team isn't a valid choice for this step.
 */
export function applyPickBanChoice(state: PickBanState, teamId: string): PickBanState {
  const step = getPickBanStep(state);
  if (step.kind === 'done') return state;
  if (!getRemainingOptions(state, step.target).some(t => t.id === teamId)) return state;

  if (step.kind === 'ban') {
    const bans: [string | null, string | null] = [...state.bans];
    bans[step.actor] = teamId;
    return autoFillPicks({ ...state, bans });
  }
  const picks: [string | null, string | null] = [...state.picks];
  picks[step.actor] = teamId;
  return autoFillPicks({ ...state, picks });
}

/** Undoes the most recent manual choice (auto-filled picks are undone with it). */
export function undoPickBanChoice(state: PickBanState): PickBanState {
  const order: Array<['bans' | 'picks', Side]> = [['bans', 0], ['bans', 1], ['picks', 0], ['picks', 1]];
  let next = state;
  // Pop from the end until we've removed one choice that wasn't forced.
  for (let i = order.length - 1; i >= 0; i--) {
    const [key, side] = order[i];
    if (next[key][side] === null) continue;
    const forced = key === 'picks' && getRemainingOptions(next, side).length === 1;
    const cleared: [string | null, string | null] = [...next[key]];
    cleared[side] = null;
    next = { ...next, [key]: cleared };
    if (!forced) break;
  }
  return next;
}

export function getPickBanResult(state: PickBanState): [Team, Team] | null {
  const [p0, p1] = state.picks;
  if (!p0 || !p1) return null;
  const t0 = state.options[0].find(t => t.id === p0);
  const t1 = state.options[1].find(t => t.id === p1);
  return t0 && t1 ? [t0, t1] : null;
}
