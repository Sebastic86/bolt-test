// Server-side fetch of SoFIFA's team list for the admin "Update team data" tool.
// The browser can't fetch sofifa.com itself (CORS), so this returns the raw HTML of
// one list page and the app parses it (src/admin-tools/sofifaParser.ts).
//
// POST { offset, roster? } → admins only; { status, html }.
//   offset: row offset, a multiple of 60 (SoFIFA's page size).
//   roster: SoFIFA roster id (e.g. 270003) to pin every page to the same roster
//           update; omit to get the latest one.
//
// The URL is built here from a fixed base, so this is not an open proxy.
// No secrets needed (uses the SUPABASE_URL / SUPABASE_ANON_KEY the edge runtime provides).
import { createClient } from 'npm:@supabase/supabase-js@2';

const SOFIFA_TEAMS_URL = 'https://sofifa.com/teams?type=all&oal=50&hl=en-US';
const PAGE_SIZE = 60;
const MAX_OFFSET = 60 * 50;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Not authenticated' }, 401);

  const { data: isAdmin } = await userClient.rpc('is_admin');
  if (!isAdmin) return json({ error: 'Forbidden' }, 403);

  let body: { offset?: number; roster?: string | number };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const offset = Number(body.offset ?? 0);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET || offset % PAGE_SIZE !== 0) {
    return json({ error: `offset must be a multiple of ${PAGE_SIZE} between 0 and ${MAX_OFFSET}` }, 400);
  }
  const roster = body.roster == null ? null : String(body.roster);
  if (roster !== null && !/^\d{5,7}$/.test(roster)) return json({ error: 'roster must be a SoFIFA roster id' }, 400);

  // `set=true` makes SoFIFA honour `r` for this request (without it, it serves the latest roster).
  const url = `${SOFIFA_TEAMS_URL}&offset=${offset}${roster ? `&r=${roster}&set=true` : ''}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    // Pass SoFIFA's status through so the tool can tell "SoFIFA blocked us" apart from a bug.
    return json({ status: response.status, html: response.ok ? await response.text() : '' });
  } catch (err) {
    return json({ error: `Could not reach SoFIFA: ${err instanceof Error ? err.message : 'unknown error'}` }, 502);
  }
});
