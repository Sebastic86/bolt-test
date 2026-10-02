import { MatchHistoryItem, Team } from '../types';
import { getMatchWinner } from './nightStats';
import { getLocalDateKey } from './matchDisplay';

export type MilestoneKind =
  | 'season-opener'
  | 'group-match-count'
  | 'player-match-count'
  | 'win-streak'
  | 'drought-over'
  | 'first-win-over'
  | 'revenge'
  | 'hammering'
  | 'giant-killer'
  | 'penalties'
  | 'night-hat-trick';

export interface Milestone {
  /** Stable id (kind + match + subject) — used to de-duplicate toasts. */
  id: string;
  kind: MilestoneKind;
  title: string;
  detail: string;
  /** Higher = more notable; callers show the top few. */
  priority: number;
  playerIds: string[];
}

export const GROUP_MATCH_MILESTONES = [50, 100, 150, 200, 250, 300, 400, 500, 750, 1000];
export const PLAYER_MATCH_MILESTONES = [10, 25, 50, 100, 150, 200, 250, 300, 400, 500];
export const WIN_STREAK_MILESTONES = [3, 5, 7, 10];
/** Goal margin that counts as a hammering (and a revenge-worthy defeat). */
export const HAMMERING_MARGIN = 4;
/** OVR gap for a giant-killing. */
export const GIANT_KILLER_OVR_GAP = 5;

const chronological = (a: MatchHistoryItem, b: MatchHistoryItem) =>
  a.played_at.localeCompare(b.played_at) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);

const sideOf = (match: MatchHistoryItem, playerId: string): 1 | 2 | null => {
  if (match.team1_players.some(p => p.id === playerId)) return 1;
  if (match.team2_players.some(p => p.id === playerId)) return 2;
  return null;
};

const joinNames = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;

/**
 * Notable things that happened in `match`, judged against every match played
 * before it. `allMatches` may include `match` itself and later matches — only
 * earlier ones are used, so results are stable however late this runs.
 */
