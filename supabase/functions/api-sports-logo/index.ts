// Server-side proxy for API-Sports logo lookups, so the API key never reaches the browser.
//
// POST { teamId }   → any user with a role; returns teams.resolvedLogoUrl, resolving and
//                     saving it on first request (so each team costs at most one API call).
// POST { teamName } → admins only; raw search, nothing is saved.
//
// Secrets: API_SPORTS_KEY (plus SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY,
// which the edge runtime provides).
import { createClient } from 'npm:@supabase/supabase-js@2';

const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';

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

async function searchApiSports(teamName: string, apiKey: string): Promise<string | null> {
  const response = await fetch(
    `${API_SPORTS_BASE_URL}/teams?search=${encodeURIComponent(teamName)}`,
    { headers: { 'x-apisports-key': apiKey } },
  );
  if (!response.ok) throw new Error(`API-Sports request failed: ${response.status}`);

  const data = await response.json();
  const errors = Array.isArray(data.errors) ? data.errors : Object.values(data.errors ?? {});
  if (errors.length > 0) throw new Error(`API-Sports error: ${JSON.stringify(data.errors)}`);

  return data.response?.[0]?.team?.logo ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('API_SPORTS_KEY');
  if (!apiKey) return json({ error: 'API_SPORTS_KEY is not configured' }, 500);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Not authenticated' }, 401);

  const { data: hasProfile } = await userClient.rpc('has_profile');
  if (!hasProfile) return json({ error: 'Forbidden' }, 403);

  let body: { teamId?: string; teamName?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  try {
    if (body.teamId) {
      const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data: team, error } = await admin
        .from('teams')
        .select('id, name, "apiTeamName", "resolvedLogoUrl"')
        .eq('id', body.teamId)
        .single();
      if (error || !team) return json({ error: 'Team not found' }, 404);

      if (team.resolvedLogoUrl) return json({ logoUrl: team.resolvedLogoUrl });

      const logoUrl = await searchApiSports(team.apiTeamName || team.name, apiKey);
      if (logoUrl) {
        await admin.from('teams').update({ resolvedLogoUrl: logoUrl }).eq('id', team.id);
      }
      return json({ logoUrl });
    }

    if (body.teamName) {
      const { data: isAdmin } = await userClient.rpc('is_admin');
      if (!isAdmin) return json({ error: 'Forbidden' }, 403);
      return json({ logoUrl: await searchApiSports(body.teamName, apiKey) });
    }

    return json({ error: 'Provide teamId or teamName' }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 502);
  }
});
