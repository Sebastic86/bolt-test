/**
 * SoFIFA client — fetches pages of SoFIFA's team list through the
 * `sofifa-teams` Edge Function (admins only), because sofifa.com doesn't
 * allow cross-origin requests from the browser.
 */
import { supabase } from '../lib/supabaseClient';

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

export async function fetchSofifaTeamsPage(offset: number, roster?: string | null): Promise<SofifaPageResponse> {
  const { data, error } = await supabase.functions.invoke<SofifaPageResponse>('sofifa-teams', {
    body: { offset, roster: roster ?? undefined },
  });
  if (error) throw new Error(await describeFunctionError(error));
  if (!data) throw new Error('Empty response from the sofifa-teams Edge Function');
  return data;
}
