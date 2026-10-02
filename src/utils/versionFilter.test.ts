import { describe, expect, it } from 'vitest';
import {
  ALL_VERSIONS, compareVersions, filterMatchesByVersion, getAvailableVersions, getLatestVersion, resolveSelectedVersion,
} from './versionFilter';
import { MatchHistoryItem, Team } from '../types';

function makeTeam(id: string, version: string): Team {
  return {
    id, name: `Team ${id}`, league: 'L', rating: 4, logoUrl: '',
    overallRating: 80, attackRating: 80, midfieldRating: 80, defendRating: 80, version,
  };
}

function makeMatch(id: string, v1: string, v2: string): MatchHistoryItem {
  return {
    id, team1_id: 'a', team2_id: 'b', team1_score: 1, team2_score: 0, penalties_winner: null,
    played_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z', created_by: null,
    team1_name: 'A', team1_logoUrl: '', team1_version: v1,
    team2_name: 'B', team2_logoUrl: '', team2_version: v2,
    team1_players: [], team2_players: [],
  };
}

describe('getAvailableVersions', () => {
  it('returns the distinct team versions, sorted', () => {
    const teams = [makeTeam('1', 'FC26'), makeTeam('2', 'FC25'), makeTeam('3', 'FC26')];
    expect(getAvailableVersions(teams)).toEqual(['FC25', 'FC26']);
  });

  it('falls back to versions found on the matches when no teams are given', () => {
    const matches = [makeMatch('m1', 'FC26', 'FC26'), makeMatch('m2', 'FC25', 'FC26')];
    expect(getAvailableVersions(undefined, matches)).toEqual(['FC25', 'FC26']);
    expect(getAvailableVersions([], matches)).toEqual(['FC25', 'FC26']);
  });

  it('prefers teams over matches when both are available', () => {
    expect(getAvailableVersions([makeTeam('1', 'FC26')], [makeMatch('m1', 'FC25', 'FC25')])).toEqual(['FC26']);
  });
});

describe('filterMatchesByVersion', () => {
  const same25 = makeMatch('same25', 'FC25', 'FC25');
  const same26 = makeMatch('same26', 'FC26', 'FC26');
  const mixed = makeMatch('mixed', 'FC25', 'FC26');
  const matches = [same25, same26, mixed];

  it('returns every match for "All"', () => {
    expect(filterMatchesByVersion(matches, ALL_VERSIONS)).toBe(matches);
  });

  it('requires BOTH teams to be the selected version (AND logic)', () => {
    expect(filterMatchesByVersion(matches, 'FC25').map(m => m.id)).toEqual(['same25']);
    expect(filterMatchesByVersion(matches, 'FC26').map(m => m.id)).toEqual(['same26']);
  });

  it('returns nothing for an unknown version', () => {
    expect(filterMatchesByVersion(matches, 'FC99')).toEqual([]);
  });
});

describe('current season', () => {
  it('orders versions by number, not alphabetically', () => {
    expect(['FC27', 'FC9', 'FC26'].sort(compareVersions)).toEqual(['FC9', 'FC26', 'FC27']);
  });

  it('picks the newest version as the current season', () => {
    expect(getLatestVersion(['FC25', 'FC27', 'FC26'])).toBe('FC27');
    expect(getLatestVersion([])).toBeNull();
  });

  it('follows the newest version unless an existing one was chosen', () => {
    const versions = ['FC25', 'FC26', 'FC27'];
    expect(resolveSelectedVersion(null, versions)).toBe('FC27');
    expect(resolveSelectedVersion('FC26', versions)).toBe('FC26');
    expect(resolveSelectedVersion('FC24', versions)).toBe('FC27');
    // Teams not loaded yet: keep the saved choice.
    expect(resolveSelectedVersion('FC26', [])).toBe('FC26');
    expect(resolveSelectedVersion(null, [])).toBeNull();
  });
});
