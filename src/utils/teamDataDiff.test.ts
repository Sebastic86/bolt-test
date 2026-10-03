import { describe, expect, it } from 'vitest';
import type { SofifaTeam } from '../admin-tools/sofifaParser';
import { makeTeam } from '../test/fixtures';
import { Team } from '../types';
import { compareTeam, describeChanges, diffTeamData, findSameTeam, leavesStarFilter, logoFileName, newTeamRow, starRatingFor } from './teamDataDiff';

const sofifa = (name: string, overall: number, league: string | null = 'Premier League'): SofifaTeam => ({
  sofifaId: overall,
  name,
  league,
  overall,
  attack: overall + 1,
  midfield: overall,
  defend: overall - 1,
});

/** A database row that is exactly in sync with `sofifa(name, overall, league)`. */
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
  it('splits SoFIFA teams into changed, added and unchanged', () => {
    const db = [synced('a', 'Arsenal FC', 84), synced('l', 'Liverpool FC', 83)];
    const diff = diffTeamData([sofifa('Arsenal FC', 85), sofifa('Liverpool FC', 83), sofifa('Sunderland AFC', 79)], db);

    expect(diff.unchanged).toBe(1);
    expect(diff.added.map(t => t.name)).toEqual(['Sunderland AFC']);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].team.id).toBe('a');
    expect(diff.changed[0].updates).toEqual({ overallRating: 85, attackRating: 86, defendRating: 84, midfieldRating: 85 });
    expect(diff.missing).toEqual([]);
  });

  it('updates the star rating and league with the ratings', () => {
    const db = [synced('m', 'Manchester United', 82)];
    const [update] = diffTeamData([sofifa('Manchester United', 83)], db).changed;
    expect(update.updates.rating).toBe(5);
    expect(describeChanges(update.changes)).toBe('OVR 82→83, ATT 83→84, MID 82→83, DEF 81→82, ★ 4.5→5');
  });

  it('stores national teams under the Nation league', () => {
    const diff = diffTeamData([sofifa('Spain', 86, null)], [synced('s', 'Spain', 86, 'Nation')]);
    expect(diff.unchanged).toBe(1);
  });

  it('matches names regardless of accents and case', () => {
    const diff = diffTeamData([sofifa('Atlético Madrid', 83)], [synced('x', 'atletico madrid', 83)]);
    expect(diff.unchanged).toBe(1);
    expect(diff.added).toEqual([]);
  });

  it('reports database teams that are not on SoFIFA, without touching them', () => {
    const diff = diffTeamData([sofifa('Arsenal FC', 85)], [synced('a', 'Arsenal FC', 85), synced('o', 'Old Name FC', 70)]);
    expect(diff.missing.map(t => t.id)).toEqual(['o']);
  });

  it('skips names with more than one database row', () => {
    const diff = diffTeamData([sofifa('Arsenal FC', 85)], [synced('a1', 'Arsenal FC', 80), synced('a2', 'Arsenal FC', 81)]);
    expect(diff.ambiguous).toEqual(['Arsenal FC']);
    expect(diff.changed).toEqual([]);
    expect(diff.missing).toEqual([]);
  });
});

describe('newTeamRow', () => {
  it('follows the notebook conventions and leaves the logo to the resolver', () => {
    expect(newTeamRow(sofifa('Paris Saint-Germain', 85, "Ligue 1 McDonald's"), 'FC27')).toEqual({
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
    const update = compareTeam(synced('a', 'Arsenal FC', 84), sofifa('Arsenal FC', 85));
    expect(update.updates).toEqual({ overallRating: 85, attackRating: 86, midfieldRating: 85, defendRating: 84 });
  });

  it('is empty when the team already matches', () => {
    expect(compareTeam(synced('a', 'Arsenal FC', 85), sofifa('Arsenal FC', 85)).changes).toEqual([]);
  });
});

describe('findSameTeam', () => {
  const team = synced('b', 'Bayern Munchen', 84);

  it('picks the search result with the same name, ignoring accents', () => {
    const results = [sofifa('Bayern München', 84), sofifa('Bayern München II', 60)];
    expect(findSameTeam(team, results)?.name).toBe('Bayern München');
  });

  it('returns null when only partial matches come back, so the admin picks one', () => {
    expect(findSameTeam(synced('l', 'Liverpool', 83), [sofifa('Liverpool FC', 83)])).toBeNull();
  });
});

describe('leavesStarFilter', () => {
  const filter = { minRating: 3, maxRating: 4.5 };

  it('warns when the new stars fall outside the filter', () => {
    expect(leavesStarFilter(compareTeam(synced('m', 'Manchester United', 82), sofifa('Manchester United', 83)), filter)).toBe(true);
  });

  it('stays quiet when the stars do not change or stay inside the filter', () => {
    expect(leavesStarFilter(compareTeam(synced('a', 'Aston Villa', 79), sofifa('Aston Villa', 80)), filter)).toBe(false);
    expect(leavesStarFilter(compareTeam(synced('c', 'Chelsea FC', 78), sofifa('Chelsea FC', 79)), filter)).toBe(false);
  });
});
