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
  return Array.from(versions).sort(compareVersions);
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

/** Trailing number of a version label ("FC27" → 27), NaN if there is none. */
const versionNumber = (version: string) => {
  const match = version.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : Number.NaN;
};

/** Orders versions by their number (FC9 < FC27), falling back to alphabetical. */
export function compareVersions(a: string, b: string): number {
  const [x, y] = [versionNumber(a), versionNumber(b)];
  if (!Number.isNaN(x) && !Number.isNaN(y) && x !== y) return x - y;
  return a.localeCompare(b);
}

/** The current season: the newest version among the teams (e.g. FC27), or null with no teams. */
export function getLatestVersion(versions: string[]): string | null {
  return versions.length > 0 ? [...versions].sort(compareVersions)[versions.length - 1] : null;
}

/**
 * The version the generator uses. `saved` is the user's explicit choice
 * (null = follow the current season). A saved version that no longer exists
 * also falls back to the newest one.
 */
export function resolveSelectedVersion(saved: string | null, versions: string[]): string | null {
  if (saved && (versions.length === 0 || versions.includes(saved))) return saved;
  return getLatestVersion(versions) ?? saved;
}
