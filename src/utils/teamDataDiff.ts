import { Team } from '../types';
import type { SourceTeam } from '../admin-tools/fifaIndexParser';
import { normalizeTeamName } from './normalizeTeamName';

/** League stored for national teams (the source lists them under "International"). */
export const NATION_LEAGUE = 'Nation';

/**
 * Star rating from the overall rating, using the data_finder notebook's
 * thresholds. 83/79 line up with EA's published FC27 5★ / 4.5★ clubs; the
 * lower cut-offs are the notebook's own and not verified against the game.
 */
export function starRatingFor(overall: number): number {
  if (overall >= 83) return 5;
  if (overall >= 79) return 4.5;
  if (overall >= 75) return 4;
  if (overall >= 71) return 3.5;
  if (overall >= 69) return 3;
  return 2;
}

/** Bundled-crest filename convention from the notebook: "Arsenal FC" → "arsenalfc.png". */
export const logoFileName = (name: string) => `${name.replace(/ /g, '').toLowerCase()}.png`;

const matchKey = (name: string) => normalizeTeamName(name).toLowerCase().replace(/\s+/g, ' ').trim();

/** Club-name affixes that differ between sources and our rows ("Arsenal FC" vs "Arsenal"). */
const AFFIXES = new Set(['fc', 'afc', 'cf', 'sc', 'ac', 'as', 'ssc', 'cd', 'ud', 'rc', 'rcd', 'sd', 'fk', 'sk', 'sv', 'club', 'de', 'calcio', '1.']);

/**
 * Looser key for names that differ only in club affixes, punctuation or
 * accents: "Atlético Madrid" / "Atlético de Madrid" → "atletico madrid",
 * "1. FC Köln" / "FC Köln" → "koln". Only used when the exact key finds nothing.
 */
export function looseMatchKey(name: string): string {
  const words = matchKey(name)
    .replace(/[^a-z0-9. ]+/g, ' ')
    .split(' ')
    .filter(w => w && !AFFIXES.has(w));
  return words.join(' ').replace(/\./g, '').trim();
}

/** The team columns the ratings source fills in. */
export type SyncedField = 'overallRating' | 'attackRating' | 'midfieldRating' | 'defendRating' | 'rating' | 'league';
export type SyncedValues = Pick<Team, SyncedField>;

/**
 * The fields kept in sync on existing teams. League is only set on new teams:
 * FIFA Index names leagues differently ("England Premier League" vs our
 * "Premier League"), and the league never changes the matchups anyway.
 */
export const COMPARED_FIELDS: SyncedField[] = ['overallRating', 'attackRating', 'midfieldRating', 'defendRating', 'rating'];

export function syncedValues(source: SourceTeam): SyncedValues {
  return {
    overallRating: source.overall,
    attackRating: source.attack,
    midfieldRating: source.midfield,
    defendRating: source.defend,
    rating: starRatingFor(source.overall),
    league: source.league ?? NATION_LEAGUE,
  };
}

export interface FieldChange {
  field: SyncedField;
  from: string | number;
  to: string | number;
}

export interface TeamUpdate {
  team: Team;
  source: SourceTeam;
  changes: FieldChange[];
  updates: Partial<SyncedValues>;
}

export interface TeamDataDiff {
  /** In the source but not in the database (for this version). */
  added: SourceTeam[];
  changed: TeamUpdate[];
  unchanged: number;
  /** In the database but not in the source — reported only, never deleted (matches reference them). */
  missing: Team[];
  /** Names with more than one database row in this version — skipped, fix by hand. */
  ambiguous: string[];
}

function groupBy(teams: Team[], key: (name: string) => string): Map<string, Team[]> {
  const map = new Map<string, Team[]>();
  for (const team of teams) {
    const k = key(team.name);
    if (k) map.set(k, [...(map.get(k) ?? []), team]);
  }
  return map;
}

