// Server-side fetch of FIFA Index's team list for the admin team data tools.
// The browser can't fetch fifaindex.com itself (CORS), so this returns the raw HTML of
// one list page and the app parses it (src/admin-tools/fifaIndexParser.ts).
// Replaces `sofifa-teams`: SoFIFA now shows every visitor a Cloudflare "I'm not a robot" check.
//
// POST { page?, category?, q? } → admins only; { status, html, q }.
//   page:     1-based list page (50 teams per page).
//   category: 'clubs' (default) or 'nations' (men's national teams).
//   q:        team name search (single-team check on the dashboard). Echoed back.
//
// The URL is built here from a fixed base, so this is not an open proxy.
// No secrets needed (uses the SUPABASE_URL / SUPABASE_ANON_KEY the edge runtime provides).
//
// Deploy (self-hosted Supabase on Coolify): the `supabase-functions-sync` service downloads this
// file from GitHub `main` on every deploy — merge, then restart the Supabase service.
import { createClient } from 'npm:@supabase/supabase-js@2';

const FIFAINDEX_TEAMS_URL = 'https://fifaindex.com/teams';
const MAX_PAGE = 40;

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

  let body: { page?: number; category?: string; q?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const page = Number(body.page ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE) {
    return json({ error: `page must be a whole number between 1 and ${MAX_PAGE}` }, 400);
  }
  const category = body.category ?? 'clubs';
  if (category !== 'clubs' && category !== 'nations') return json({ error: "category must be 'clubs' or 'nations'" }, 400);
  const q = typeof body.q === 'string' ? body.q.trim() : null;
  if (q !== null && (q.length === 0 || q.length > 60)) return json({ error: 'q must be 1-60 characters' }, 400);

  const params = new URLSearchParams();
  if (category === 'nations') params.set('category', 'men');
  if (q) params.set('q', q);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  const url = query ? `${FIFAINDEX_TEAMS_URL}?${query}` : FIFAINDEX_TEAMS_URL;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    // Pass FIFA Index's status through so the app can tell "the site blocked us" apart from a bug.
    return json({ status: response.status, html: response.ok ? await response.text() : '', q });
  } catch (err) {
    return json({ error: `Could not reach FIFA Index: ${err instanceof Error ? err.message : 'unknown error'}` }, 502);
  }
});
