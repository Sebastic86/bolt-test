import { GameNight, MatchHistoryItem, Player, Prediction, Team } from '../types';
import { calculateNightSummary, getNightMatches, getNightNumber } from './nightStats';
import { calculatePredictionLeaderboard } from './predictionStats';

/**
 * Plain, serializable recap of a game night (or any set of matches) —
 * consumed by both the on-screen NightRecapSheet and the canvas PNG
 * renderer (recapCard.ts). No Player/Team objects, numbers pre-formatted
 * where both consumers want the same text.
 */

export interface RecapTableRow {
  playerId: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
  /** "+7", "-3", "0" */
  gd: string;
}

export interface RecapBiggestWin {
  winnerTeam: string;
  loserTeam: string;
  winnerPlayers: string[];
  loserPlayers: string[];
  /** Winner's score first: "5–0" */
  score: string;
}

export interface RecapPredictionChampion {
  playerId: string;
  name: string;
  points: number;
  exact: number;
  correct: number;
  settled: number;
}

export interface RecapData {
  title: string;
  subtitle: string;
  playerOfTheNight: RecapTableRow | null;
  table: RecapTableRow[];
  biggestWin: RecapBiggestWin | null;
  predictionChampion: RecapPredictionChampion | null;
  matchCount: number;
  /** Matches with a score entered. */
  scoredCount: number;
  totalGoals: number;
  penaltyCount: number;
}

export interface BuildRecapInput {
  title: string;
  subtitle: string;
  matches: MatchHistoryItem[];
  players: Player[];
  teams: Team[];
  /** This night's predictions — omitted for plain day sessions. */
  predictions?: Prediction[];
}

export const formatGoalDifference = (gd: number): string => (gd > 0 ? `+${gd}` : `${gd}`);

export function buildRecapData({ title, subtitle, matches, players, teams, predictions }: BuildRecapInput): RecapData {
  const summary = calculateNightSummary(matches, players, teams);

  const table: RecapTableRow[] = summary.table.map(line => ({
    playerId: line.playerId,
    name: line.playerName,
    played: line.matchesPlayed,
    wins: line.wins,
    losses: line.losses,
    points: line.points,
    gd: formatGoalDifference(line.goalDifference),
  }));

  let biggestWin: RecapBiggestWin | null = null;
  const big = summary.biggestWin;
  if (big && big.team1_score !== null && big.team2_score !== null) {
    const team1Won = big.team1_score > big.team2_score;
    biggestWin = {
      winnerTeam: team1Won ? big.team1_name : big.team2_name,
      loserTeam: team1Won ? big.team2_name : big.team1_name,
      winnerPlayers: (team1Won ? big.team1_players : big.team2_players).map(p => p.name),
      loserPlayers: (team1Won ? big.team2_players : big.team1_players).map(p => p.name),
      score: team1Won ? `${big.team1_score}–${big.team2_score}` : `${big.team2_score}–${big.team1_score}`,
    };
  }

  let predictionChampion: RecapPredictionChampion | null = null;
  if (predictions && predictions.length > 0) {
    const top = calculatePredictionLeaderboard(predictions, matches, players)[0];
    if (top && top.points > 0) {
      predictionChampion = {
        playerId: top.playerId,
        name: top.playerName,
        points: top.points,
        exact: top.exact,
        correct: top.correct,
        settled: top.settled,
      };
    }
  }

  const potn = summary.playerOfTheNight;
  return {
    title,
    subtitle,
    playerOfTheNight: potn ? table.find(r => r.playerId === potn.playerId) ?? null : null,
    table,
    biggestWin,
    predictionChampion,
    matchCount: summary.matchCount,
    scoredCount: matches.filter(m => m.team1_score !== null && m.team2_score !== null).length,
    totalGoals: summary.totalGoals,
    penaltyCount: summary.penaltyCount,
  };
}

export interface NightRecapContext {
  /** Every night — for the "Night #N" number. */
  nights: GameNight[];
  allMatches: MatchHistoryItem[];
  players: Player[];
  teams: Team[];
  /** Predictions of any nights; filtered to this night here. */
  predictions?: Prediction[];
}

/** Recap of one game night: "FC27 Night #3", its matches and its predictions. */
export function buildNightRecapData(night: GameNight, { nights, allMatches, players, teams, predictions }: NightRecapContext): RecapData {
  const matches = getNightMatches(allMatches, night.id);
  return buildRecapData({
    title: formatNightTitle(night.version, getNightNumber(nights, night.id), ' '),
    subtitle: formatNightSubtitle(night, matches),
    matches,
    players,
    teams,
    predictions: predictions?.filter(p => p.game_night_id === night.id),
  });
}

// ---------------------------------------------------------------------------
// Titles / subtitles
// ---------------------------------------------------------------------------

/** "FC27 · Night #3" (or "Night #3" without a version; "Game night" without a number). */
export function formatNightTitle(version: string | null | undefined, nightNumber: number | null, separator = ' · '): string {
  const night = nightNumber !== null ? `Night #${nightNumber}` : 'Game night';
  return version ? `${version}${separator}${night}` : night;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Sat 24/10/2026" in local time. */
export function formatRecapDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${WEEKDAYS[d.getDay()]} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "HH:mm" in local time. */
export function formatRecapTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "Sat 24/10/2026 · 20:14–23:40" — the end time is left out when unknown. */
export function formatRecapSubtitle(startIso: string, endIso: string | null): string {
  const date = formatRecapDate(startIso);
  const start = formatRecapTime(startIso);
  const end = endIso ? formatRecapTime(endIso) : '';
  return end && end !== start ? `${date} · ${start}–${end}` : `${date} · ${start}`;
}

/** Subtitle for a night: its start/end, or the last match if it's still running. */
export function formatNightSubtitle(night: GameNight, nightMatches: MatchHistoryItem[]): string {
  const lastMatch = nightMatches[nightMatches.length - 1];
  return formatRecapSubtitle(night.started_at, night.ended_at ?? lastMatch?.played_at ?? null);
}

/** Subtitle for a plain day session: first to last match. */
export function formatSessionSubtitle(matches: MatchHistoryItem[]): string {
  if (matches.length === 0) return '';
  const sorted = [...matches].sort((a, b) => a.played_at.localeCompare(b.played_at));
  return formatRecapSubtitle(sorted[0].played_at, sorted[sorted.length - 1].played_at);
}

/** "night-3.png" / "game-night-2026-10-24.png" — safe file name for the shared image. */
export function recapFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'recap'}.png`;
}
