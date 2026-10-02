import { MatchHistoryItem, Team } from '../types';

/**
 * Pure display helpers for the matchup + match-list area (MatchList,
 * MatchDetailsSheet, GameSessions, TeamCard, the dashboard filter banners).
 * No React, no Supabase — everything here is unit-tested directly.
 */

// ---------------------------------------------------------------------------
// Date formatting (European, 24h — what the old app showed everywhere)
// ---------------------------------------------------------------------------

/** "DD/MM/YYYY, HH:mm" in the device's local timezone. */
export function formatDateTimeEuropean(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/** "HH:mm" in the device's local timezone. */
export function formatTimeEuropean(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Invalid time';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ---------------------------------------------------------------------------
// Game sessions — grouped by LOCAL calendar day
// ---------------------------------------------------------------------------

export interface LocalGameSession {
  /** YYYY-MM-DD, local day */
  date: string;
  /** DD/MM/YYYY */
  displayDate: string;
  matches: MatchHistoryItem[];
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * YYYY-MM-DD of the *local* calendar day an ISO timestamp falls on. The old
 * app (and utils/gameSessionUtils) used toISOString(), i.e. the UTC day —
 * which splits a late-evening session across two "days" for anyone east of
 * UTC (a 00:30 CEST match lands on the previous UTC day).
 */
export function getLocalDateKey(isoString: string): string | null {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * Days (local time) with 2+ matches, most recent first; each session's
 * matches most recent first. A lone match on a day isn't a "session".
 */
export function groupMatchesIntoLocalSessions(matches: MatchHistoryItem[]): LocalGameSession[] {
  const byDay = new Map<string, MatchHistoryItem[]>();
  matches.forEach(match => {
    const key = getLocalDateKey(match.played_at);
    if (!key) return;
    const list = byDay.get(key);
    if (list) list.push(match);
    else byDay.set(key, [match]);
  });

  const sessions: LocalGameSession[] = [];
  byDay.forEach((dayMatches, date) => {
    if (dayMatches.length < 2) return;
    const [year, month, day] = date.split('-');
    sessions.push({
      date,
      displayDate: `${day}/${month}/${year}`,
      matches: [...dayMatches].sort((a, b) => Date.parse(b.played_at) - Date.parse(a.played_at)),
    });
  });

  return sessions.sort((a, b) => b.date.localeCompare(a.date));
}

// ---------------------------------------------------------------------------
// Match of the day — biggest margin, ties broken by most total goals
// ---------------------------------------------------------------------------

export function getHighlightedMatchIds(matches: MatchHistoryItem[]): Set<string> {
  const completed = matches.filter(m => m.team1_score !== null && m.team2_score !== null);
  if (completed.length === 0) return new Set();

  const margin = (m: MatchHistoryItem) => Math.abs(m.team1_score! - m.team2_score!);
  const goals = (m: MatchHistoryItem) => m.team1_score! + m.team2_score!;

  const maxMargin = Math.max(...completed.map(margin));
  const withMaxMargin = completed.filter(m => margin(m) === maxMargin);
  const maxGoals = Math.max(...withMaxMargin.map(goals));
  return new Set(withMaxMargin.filter(m => goals(m) === maxGoals).map(m => m.id));
}

// ---------------------------------------------------------------------------
// Per-match result from a team's or player's point of view
// ---------------------------------------------------------------------------

export type MatchPerspective =
  | { kind: 'team'; teamId: string }
  | { kind: 'player'; playerId: string };

export type MatchResult = 'Win' | 'Loss' | 'Win (P)' | 'Loss (P)' | 'Draw' | 'No Score';

/** Which side (1 or 2) the perspective team/player was on, or null if not in the match. */
export function getPerspectiveSide(match: MatchHistoryItem, perspective: MatchPerspective): 1 | 2 | null {
  if (perspective.kind === 'team') {
    if (match.team1_id === perspective.teamId) return 1;
    if (match.team2_id === perspective.teamId) return 2;
    return null;
  }
  if (match.team1_players.some(p => p.id === perspective.playerId)) return 1;
  if (match.team2_players.some(p => p.id === perspective.playerId)) return 2;
  return null;
}

/** Result for the given side: Win / Loss, or Win (P) / Loss (P) for a draw settled on penalties. */
export function getMatchResultForSide(match: MatchHistoryItem, side: 1 | 2): MatchResult {
  if (match.team1_score === null || match.team2_score === null) return 'No Score';
  const own = side === 1 ? match.team1_score : match.team2_score;
  const other = side === 1 ? match.team2_score : match.team1_score;
  if (own > other) return 'Win';
  if (own < other) return 'Loss';
  if (match.penalties_winner) return match.penalties_winner === side ? 'Win (P)' : 'Loss (P)';
  return 'Draw';
}

export function getMatchResult(match: MatchHistoryItem, perspective: MatchPerspective): MatchResult | null {
  const side = getPerspectiveSide(match, perspective);
  return side === null ? null : getMatchResultForSide(match, side);
}

/**
 * Best-effort perspective for a MatchDetailsSheet whose caller didn't pass
 * one explicitly: the one team (or player) that appears in EVERY match AND
 * whose name appears in the sheet title ("Matches — Arsenal"). Returns null
 * when that's ambiguous or nothing qualifies, so no badge is better than a
 * wrong badge.
 */
export function inferPerspective(matches: MatchHistoryItem[], title: string): MatchPerspective | null {
  if (matches.length === 0 || !title) return null;
  const titleLower = title.toLowerCase();

  const intersect = (sets: Map<string, string>[]): Map<string, string> => {
    const [first, ...rest] = sets;
    const result = new Map<string, string>();
    first.forEach((name, id) => {
      if (rest.every(s => s.has(id))) result.set(id, name);
    });
    return result;
  };

  const commonTeams = intersect(matches.map(m => new Map([[m.team1_id, m.team1_name], [m.team2_id, m.team2_name]])));
  const commonPlayers = intersect(
    matches.map(m => new Map([...m.team1_players, ...m.team2_players].map(p => [p.id, p.name] as [string, string])))
  );

  const named = (common: Map<string, string>) =>
    [...common].filter(([, name]) => name && titleLower.includes(name.toLowerCase()));

  const teamCandidates = named(commonTeams);
  const playerCandidates = named(commonPlayers);

  if (teamCandidates.length === 1 && playerCandidates.length === 0) return { kind: 'team', teamId: teamCandidates[0][0] };
  if (playerCandidates.length === 1 && teamCandidates.length === 0) return { kind: 'player', playerId: playerCandidates[0][0] };
  return null;
}

// ---------------------------------------------------------------------------
// TeamCard +/- vs the opponent
// ---------------------------------------------------------------------------

export interface StatDifferences {
  overall: number;
  attack: number;
  midfield: number;
  defend: number;
}

type RatedTeam = Pick<Team, 'overallRating' | 'attackRating' | 'midfieldRating' | 'defendRating'>;

export function getStatDifferences(team: RatedTeam, opponent: RatedTeam): StatDifferences {
  return {
    overall: team.overallRating - opponent.overallRating,
    attack: team.attackRating - opponent.attackRating,
    midfield: team.midfieldRating - opponent.midfieldRating,
    defend: team.defendRating - opponent.defendRating,
  };
}

/** "+3", "−2" (true minus sign, so the column doesn't jitter), or "±0". */
export function formatStatDifference(diff: number): string {
  if (diff > 0) return `+${diff}`;
  if (diff < 0) return `−${Math.abs(diff)}`;
  return '±0';
}

// ---------------------------------------------------------------------------
// Dashboard filter warnings
// ---------------------------------------------------------------------------

export interface FilterWarningInput {
  totalTeams: number;
  /** Teams passing the rating/version/nation filter. */
  filteredCount: number;
  /** Filtered teams that haven't played today. */
  availableCount: number;
  minRating: number;
  maxRating: number;
  excludeNations: boolean;
  selectedVersion?: string;
}

export interface FilterWarning {
  kind: 'too-few-teams' | 'all-played-today';
  message: string;
}

function describeFilter({ minRating, maxRating, excludeNations, selectedVersion }: FilterWarningInput): string {
  const parts = [`${minRating.toFixed(1)}–${maxRating.toFixed(1)} stars`];
  if (selectedVersion) parts.push(selectedVersion);
  if (excludeNations) parts.push('excluding nations');
  return parts.join(', ');
}

/**
 * The proactive "your filter can't produce a matchup" banners from the old
 * dashboard (App.tsx): too few teams in the filter at all, or every
 * filtered team has already played today.
 */
export function getFilterWarning(input: FilterWarningInput): FilterWarning | null {
  const { totalTeams, filteredCount, availableCount } = input;
  if (totalTeams === 0) return null;

  if (filteredCount < 2) {
    return {
      kind: 'too-few-teams',
      message: `Only ${filteredCount} team${filteredCount === 1 ? '' : 's'} match${filteredCount === 1 ? 'es' : ''} the current filter (${describeFilter(input)}). Need at least 2 for a matchup — adjust settings.`,
    };
  }

  if (availableCount < 2) {
    return {
      kind: 'all-played-today',
      message: availableCount === 0
        ? `All ${filteredCount} teams in the filter have already played today. Widen the filter for a new matchup.`
        : `Only 1 of the ${filteredCount} teams in the filter hasn't played today. Widen the filter for a new matchup.`,
    };
  }

  return null;
}
