/**
 * Parses one page of FIFA Index's team list (https://fifaindex.com/teams) —
 * the Career Mode squad ratings that match the ATT/MID/DEF/OVR on the in-game
 * team select screen. Replaces SoFIFA, which now puts every visitor behind a
 * Cloudflare "I'm not a robot" check.
 *
 * FIFA Index links each team as /teams/<id>-<slug>, where <id> is EA's own team
 * id (Arsenal = 1, Real Madrid = 243, Spain = 1362) — the same ids SoFIFA used.
 */

/** FIFA Index's list page size; a shorter page means it was the last one. */
export const FIFAINDEX_PAGE_SIZE = 50;

export interface SourceTeam {
  /** EA's team id (FIFA Index and SoFIFA both use it). */
  teamId: number;
  name: string;
  /** null for national teams (FIFA Index lists them under "International"). */
  league: string | null;
  overall: number;
  attack: number;
  midfield: number;
  defend: number;
}

export interface SourcePage {
  teams: SourceTeam[];
  /** Number of team rows on the page, including women's teams and rows that failed to parse. */
  rowCount: number;
  /** Game version of the data, e.g. "FC27". */
  version: string | null;
}

/** "Spain Primera División (1)" → "Spain Primera División"; "International" → null. */
export function cleanLeague(text: string | null | undefined): string | null {
  const league = text?.replace(/\s*\(\d+\)\s*$/, '').trim();
  if (!league || /^international/i.test(league)) return null;
  return league;
}

/** "Teams in FC 27" → "FC27". */
export function parseVersion(text: string | null | undefined): string | null {
  const match = text?.match(/\bFC\s?(\d{2})\b/i);
  return match ? `FC${match[1]}` : null;
}

const number = (cell: Element | undefined): number | null => {
  const value = Number.parseInt(cell?.textContent?.trim() ?? '', 10);
  return Number.isNaN(value) ? null : value;
};

export function parseFifaIndexTeamsPage(html: string): SourcePage {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const teams: SourceTeam[] = [];
  let rowCount = 0;

  for (const row of Array.from(doc.querySelectorAll('table tbody tr'))) {
    const link = row.querySelector<HTMLAnchorElement>("td a[href^='/teams/']");
    if (!link) continue;
    rowCount++;

    // Women's teams carry a "W" badge after the name; the app only plays men's teams.
    const spans = Array.from(link.querySelectorAll('span'));
    if (spans.slice(1).some(s => s.textContent?.trim().toUpperCase() === 'W')) continue;

    const cells = Array.from(row.querySelectorAll('td'));
    const id = link.getAttribute('href')?.match(/^\/teams\/(\d+)(?:-|$)/);
    const name = spans[0]?.textContent?.trim() || link.textContent?.trim();
    const [overall, attack, midfield, defend] = cells.slice(2, 6).map(number);
    if (!id || !name || overall == null || attack == null || midfield == null || defend == null) continue;

    teams.push({
      teamId: Number(id[1]),
      name,
      league: cleanLeague(cells[1]?.textContent),
      overall,
      attack,
      midfield,
      defend,
    });
  }

  return { teams, rowCount, version: parseVersion(doc.querySelector('h1')?.textContent) };
}
