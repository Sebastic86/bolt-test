import { Team } from '../types';
import type { SofifaTeam } from '../admin-tools/sofifaParser';
import { normalizeTeamName } from './normalizeTeamName';

/** League stored for national teams (SoFIFA lists a confederation instead of a league). */
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

const matchKey = (name: string) => normalizeTeamName(name).toLowerCase().replace(/\s+/g, ' ');

/** The team columns SoFIFA is the source of truth for. */
export type SyncedField = 'overallRating' | 'attackRating' | 'midfieldRating' | 'defendRating' | 'rating' | 'league';
export type SyncedValues = Pick<Team, SyncedField>;

export function syncedValues(source: SofifaTeam): SyncedValues {
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
  source: SofifaTeam;
  changes: FieldChange[];
  updates: Partial<SyncedValues>;
}

export interface TeamDataDiff {
  /** In SoFIFA but not in the database (for this version). */
  added: SofifaTeam[];
  changed: TeamUpdate[];
  unchanged: number;
  /** In the database but not on SoFIFA — reported only, never deleted (matches reference them). */
  missing: Team[];
  /** Names with more than one database row in this version — skipped, fix by hand. */
  ambiguous: string[];
}

/**
 * Compares SoFIFA's teams with the database rows of one version, matching by
 * name (accent- and case-insensitive). Only the synced fields are compared;
 * logos and API ids are never touched.
 */
export function diffTeamData(source: SofifaTeam[], dbTeams: Team[]): TeamDataDiff {
  const byKey = new Map<string, Team[]>();
  for (const team of dbTeams) {
    const key = matchKey(team.name);
    byKey.set(key, [...(byKey.get(key) ?? []), team]);
  }

  const diff: TeamDataDiff = { added: [], changed: [], unchanged: 0, missing: [], ambiguous: [] };
  const matched = new Set<string>();

  for (const src of source) {
    const key = matchKey(src.name);
    const rows = byKey.get(key);
    if (!rows) {
      diff.added.push(src);
      continue;
    }
    matched.add(key);
    if (rows.length > 1) {
      diff.ambiguous.push(src.name);
      continue;
    }

    const [team] = rows;
    const next = syncedValues(src);
    const changes: FieldChange[] = [];
    const updates: Partial<SyncedValues> = {};
    for (const field of Object.keys(next) as SyncedField[]) {
      if (team[field] !== next[field]) {
        changes.push({ field, from: team[field], to: next[field] });
        Object.assign(updates, { [field]: next[field] });
      }
    }
    if (changes.length > 0) diff.changed.push({ team, source: src, changes, updates });
    else diff.unchanged++;
  }

  diff.missing = dbTeams.filter(t => !matched.has(matchKey(t.name)));
  return diff;
}

/**
 * A new teams row for a SoFIFA team, following the notebook's conventions.
 * No resolvedLogoUrl: SoFIFA's crest CDN refuses hotlinks, so the logo
 * resolver fills it in later.
 */
export function newTeamRow(source: SofifaTeam, version: string): Omit<Team, 'id'> {
  return {
    name: source.name,
    ...syncedValues(source),
    version,
    logoUrl: logoFileName(source.name),
    resolvedLogoUrl: null,
  };
}

const FIELD_LABELS: Record<SyncedField, string> = {
  overallRating: 'OVR',
  attackRating: 'ATT',
  midfieldRating: 'MID',
  defendRating: 'DEF',
  rating: '★',
  league: 'league',
};

/** "OVR 82→83, ★ 4.5→5" */
export const describeChanges = (changes: FieldChange[]) =>
  changes.map(c => `${FIELD_LABELS[c.field]} ${c.from}→${c.to}`).join(', ');
