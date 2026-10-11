import { normalizeTeamName } from './normalizeTeamName';

// Pure logic for "scan the result": turns what the vision model read off a
// photo of the EA FC full-time screen into values for the score editor.
// The in-game home/away order doesn't have to match our team1/team2 order,
// so the read team names decide which score goes where.

/** What the `scan-match-result` Edge Function returns (the model's reading). */
export interface ScanReading {
  found: boolean;
  home_team: string | null;
  away_team: string | null;
  home_score: number | null;
  away_score: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
}

export interface ScanOutcome {
  team1Score: number;
  team2Score: number;
  penaltiesWinner: 1 | 2 | null;
  /** True when the screen showed our team2 on the left (home) side. */
  swapped: boolean;
  /** False when neither team name could be matched; scores are then kept in screen order. */
  teamsMatched: boolean;
  warnings: string[];
}

export type ScanMapResult = { ok: true; outcome: ScanOutcome } | { ok: false; error: string };

const MAX_GOALS = 30;
const STOP_WORDS = new Set(['fc', 'cf', 'afc', 'sc', 'ac', 'club', 'de', 'the', 'cd', 'ssc', 'sv', 'as', 'rc', 'us', 'vfl', 'vfb', 'fk', 'sk', '1']);

const tokens = (name: string): string[] =>
  normalizeTeamName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(t => t.length > 0 && !STOP_WORDS.has(t));

/**
 * How well a name read off the screen fits one of our team names, 0..1.
 * Handles EA's short names: "Man City" (token prefixes), "PSG" (initials),
 * "Bayern" (subset of "FC Bayern München").
 */
export function teamNameSimilarity(read: string, ours: string): number {
  const a = tokens(read);
  const b = tokens(ours);
  if (a.length === 0 || b.length === 0) return 0;
  if (a.join(' ') === b.join(' ')) return 1;

  // Initials: "PSG" vs Paris Saint-Germain, "ATM" won't match but "BVB"-style ones often do.
  const compactRead = a.join('');
  const initials = tokens(ours.replace(/-/g, ' ')).map(t => t[0]).join('');
  if (compactRead.length >= 2 && compactRead === initials) return 0.9;

  // Each read token matches a token of ours exactly or as a prefix ("man" → "manchester").
  const matched = a.filter(t => b.some(u => u === t || (t.length >= 3 && u.startsWith(t)) || (u.length >= 3 && t.startsWith(u))));
  if (matched.length === 0) return 0;
  return (matched.length / a.length) * 0.8 + (matched.length / b.length) * 0.2;
}

const isGoalCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_GOALS;

const MATCH_THRESHOLD = 0.5;

export function mapScanToMatch(reading: ScanReading, team1Name: string, team2Name: string): ScanMapResult {
  if (!reading.found) {
    return { ok: false, error: "Couldn't find a final score in the photo. Take it straight on, with the whole score visible." };
  }
  if (!isGoalCount(reading.home_score) || !isGoalCount(reading.away_score)) {
    return { ok: false, error: "Couldn't read both scores. Try another photo or enter them by hand." };
  }

  const warnings: string[] = [];
  const home = reading.home_team ?? '';
  const away = reading.away_team ?? '';

  const straight = teamNameSimilarity(home, team1Name) + teamNameSimilarity(away, team2Name);
  const crossed = teamNameSimilarity(home, team2Name) + teamNameSimilarity(away, team1Name);
  const best = Math.max(straight, crossed);
  const teamsMatched = best >= MATCH_THRESHOLD;
  const swapped = teamsMatched && crossed > straight;

  if (!teamsMatched) {
    warnings.push(
      home || away
        ? `The photo shows "${home || '?'}" vs "${away || '?'}", which doesn't look like this match. Check the scores are on the right teams.`
        : "Couldn't read the team names. Check the scores are on the right teams."
    );
  }

  const [team1Score, team2Score] = swapped
    ? [reading.away_score, reading.home_score]
    : [reading.home_score, reading.away_score];

  let penaltiesWinner: 1 | 2 | null = null;
  if (team1Score === team2Score) {
    const hp = reading.home_penalties;
    const ap = reading.away_penalties;
    if (isGoalCount(hp) && isGoalCount(ap) && hp !== ap) {
      const homeWon = hp > ap;
      penaltiesWinner = homeWon !== swapped ? 1 : 2;
    } else {
      warnings.push("It's a draw, but no penalty shoot-out was read. Pick the penalties winner.");
    }
  }

  return { ok: true, outcome: { team1Score, team2Score, penaltiesWinner, swapped, teamsMatched, warnings } };
}
