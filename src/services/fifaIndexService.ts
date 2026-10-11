/**
 * FIFA Index client — fetches pages of FIFA Index's team list through the
 * `fifaindex-teams` Edge Function (admins only), because fifaindex.com doesn't
 * allow cross-origin requests from the browser.
 */
import { supabase } from '../lib/supabaseClient';
import { SourcePage, SourceTeam, parseFifaIndexTeamsPage } from '../admin-tools/fifaIndexParser';
import { looseMatchKey } from '../utils/teamDataDiff';

const FUNCTION = 'fifaindex-teams';

export type FifaIndexCategory = 'clubs' | 'nations';

export interface FifaIndexPageResponse {
  /** FIFA Index's HTTP status; anything but 200 means it refused the request. */
  status: number;
  html: string;
}

/** Turns a failed Edge Function call into a message that says what to fix. */
async function describeFunctionError(error: unknown): Promise<string> {
  // FunctionsHttpError carries the HTTP response as `context` (duck-typed: the mock client has no error classes).
  const response = (error as { context?: unknown }).context;
  if (!(response instanceof Response)) return error instanceof Error ? error.message : String(error);

  const body = await response.json().catch(() => null);
  const detail: string = body?.error ?? body?.msg ?? body?.message ?? response.statusText;

  // The self-hosted edge runtime answers this for any function folder it can't find.
  if (/worker boot error|failed to read path|not found/i.test(detail) || response.status === 404) {
    return `The ${FUNCTION} Edge Function is not deployed on the Supabase server (HTTP ${response.status}: ${detail}) — merge to main and restart the Supabase service in Coolify.`;
  }
  if (response.status === 401 || response.status === 403) {
    return `The ${FUNCTION} Edge Function refused the request (HTTP ${response.status}: ${detail}) — sign in as an admin.`;
  }
  return `The ${FUNCTION} Edge Function failed (HTTP ${response.status}: ${detail}).`;
}

export const blockedMessage = (status: number) =>
  `FIFA Index answered HTTP ${status} — it is blocking the server's requests. Try again later.`;

export async function fetchFifaIndexPage(
  page: number,
  { category = 'clubs', q }: { category?: FifaIndexCategory; q?: string } = {}
): Promise<FifaIndexPageResponse> {
  const body: { page: number; category?: FifaIndexCategory; q?: string } = { page };
  if (category !== 'clubs') body.category = category;
  if (q) body.q = q;
  const { data, error } = await supabase.functions.invoke<FifaIndexPageResponse>(FUNCTION, { body });
  if (error) throw new Error(await describeFunctionError(error));
  if (!data) throw new Error(`Empty response from the ${FUNCTION} Edge Function`);
  return { status: data.status, html: data.html };
}

async function fetchParsed(page: number, options: { category?: FifaIndexCategory; q?: string }): Promise<SourcePage> {
  const response = await fetchFifaIndexPage(page, options);
  if (response.status !== 200) throw new Error(blockedMessage(response.status));
  return parseFifaIndexTeamsPage(response.html);
}

/**
 * Search terms for a team name, most specific first: FIFA Index searches
 * substrings of its own names, so "Arsenal FC" finds nothing but "arsenal" does.
 */
export function searchTermsFor(keyword: string): string[] {
  const exact = keyword.trim();
  const loose = looseMatchKey(exact);
  return [...new Set([exact, loose].filter(Boolean))];
}

/**
 * Looks a team up on FIFA Index for the current game version: clubs through
 * FIFA Index's own search, national teams (51 of them, two pages) by name here.
 */
export async function searchFifaIndexTeams(keyword: string): Promise<SourcePage> {
  const terms = searchTermsFor(keyword);
  const wanted = looseMatchKey(keyword);

  const searchClubs = async (): Promise<SourcePage> => {
    let last: SourcePage = { teams: [], rowCount: 0, version: null };
    for (const q of terms) {
      last = await fetchParsed(1, { q });
      if (last.teams.length > 0) return last;
    }
    return last;
  };
  const searchNations = async (): Promise<SourceTeam[]> => {
    const pages = await Promise.all([1, 2].map(page => fetchParsed(page, { category: 'nations' })));
    return pages.flatMap(p => p.teams).filter(t => wanted.length > 0 && looseMatchKey(t.name).includes(wanted));
  };

  const [clubs, nations] = await Promise.all([searchClubs(), searchNations()]);
  const teams = [...clubs.teams, ...nations];
  return { teams, rowCount: teams.length, version: clubs.version };
}
