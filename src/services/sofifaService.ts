/**
 * SoFIFA client — fetches pages of SoFIFA's team list through the
 * `sofifa-teams` Edge Function (admins only), because sofifa.com doesn't
 * allow cross-origin requests from the browser.
 */
import { supabase } from '../lib/supabaseClient';
import { SofifaPage, parseSofifaTeamsPage } from '../admin-tools/sofifaParser';

export interface SofifaPageResponse {
  /** SoFIFA's HTTP status; anything but 200 means SoFIFA refused the request. */
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
    return `The sofifa-teams Edge Function is not deployed on the Supabase server (HTTP ${response.status}: ${detail}).`;
  }
  if (response.status === 401 || response.status === 403) {
    return `The sofifa-teams Edge Function refused the request (HTTP ${response.status}: ${detail}) — sign in as an admin.`;
  }
  return `The sofifa-teams Edge Function failed (HTTP ${response.status}: ${detail}).`;
}

async function invokeSofifaTeams(body: { offset: number; roster?: string; keyword?: string }) {
  const { data, error } = await supabase.functions.invoke<SofifaPageResponse & { keyword?: string | null }>('sofifa-teams', { body });
  if (error) throw new Error(await describeFunctionError(error));
  if (!data) throw new Error('Empty response from the sofifa-teams Edge Function');
  return data;
}

export async function fetchSofifaTeamsPage(offset: number, roster?: string | null): Promise<SofifaPageResponse> {
  return invokeSofifaTeams({ offset, roster: roster ?? undefined });
}

/**
 * SoFIFA's team search (accent-insensitive, partial names match) for the
 * current game version's latest roster update — one request.
 */
export async function searchSofifaTeams(keyword: string): Promise<SofifaPage> {
  const data = await invokeSofifaTeams({ offset: 0, keyword: keyword.trim() });
  // An older deployment ignores `keyword` and returns the top 60 teams instead — that would look
  // like a valid but wrong result, so refuse it.
  if (data.keyword !== keyword.trim()) {
    throw new Error('The sofifa-teams Edge Function on the server is outdated — restart the Supabase service in Coolify so it syncs from main.');
  }
  if (data.status !== 200) throw new Error(`SoFIFA answered HTTP ${data.status} — it is blocking the server's requests. Try again later.`);
  return parseSofifaTeamsPage(data.html);
}
