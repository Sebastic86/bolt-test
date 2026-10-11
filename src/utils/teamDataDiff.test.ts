import { describe, expect, it } from 'vitest';
import type { SourceTeam } from '../admin-tools/fifaIndexParser';
import { makeTeam } from '../test/fixtures';
import { Team } from '../types';
import { compareTeam, describeChanges, diffTeamData, findSameTeam, leavesStarFilter, logoFileName, looseMatchKey, newTeamRow, starRatingFor } from './teamDataDiff';

const source = (name: string, overall: number, league: string | null = 'Premier League'): SourceTeam => ({
  teamId: overall,
  name,
  league,
  overall,
  attack: overall + 1,
  midfield: overall,
  defend: overall - 1,
});

/** A database row that is exactly in sync with `source(name, overall, league)`. */
const synced = (id: string, name: string, overall: number, league = 'Premier League'): Team => ({
  ...makeTeam(id, overall),
  name,
  league,
  rating: starRatingFor(overall),
  attackRating: overall + 1,
  defendRating: overall - 1,
});

describe('starRatingFor', () => {
  it.each([
    [86, 5], [83, 5], [82, 4.5], [79, 4.5], [78, 4], [75, 4], [74, 3.5], [71, 3.5], [70, 3], [69, 3], [68, 2], [50, 2],
  ])('%i OVR → %d stars', (overall, stars) => {
    expect(starRatingFor(overall)).toBe(stars);
  });
});

describe('diffTeamData', () => {
  it('splits source teams into changed, added and unchanged', () => {
    const db = [synced('a', 'Arsenal FC', 84), synced('l', 'Liverpool FC', 83)];
    const diff = diffTeamData([source('Arsenal FC', 85), source('Liverpool FC', 83), source('Sunderland AFC', 79)], db);

    expect(diff.unchanged).toBe(1);
    expect(diff.added.map(t => t.name)).toEqual(['Sunderland AFC']);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].team.id).toBe('a');
    expect(diff.changed[0].updates).toEqual({ overallRating: 85, attackRating: 86, defendRating: 84, midfieldRating: 85 });
    expect(diff.missing).toEqual([]);
  });

  it('updates the star rating with the ratings', () => {
    const db = [synced('m', 'Manchester United', 82)];
    const [update] = diffTeamData([source('Manchester United', 83)], db).changed;
    expect(update.updates.rating).toBe(5);
    expect(describeChanges(update.changes)).toBe('OVR 82→83, ATT 83→84, MID 82→83, DEF 81→82, ★ 4.5→5');
  });

  it('stores national teams under the Nation league', () => {
    const diff = diffTeamData([source('Spain', 86, null)], [synced('s', 'Spain', 86, 'Nation')]);
    expect(diff.unchanged).toBe(1);
  });

  it('matches names that only differ in club affixes, and keeps our league', () => {
    const db = [synced('a', 'Arsenal FC', 84), synced('m', 'Atlético Madrid', 83, 'La Liga'), synced('k', '1. FC Köln', 72, 'Bundesliga')];
    const diff = diffTeamData(
      [source('Arsenal', 85, 'England Premier League'), source('Atlético de Madrid', 83, 'Spain Primera División'), source('FC Köln', 72, 'Germany 1. Bundesliga')],
      db
    );
    expect(diff.added).toEqual([]);
    expect(diff.missing).toEqual([]);
    expect(diff.unchanged).toBe(2);
    expect(diff.changed.map(u => u.team.id)).toEqual(['a']);
    expect(diff.changed[0].updates).not.toHaveProperty('league');
  });

  it('does not loosely match a row that has its own exact match', () => {
    const diff = diffTeamData([source('Arsenal', 85), source('Arsenal FC', 84)], [synced('a', 'Arsenal FC', 84)]);
    expect(diff.unchanged).toBe(1);
    expect(diff.added.map(t => t.name)).toEqual(['Arsenal']);
  });

  it('matches names regardless of accents and case', () => {
    const diff = diffTeamData([source('Atlético Madrid', 83)], [synced('x', 'atletico madrid', 83)]);
    expect(diff.unchanged).toBe(1);
    expect(diff.added).toEqual([]);
  });

  it('reports database teams that are not in the source, without touching them', () => {
    const diff = diffTeamData([source('Arsenal FC', 85)], [synced('a', 'Arsenal FC', 85), synced('o', 'Old Name FC', 70)]);
    expect(diff.missing.map(t => t.id)).toEqual(['o']);
  });

  it('skips names with more than one database row', () => {
    const diff = diffTeamData([source('Arsenal FC', 85)], [synced('a1', 'Arsenal FC', 80), synced('a2', 'Arsenal FC', 81)]);
    expect(diff.ambiguous).toEqual(['Arsenal FC']);
    expect(diff.changed).toEqual([]);
    expect(diff.missing).toEqual([]);
  });
});

