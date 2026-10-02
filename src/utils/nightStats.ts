import { GameNight, MatchHistoryItem, NightJoker, Player, PlayerStanding, Team } from '../types';
import { calculateStandings } from './standingsUtils';

/** 1 or 2 for the winning side (penalties decide draws), null if unscored or an undecided draw. */
export function getMatchWinner(match: Pick<MatchHistoryItem, 'team1_score' | 'team2_score' | 'penalties_winner'>): 1 | 2 | null {
  if (match.team1_score === null || match.team2_score === null) return null;
  if (match.team1_score > match.team2_score) return 1;
  if (match.team2_score > match.team1_score) return 2;
  return match.penalties_winner ?? null;
}

/** Matches recorded during a night (linked by the DB trigger), oldest first. */
export function getNightMatches(allMatches: MatchHistoryItem[], nightId: string): MatchHistoryItem[] {
  return allMatches
    .filter(m => m.game_night_id === nightId)
    .sort((a, b) => a.played_at.localeCompare(b.played_at));
}

/** "Night #N" — 1-based position of the night by start time. */
export function getNightNumber(nights: GameNight[], nightId: string): number | null {
  const ordered = [...nights].sort((a, b) => a.started_at.localeCompare(b.started_at));
  const index = ordered.findIndex(n => n.id === nightId);
  return index === -1 ? null : index + 1;
}

/** A night still open after this long was probably never ended. */
export const STALE_NIGHT_MS = 12 * 60 * 60 * 1000;

export function isNightStale(night: GameNight, now: number = Date.now()): boolean {
  return night.ended_at === null && now - new Date(night.started_at).getTime() > STALE_NIGHT_MS;
}

export interface NightPlayerLine extends PlayerStanding {
  wins: number;
  losses: number;
}

export interface NightSummary {
  matchCount: number;
  totalGoals: number;
  /** Players who played tonight, in standings order (points, GD, GF). */
  table: NightPlayerLine[];
  /** Top of the table — null until a scored match exists. */
  playerOfTheNight: NightPlayerLine | null;
  biggestWin: MatchHistoryItem | null;
  /** Penalty shoot-outs tonight. */
  penaltyCount: number;
}

export function calculateNightSummary(
  nightMatches: MatchHistoryItem[],
  players: Player[],
  teams: Team[]
): NightSummary {
  const scored = nightMatches.filter(m => m.team1_score !== null && m.team2_score !== null);
  const wins = new Map<string, number>();
  const losses = new Map<string, number>();
  const bump = (map: Map<string, number>, id: string) => map.set(id, (map.get(id) ?? 0) + 1);

  for (const match of scored) {
    const winner = getMatchWinner(match);
    if (!winner) continue;
    const [winners, losers] = winner === 1
      ? [match.team1_players, match.team2_players]
      : [match.team2_players, match.team1_players];
    winners.forEach(p => bump(wins, p.id));
    losers.forEach(p => bump(losses, p.id));
  }

  const table: NightPlayerLine[] = calculateStandings(scored, players, teams)
    .filter(s => s.matchesPlayed > 0)
    .map(s => ({ ...s, wins: wins.get(s.playerId) ?? 0, losses: losses.get(s.playerId) ?? 0 }));

  let biggestWin: MatchHistoryItem | null = null;
  let biggestMargin = 0;
  for (const match of scored) {
    const margin = Math.abs(match.team1_score! - match.team2_score!);
    if (margin > biggestMargin) {
      biggestMargin = margin;
      biggestWin = match;
    }
  }

  return {
    matchCount: nightMatches.length,
    totalGoals: scored.reduce((sum, m) => sum + m.team1_score! + m.team2_score!, 0),
    table,
    playerOfTheNight: table.length > 0 && table[0].points > 0 ? table[0] : null,
    biggestWin,
    penaltyCount: scored.filter(m => m.penalties_winner !== null && m.team1_score === m.team2_score).length,
  };
}

/** Jokers left per player id for a night. */
export function getJokersRemaining(
  players: Player[],
  jokers: NightJoker[],
  jokersPerPlayer: number
): Map<string, number> {
  const used = new Map<string, number>();
  jokers.forEach(j => used.set(j.player_id, (used.get(j.player_id) ?? 0) + 1));
  return new Map(players.map(p => [p.id, Math.max(0, jokersPerPlayer - (used.get(p.id) ?? 0))]));
}

/**
 * Players taking part in a night (game_nights.player_ids). Falls back to
 * everyone when the night has no list, or none of the listed players exist.
 */
export function getNightPlayers(night: Pick<GameNight, 'player_ids'>, players: Player[]): Player[] {
  const ids = new Set(night.player_ids ?? []);
  const tonight = players.filter(p => ids.has(p.id));
  return tonight.length > 0 ? tonight : players;
}
