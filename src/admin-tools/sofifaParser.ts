/**
 * Parses one page of SoFIFA's team list (https://sofifa.com/teams?type=all)
 * — the same columns the old data_finder notebook scraped with jsoup. SoFIFA
 * reads these values straight from the game database for every roster update,
 * so they match the ATT/MID/DEF/OVR shown on the in-game team select screen.
 */

/** SoFIFA's list page size; a shorter page means it was the last one. */
export const SOFIFA_PAGE_SIZE = 60;

export interface SofifaTeam {
  sofifaId: number;
  name: string;
  /** null for national teams (they link to a confederation, not a league). */
  league: string | null;
  overall: number;
  attack: number;
  midfield: number;
  defend: number;
}

export interface SofifaPage {
  teams: SofifaTeam[];
  /** Number of team rows on the page, including any that failed to parse. */
  rowCount: number;
  /** Game version of the data, e.g. "FC27". */
  version: string | null;
  /** Roster update id (e.g. "270003") — pass it back to pin later pages to the same roster. */
  rosterId: string | null;
  /** Human-readable roster date, e.g. "Oct 1, 2026". */
  rosterDate: string | null;
}

const rating = (row: Element, column: string): number | null => {
  const value = Number.parseInt(row.querySelector(`td[data-col='${column}'] em`)?.textContent?.trim() ?? '', 10);
  return Number.isNaN(value) ? null : value;
};

const selectedOption = (doc: Document, selectId: string) =>
  doc.querySelector<HTMLOptionElement>(`#${selectId} option[selected]`) ?? doc.querySelector<HTMLOptionElement>(`#${selectId} option`);

export function parseSofifaTeamsPage(html: string): SofifaPage {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const teams: SofifaTeam[] = [];
  let rowCount = 0;

  for (const row of Array.from(doc.querySelectorAll('table tbody tr'))) {
    const link = row.querySelector<HTMLAnchorElement>("td a[href*='/team/']");
    if (!link) continue;
    rowCount++;

    const id = link.getAttribute('href')?.match(/\/team\/(\d+)\//);
    const [overall, attack, midfield, defend] = ['oa', 'at', 'md', 'df'].map(col => rating(row, col));
    const name = link.textContent?.trim();
    if (!id || !name || overall === null || attack === null || midfield === null || defend === null) continue;

    teams.push({
      sofifaId: Number(id[1]),
      name,
      league: row.querySelector("td a[href^='/league/']")?.textContent?.trim() || null,
      overall,
      attack,
      midfield,
      defend,
    });
  }

  const roster = selectedOption(doc, 'select-roster');
  return {
    teams,
    rowCount,
    version: selectedOption(doc, 'select-version')?.textContent?.trim() || null,
    rosterId: roster?.value.match(/[?&]r=(\d+)/)?.[1] ?? null,
    rosterDate: roster?.textContent?.trim() || null,
  };
}
