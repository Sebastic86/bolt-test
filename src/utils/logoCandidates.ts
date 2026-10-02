import { Match, Team } from '../types';
import { ALL_VERSIONS } from './versionFilter';

export interface LogoCandidateFilter {
  /** Only teams of this version (e.g. 'FC27'); ALL_VERSIONS / undefined = every version. */
  version?: string;
  /** Only teams with at least this star rating (e.g. 4.0); 0 / undefined = no minimum. */
  minRating?: number;
}

/** How many matches each team has played (team id → count). */
export function countTeamUsage(matches: Pick<Match, 'team1_id' | 'team2_id'>[]): Map<string, number> {
  const usage = new Map<string, number>();
  for (const m of matches) {
    usage.set(m.team1_id, (usage.get(m.team1_id) ?? 0) + 1);
    usage.set(m.team2_id, (usage.get(m.team2_id) ?? 0) + 1);
  }
  return usage;
}

export function matchesLogoFilter(team: Team, { version, minRating = 0 }: LogoCandidateFilter): boolean {
  if (version && version !== ALL_VERSIONS && team.version !== version) return false;
  return team.rating >= minRating;
}

/**
 * Orders teams so the most-played ones get resolved first (they eat the
 * API-Sports quota before it runs out), then by star rating — likely picks
 * for future nights — then by name for a stable order.
 */
export function prioritizeByUsage(teams: Team[], usage: Map<string, number>): Team[] {
  return [...teams].sort(
    (a, b) =>
      (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) ||
      b.rating - a.rating ||
      a.name.localeCompare(b.name)
  );
}