describe('newTeamRow', () => {
  it('follows the notebook conventions and leaves the logo to the resolver', () => {
    expect(newTeamRow(source('Paris Saint-Germain', 85, "Ligue 1 McDonald's"), 'FC27')).toEqual({
      name: 'Paris Saint-Germain',
      league: "Ligue 1 McDonald's",
      rating: 5,
      overallRating: 85,
      attackRating: 86,
      midfieldRating: 85,
      defendRating: 84,
      version: 'FC27',
      logoUrl: 'parissaint-germain.png',
      resolvedLogoUrl: null,
    });
  });

  it('builds the bundled crest filename like the notebook', () => {
    expect(logoFileName('Real Betis Balompié')).toBe('realbetisbalompié.png');
  });
});

describe('compareTeam', () => {
  it('lists only the fields that differ', () => {
    const update = compareTeam(synced('a', 'Arsenal FC', 84), source('Arsenal FC', 85));
    expect(update.updates).toEqual({ overallRating: 85, attackRating: 86, midfieldRating: 85, defendRating: 84 });
  });

  it('is empty when the team already matches', () => {
    expect(compareTeam(synced('a', 'Arsenal FC', 85), source('Arsenal FC', 85)).changes).toEqual([]);
  });
});

describe('looseMatchKey', () => {
  it.each([
    ['Arsenal FC', 'arsenal'],
    ['Atlético de Madrid', 'atletico madrid'],
    ['1. FC Köln', 'koln'],
    ['AS Monaco', 'monaco'],
    ['Paris Saint-Germain', 'paris saint germain'],
  ])('%s → %s', (name, key) => expect(looseMatchKey(name)).toBe(key));
});

describe('findSameTeam', () => {
  const team = synced('b', 'Bayern Munchen', 84);

  it('picks the search result with the same name, ignoring accents', () => {
    const results = [source('Bayern München', 84), source('Bayern München II', 60)];
    expect(findSameTeam(team, results)?.name).toBe('Bayern München');
  });

  it('falls back to names that only differ in club affixes', () => {
    expect(findSameTeam(synced('l', 'Liverpool FC', 83), [source('Liverpool', 83)])?.name).toBe('Liverpool');
  });

  it('returns null when only partial matches come back, so the admin picks one', () => {
    expect(findSameTeam(synced('t', 'Spurs', 80), [source('Tottenham Hotspur', 80)])).toBeNull();
  });
});

describe('leavesStarFilter', () => {
  const filter = { minRating: 3, maxRating: 4.5 };

  it('warns when the new stars fall outside the filter', () => {
    expect(leavesStarFilter(compareTeam(synced('m', 'Manchester United', 82), source('Manchester United', 83)), filter)).toBe(true);
  });

  it('stays quiet when the stars do not change or stay inside the filter', () => {
    expect(leavesStarFilter(compareTeam(synced('a', 'Aston Villa', 79), source('Aston Villa', 80)), filter)).toBe(false);
    expect(leavesStarFilter(compareTeam(synced('c', 'Chelsea FC', 78), source('Chelsea FC', 79)), filter)).toBe(false);
  });
});
