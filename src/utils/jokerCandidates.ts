import { Team } from '../types';

export const JOKER_CANDIDATE_COUNT = 3;

interface PickJokerCandidatesOptions {
  /** Teams the joker may draw from (current filters, not played today). */
  pool: Team[];
  /** The team that stays — candidates must be a valid opponent for it. */
  opponent: Team;
  /** Team ids that can never be drawn (both current matchup teams). */
  excludeIds: string[];
  maxOvrDiff: number;
  count?: number;
  /** Injected for tests; returns [0, 1). */
  random?: () => number;
}

/**
 * Teams a joker may swap in for one side of the matchup, using the same
 * rules handleUpdateTeam/getSmartOpponent apply so the opponent stays valid:
 * |OVR diff| <= maxOvrDiff and nation-vs-nation / club-vs-club only.
 */
export function getEligibleJokerTeams({ pool, opponent, excludeIds, maxOvrDiff }: Omit<PickJokerCandidatesOptions, 'count' | 'random'>): Team[] {
  const excluded = new Set([...excludeIds, opponent.id]);
  const opponentIsNation = opponent.league === 'Nation';
  return pool.filter(team =>
    !excluded.has(team.id)
    && (team.league === 'Nation') === opponentIsNation
    && Math.abs(team.overallRating - opponent.overallRating) <= maxOvrDiff
  );
}

/**
 * One fair draw of up to `count` distinct candidates (uniform, without
 * replacement). Fewer are returned when the eligible pool is smaller.
 */
export function pickJokerCandidates({ count = JOKER_CANDIDATE_COUNT, random = Math.random, ...rest }: PickJokerCandidatesOptions): Team[] {
  const remaining = getEligibleJokerTeams(rest);
  const picked: Team[] = [];
  while (picked.length < count && remaining.length > 0) {
    const index = Math.min(remaining.length - 1, Math.floor(random() * remaining.length));
    picked.push(remaining.splice(index, 1)[0]);
  }
  return picked;
}
