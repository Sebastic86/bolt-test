import { describe, expect, it } from 'vitest';
import page from './__fixtures__/sofifa-teams-page.html?raw';
import { parseSofifaTeamsPage } from './sofifaParser';

describe('parseSofifaTeamsPage', () => {
  it('reads the team rows of a live SoFIFA page', () => {
    const { teams, rowCount } = parseSofifaTeamsPage(page);
    expect(rowCount).toBe(3);
    expect(teams).toEqual([
      { sofifaId: 1362, name: 'Spain', league: null, overall: 86, attack: 85, midfield: 86, defend: 84 },
      { sofifaId: 1, name: 'Arsenal FC', league: 'Premier League', overall: 85, attack: 83, midfield: 85, defend: 83 },
      { sofifaId: 1335, name: 'France', league: null, overall: 85, attack: 88, midfield: 84, defend: 84 },
    ]);
  });

  it('reads the selected version and roster update', () => {
    expect(parseSofifaTeamsPage(page)).toMatchObject({ version: 'FC27', rosterId: '270003', rosterDate: 'Oct 1, 2026' });
  });

  it('counts rows it cannot parse without returning them', () => {
    const broken = page.replace('<em title="85">85</em>', '<em>–</em>');
    const { teams, rowCount } = parseSofifaTeamsPage(broken);
    expect(rowCount).toBe(3);
    expect(teams).toHaveLength(2);
  });

  it('returns nothing for a page without the team table', () => {
    expect(parseSofifaTeamsPage('<html><body>Sign in</body></html>')).toEqual({
      teams: [],
      rowCount: 0,
      version: null,
      rosterId: null,
      rosterDate: null,
    });
  });
});
