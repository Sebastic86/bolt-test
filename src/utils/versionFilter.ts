import { MatchHistoryItem, Team } from '../types';

/** Sentinel value for "no version filter". */
export const ALL_VERSIONS = 'All';

/**
 * Distinct game versions (e.g. FC25, FC26), sorted. Derived from the teams
 * list; when no teams are available (e.g. a caller that doesn't pass them)
 * falls back to the versions found on the matches themselves.
 */
export function getAvailableVersions(teams: Team[] | undefined, matches: MatchHistoryItem[] = []): string[] {
  const versions = new Set<string>();
  if (teams && teams.length > 0) {
    teams.forEach(t => { if (t.version) versions.add(t.version); });
  } else {
    matches.forEach(m => {
      if (m.team1_version) versions.add(m.team1_version);
      if (m.team2_version) versions.add(m.team2_version);
    });
  }
  return Array.from(versions).sort();
}

/**
 * Keep only matches played in the given version. A match counts for a
 * version only when BOTH teams are that version (AND logic) — a cross-
 * version match (FC25 vs FC26) belongs to neither and only shows under "All".
 */
export function filterMatchesByVersion(matches: MatchHistoryItem[], version: string): MatchHistoryItem[] {
  if (version === ALL_VERSIONS) return matches;
  return matches.filter(m => m.team1_version === version && m.team2_version === version);
}
