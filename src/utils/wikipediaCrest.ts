import { normalizeTeamName } from './normalizeTeamName';

/**
 * Pure helpers for finding a team's crest on English Wikipedia: build the
 * search query, then pick the club / national-team article out of the
 * search results (skipping seasons, women's and youth sides, rivalries…).
 * The network call lives in src/services/wikipediaLogoService.ts.
 */

/** Minimal shape of a page from the search + pageimages API response. */
export interface WikipediaSearchPage {
  title: string;
  /** Position in the search results (the API returns pages unordered). */
  index?: number;
  thumbnail?: { source: string };
}

export interface WikipediaCrest {
  title: string;
  url: string;
}

/** Short names SoFIFA uses that don't search well (too short or a nickname). */
const ALIASES: Record<string, string> = {
  ol: 'Olympique Lyonnais',
  psg: 'Paris Saint-Germain',
  spurs: 'Tottenham Hotspur',
  'man utd': 'Manchester United',
  'man city': 'Manchester City',
};

/** Leagues stored for national teams ('Nation' from the SoFIFA import, 'International' in older data). */
export const isNationalTeamLeague = (league?: string | null) => /^(nation|international)/i.test(league?.trim() ?? '');

/** Club-type affixes and filler words that say nothing about which club it is. */
const STOP_WORDS = new Set([
  'fc', 'cf', 'sc', 'ac', 'afc', 'club', 'de', 'del', 'da', 'do', 'the', 'and', 'fk', 'sk', 'bk', 'kv', 'vv', 'sv',
  'cd', 'ud', 'rc', 'as', 'ss', 'ssc', 'us', 'calcio', 'football', 'futbol', 'hd', 'sl', 'ca',
]);

/** Lower-case ASCII, also folding ş, ı, ğ, í… that normalizeTeamName doesn't map. */
const fold = (text: string) =>
  normalizeTeamName(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i') // dotless ı
    .toLowerCase();

const tokens = (text: string) =>
  fold(text)
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3 && !STOP_WORDS.has(t));

/** Articles that are about something other than the senior team itself. */
const OFF_TOPIC =
  /\b(seasons?|women|ladies|femenino|femeni|feminin|feminine|femminile|frauen|lyonnes|youth|academy|under-\d+|u\d{2}|reserves|rivalry|derby|list of|history of|football in|ownership|stadium|kits?|records|statistics)\b|\b(II|B)$/i;

const NATIONAL_TEAM_TITLE = /national (football|soccer) team$/i;
const NOT_SENIOR_NATIONAL = /under|women|futsal|beach|olympic|\bB\b/i;

const resolveAlias = (teamName: string) => ALIASES[teamName.trim().toLowerCase()] ?? teamName.trim();

/** Search text for a team: "<name> national football team" or "<name> football club". */
export function buildWikipediaSearch(teamName: string, league?: string | null): string {
  const name = resolveAlias(teamName);
  return isNationalTeamLeague(league) ? `${name} national football team` : `${name} football club`;
}

/** Thumbnail URL without Wikimedia's utm_* tracking query. */
const cleanUrl = (url: string) => url.split('?')[0];

/**
 * Picks the first search result that is the team's own article and has an
 * image. A club article must share a meaningful word with the team name
 * ("Inter" → "Inter Milan", not "Football Inter Club Association" for
 * "Spurs"…); a national team must be the senior "X national football team".
 */
export function pickWikipediaCrest(
  pages: WikipediaSearchPage[],
  teamName: string,
  league?: string | null
): WikipediaCrest | null {
  const national = isNationalTeamLeague(league);
  const wanted = tokens(resolveAlias(teamName));
  const ordered = [...pages].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  for (const page of ordered) {
    if (!page.thumbnail?.source || OFF_TOPIC.test(fold(page.title))) continue;
    if (national && (!NATIONAL_TEAM_TITLE.test(page.title) || NOT_SENIOR_NATIONAL.test(page.title))) continue;

    const titleTokens = tokens(page.title);
    const related = wanted.some(w => titleTokens.some(t => t.startsWith(w) || w.startsWith(t)));
    if (wanted.length > 0 && !related) continue;

    return { title: page.title, url: cleanUrl(page.thumbnail.source) };
  }
  return null;
}
