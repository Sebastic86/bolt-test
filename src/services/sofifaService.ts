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

export async function fetchSofifaTeamsPage(offset: number, roster?: string | null): Promise<SofifaPageResponse> {
  const { data, error } = await supabase.functions.invoke<SofifaPageResponse>('sofifa-teams', {
    body: { offset, roster: roster ?? undefined },
  });
  if (error) throw error;
  if (!data) throw new Error('Empty response from the sofifa-teams Edge Function');
  return data;
}
