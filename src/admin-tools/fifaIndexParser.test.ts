import { describe, expect, it } from 'vitest';
import page from './__fixtures__/fifaindex-teams-page.html?raw';
import { cleanLeague, parseFifaIndexTeamsPage, parseVersion } from './fifaIndexParser';

describe('parseFifaIndexTeamsPage', () => {
  it('reads the men\'s team rows of a live FIFA Index page and skips women\'s teams', () => {
    const { teams, rowCount, version } = parseFifaIndexTeamsPage(page);
    expect(rowCount).toBe(5);
    expect(version).toBe('FC27');
    expect(teams).toEqual([
      { teamId: 243, name: 'Real Madrid', league: 'Spain Primera División', overall: 85, attack: 86, midfield: 86, defend: 83 },
      { teamId: 241, name: 'FC Barcelona', league: 'Spain Primera División', overall: 85, attack: 86, midfield: 85, defend: 83 },
      { teamId: 1, name: 'Arsenal', league: 'England Premier League', overall: 85, attack: 83, midfield: 85, defend: 83 },
      { teamId: 1362, name: 'Spain', league: null, overall: 86, attack: 86, midfield: 86, defend: 84 },
    ]);
  });

  it('counts rows it cannot parse without returning them', () => {
    const broken = page.replace('text-stat-high">85</td><td class="px-3 py-2 text-center font-bold font-heading text-stat-high">86</td><td class="px-3 py-2 text-center font-bold font-heading text-stat-high">86', 'text-stat-high">–</td><td>86</td><td>86');
    const { teams, rowCount } = parseFifaIndexTeamsPage(broken);
    expect(rowCount).toBe(5);
    expect(teams.map(t => t.name)).not.toContain('Real Madrid');
  });

  it('returns nothing for a page without the team table', () => {
    expect(parseFifaIndexTeamsPage('<html><body>Just a moment...</body></html>')).toEqual({ teams: [], rowCount: 0, version: null });
  });
});

describe('cleanLeague / parseVersion', () => {
  it('drops the division suffix and maps International to a national team', () => {
    expect(cleanLeague('Holland Eredivisie (1)')).toBe('Holland Eredivisie');
    expect(cleanLeague('CONMEBOL Sudamericana')).toBe('CONMEBOL Sudamericana');
    expect(cleanLeague('International')).toBeNull();
  });

  it('reads the game version from the heading', () => {
    expect(parseVersion('Teams in FC 27')).toBe('FC27');
    expect(parseVersion('Teams')).toBeNull();
  });
});