/**
 * Compares the source's teams with the database rows of one version, matching
 * by name (accent- and case-insensitive), then — for names that differ only in
 * affixes like "FC" — by the looser key, as long as that points at exactly one
 * row not matched yet. Only the rating fields are compared; logos, league and
 * API ids are never touched.
 */
export function diffTeamData(source: SourceTeam[], dbTeams: Team[]): TeamDataDiff {
  const byKey = groupBy(dbTeams, matchKey);
  const byLooseKey = groupBy(dbTeams, looseMatchKey);
  const exactKeys = new Set(source.map(s => matchKey(s.name)));

  const diff: TeamDataDiff = { added: [], changed: [], unchanged: 0, missing: [], ambiguous: [] };
  const matched = new Set<string>();

  for (const src of source) {
    let rows = byKey.get(matchKey(src.name));
    if (!rows) {
      // Loose fallback: one unmatched row whose own name isn't also an exact source name.
      const loose = (byLooseKey.get(looseMatchKey(src.name)) ?? []).filter(
        t => !matched.has(t.id) && !exactKeys.has(matchKey(t.name))
      );
      if (loose.length === 1) rows = loose;
    }
    if (!rows) {
      diff.added.push(src);
      continue;
    }
    rows.forEach(t => matched.add(t.id));
    if (rows.length > 1) {
      diff.ambiguous.push(src.name);
      continue;
    }

    const update = compareTeam(rows[0], src);
    if (update.changes.length > 0) diff.changed.push(update);
    else diff.unchanged++;
  }

  diff.missing = dbTeams.filter(t => !matched.has(t.id));
  return diff;
}

/** What would change on `team` if it took the source's ratings (empty `changes` = up to date). */
export function compareTeam(team: Team, source: SourceTeam): TeamUpdate {
  const next = syncedValues(source);
  const changes: FieldChange[] = [];
  const updates: Partial<SyncedValues> = {};
  for (const field of COMPARED_FIELDS) {
    if (team[field] !== next[field]) {
      changes.push({ field, from: team[field], to: next[field] });
      Object.assign(updates, { [field]: next[field] });
    }
  }
  return { team, source, changes, updates };
}

/**
 * The search result that is this team: the only one with the same name, or
 * else the only one with the same loose name ("Arsenal FC" → "Arsenal").
 */
export function findSameTeam(team: Team, candidates: SourceTeam[]): SourceTeam | null {
  const key = matchKey(team.name);
  const exact = candidates.filter(c => matchKey(c.name) === key);
  if (exact.length > 0) return exact.length === 1 ? exact[0] : null;
  const loose = looseMatchKey(team.name);
  const similar = candidates.filter(c => looseMatchKey(c.name) === loose);
  return similar.length === 1 ? similar[0] : null;
}

/**
 * A new teams row for a source team, following the notebook's conventions.
 * No resolvedLogoUrl: the logo resolver fills it in later.
 */
export function newTeamRow(source: SourceTeam, version: string): Omit<Team, 'id'> {
  return {
    name: source.name,
    ...syncedValues(source),
    version,
    logoUrl: logoFileName(source.name),
    resolvedLogoUrl: null,
  };
}

export const FIELD_LABELS: Record<SyncedField, string> = {
  overallRating: 'OVR',
  attackRating: 'ATT',
  midfieldRating: 'MID',
  defendRating: 'DEF',
  rating: '★',
  league: 'league',
};

/**
 * True when an update moves the team's stars outside the dashboard's star
 * filter — the match generator then drops it from the current matchup.
 */
export function leavesStarFilter(update: TeamUpdate, { minRating, maxRating }: { minRating: number; maxRating: number }): boolean {
  const stars = update.updates.rating;
  return stars !== undefined && (stars < minRating || stars > maxRating);
}

/** "OVR 82→83, ★ 4.5→5" */
export const describeChanges = (changes: FieldChange[]) =>
  changes.map(c => `${FIELD_LABELS[c.field]} ${c.from}→${c.to}`).join(', ');