export function detectMilestones(
  match: MatchHistoryItem,
  allMatches: MatchHistoryItem[],
  teams: Team[]
): Milestone[] {
  const milestones: Milestone[] = [];
  const add = (m: Omit<Milestone, 'id'> & { subject?: string }) => {
    const { subject, ...rest } = m;
    milestones.push({ ...rest, id: `${m.kind}:${match.id}${subject ? `:${subject}` : ''}` });
  };

  const history = allMatches.filter(m => m.id !== match.id && chronological(m, match) < 0).sort(chronological);
  const upToAndIncluding = [...history, match];

  const winner = getMatchWinner(match);
  const winners = winner === 1 ? match.team1_players : winner === 2 ? match.team2_players : [];
  const losers = winner === 1 ? match.team2_players : winner === 2 ? match.team1_players : [];
  const winnerNames = joinNames(winners.map(p => p.name));
  const everyone = [...match.team1_players, ...match.team2_players];

  // Season opener: first match where both teams are this version.
  const version = match.team1_version && match.team1_version === match.team2_version ? match.team1_version : null;
  if (version && !history.some(m => m.team1_version === version && m.team2_version === version)) {
    add({
      kind: 'season-opener',
      title: `${version} kicks off!`,
      detail: winner ? `${winnerNames} won the first ${version} match.` : `The first ${version} match is in the books.`,
      priority: 6,
      playerIds: everyone.map(p => p.id),
    });
  }

  // Group match count.
  if (GROUP_MATCH_MILESTONES.includes(upToAndIncluding.length)) {
    add({
      kind: 'group-match-count',
      title: `Match #${upToAndIncluding.length}!`,
      detail: `That's ${upToAndIncluding.length} matches played together.`,
      priority: 5,
      playerIds: everyone.map(p => p.id),
    });
  }

  for (const player of everyone) {
    const playerMatches = upToAndIncluding.filter(m => sideOf(m, player.id) !== null);

    // Player match count.
    if (PLAYER_MATCH_MILESTONES.includes(playerMatches.length)) {
      add({
        kind: 'player-match-count',
        subject: player.id,
        title: `${player.name}: ${playerMatches.length} matches`,
        detail: `${player.name} just played match number ${playerMatches.length}.`,
        priority: 2,
        playerIds: [player.id],
      });
    }
  }

  if (!winner) return milestones.sort((a, b) => b.priority - a.priority);

  for (const player of winners) {
    const playerHistory = history.filter(m => sideOf(m, player.id) !== null && getMatchWinner(m) !== null);
    const won = (m: MatchHistoryItem) => getMatchWinner(m) === sideOf(m, player.id);

    // Win streak (including this match).
    let streak = 1;
    for (let i = playerHistory.length - 1; i >= 0 && won(playerHistory[i]); i--) streak++;
    if (WIN_STREAK_MILESTONES.includes(streak)) {
      add({
        kind: 'win-streak',
        subject: player.id,
        title: `${player.name} is on fire`,
        detail: `${streak} wins in a row!`,
        priority: streak >= 10 ? 6 : streak >= 5 ? 5 : 3,
        playerIds: [player.id],
      });
    }

    // Losing streak ended.
    let lossRun = 0;
    for (let i = playerHistory.length - 1; i >= 0 && !won(playerHistory[i]); i--) lossRun++;
    if (lossRun >= 3) {
      add({
        kind: 'drought-over',
        subject: player.id,
        title: 'Drought over',
        detail: `${player.name} wins after ${lossRun} defeats in a row.`,
        priority: 3,
        playerIds: [player.id],
      });
    }

    for (const loser of losers) {
      const meetings = history.filter(m => {
        const mine = sideOf(m, player.id);
        const theirs = sideOf(m, loser.id);
        return mine !== null && theirs !== null && mine !== theirs && getMatchWinner(m) !== null;
      });
      if (meetings.length === 0) continue;

      if (!meetings.some(won)) {
        add({
          kind: 'first-win-over',
          subject: `${player.id}:${loser.id}`,
          title: `First win over ${loser.name}`,
          detail: `${player.name} finally beats ${loser.name} after ${meetings.length} tr${meetings.length === 1 ? 'y' : 'ies'}.`,
          priority: 4,
          playerIds: [player.id, loser.id],
        });
        continue;
      }

      const last = meetings[meetings.length - 1];
      const lastMargin = Math.abs((last.team1_score ?? 0) - (last.team2_score ?? 0));
      if (!won(last) && lastMargin >= HAMMERING_MARGIN) {
        add({
          kind: 'revenge',
          subject: `${player.id}:${loser.id}`,
          title: 'Revenge!',
          detail: `${player.name} pays ${loser.name} back for the ${last.team1_score}-${last.team2_score}.`,
          priority: 3,
          playerIds: [player.id, loser.id],
        });
      }
    }

    // Night hat-trick: third win tonight (same night, or same local day for pre-night matches).
    const sameNight = (m: MatchHistoryItem) => match.game_night_id
      ? m.game_night_id === match.game_night_id
      : getLocalDateKey(m.played_at) === getLocalDateKey(match.played_at);
    const winsTonight = playerHistory.filter(m => sameNight(m) && won(m)).length + 1;
    if (winsTonight === 3) {
      add({
        kind: 'night-hat-trick',
        subject: player.id,
        title: 'Hat-trick of wins',
        detail: `${player.name} has won 3 matches tonight.`,
        priority: 2,
        playerIds: [player.id],
      });
    }
  }

  const margin = Math.abs(match.team1_score! - match.team2_score!);
  const loserNames = joinNames(losers.map(p => p.name));
  if (margin >= HAMMERING_MARGIN) {
    add({
      kind: 'hammering',
      title: margin >= 6 ? 'Demolition' : 'Hammering',
      detail: `${winnerNames || 'The winners'} won ${Math.max(match.team1_score!, match.team2_score!)}-${Math.min(match.team1_score!, match.team2_score!)}${loserNames ? ` against ${loserNames}` : ''}.`,
      priority: margin >= 6 ? 4 : 2,
      playerIds: everyone.map(p => p.id),
    });
  }

  const teamMap = new Map(teams.map(t => [t.id, t]));
  const winnerTeam = teamMap.get(winner === 1 ? match.team1_id : match.team2_id);
  const loserTeam = teamMap.get(winner === 1 ? match.team2_id : match.team1_id);
  if (winnerTeam && loserTeam && loserTeam.overallRating - winnerTeam.overallRating >= GIANT_KILLER_OVR_GAP) {
    add({
      kind: 'giant-killer',
      title: 'Giant killer',
      detail: `${winnerTeam.name} (${winnerTeam.overallRating}) beat ${loserTeam.name} (${loserTeam.overallRating}).`,
      priority: 3,
      playerIds: winners.map(p => p.id),
    });
  }

  if (match.team1_score === match.team2_score && match.penalties_winner) {
    add({
      kind: 'penalties',
      title: 'Nerves of steel',
      detail: `${winnerNames || 'The winners'} won on penalties.`,
      priority: 2,
      playerIds: winners.map(p => p.id),
    });
  }

  return milestones.sort((a, b) => b.priority - a.priority);
}
