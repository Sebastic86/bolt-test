// Reads the final score off a photo of the EA FC full-time / match-facts screen with a
// vision model (Claude), so nobody has to type it in. The app always shows the reading in
// the score editor for a human to check before saving — nothing is written here.
//
// POST { image, mediaType, teams? } → any user with a role; returns { reading }.
//   image:     base64 image data, without a data: prefix (the app downsizes to ~1600px JPEG).
//   mediaType: 'image/jpeg' | 'image/png' | 'image/webp'.
//   teams:     the two team names of the match, as a hint for the model.
//
// The photo is sent to the Anthropic API and not stored anywhere.
//
// Secrets: ANTHROPIC_API_KEY (required); SCAN_MODEL (optional, default claude-haiku-5-5).
// SUPABASE_URL / SUPABASE_ANON_KEY are provided by the edge runtime.
//
// Deploy (self-hosted Supabase on Coolify): add `scan-match-result` to the function list of the
// `supabase-functions-sync` service, set the secret on the functions service, merge to main,
// then restart the Supabase service.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-5-5';
const MAX_IMAGE_BASE64_LENGTH = 5_000_000; // ~3.7 MB decoded; the app sends far less.
const MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

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

const nullableInt = { type: ['integer', 'null'], minimum: 0, maximum: 30 };

// Forced tool call = reliable structured output.
const REPORT_TOOL = {
  name: 'report_result',
  description: 'Report the final result shown on the EA SPORTS FC screen in the photo.',
  input_schema: {
    type: 'object',
    properties: {
      found: { type: 'boolean', description: 'True only if a final score of a football match is clearly visible.' },
      home_team: { type: ['string', 'null'], description: 'Team name shown on the LEFT / home side, as written on screen.' },
      away_team: { type: ['string', 'null'], description: 'Team name shown on the RIGHT / away side, as written on screen.' },
      home_score: { ...nullableInt, description: 'Goals of the left/home team (regular + extra time, without penalties).' },
      away_score: { ...nullableInt, description: 'Goals of the right/away team (regular + extra time, without penalties).' },
      home_penalties: { ...nullableInt, description: 'Penalty shoot-out goals of the left/home team, if a shoot-out is shown; else null.' },
      away_penalties: { ...nullableInt, description: 'Penalty shoot-out goals of the right/away team, if a shoot-out is shown; else null.' },
    },
    required: ['found', 'home_team', 'away_team', 'home_score', 'away_score', 'home_penalties', 'away_penalties'],
  },
};

function buildPrompt(teams: string[]): string {
  const hint = teams.length === 2
    ? `The match was ${teams[0]} vs ${teams[1]}, but the screen may show them in either order and with short names (e.g. "Man City", "PSG").`
    : '';
  return [
    'This is a phone photo of a TV showing EA SPORTS FC at the end of a match (full-time, match facts or result screen).',
    'Read the final score. Team names and scores on screen are ordered left (home) to right (away); report them in that order.',
    'A penalty shoot-out is usually shown in brackets or smaller next to the score, e.g. "1 - 1 (4 - 3)" or "PENS 4 - 3".',
    'Ignore the in-match clock, possession, shots and other stats. If no final score is clearly readable, set found to false and the other fields to null.',
    hint,
  ].filter(Boolean).join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY is not configured' }, 500);

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Not authenticated' }, 401);
  const { data: hasProfile } = await userClient.rpc('has_profile');
  if (!hasProfile) return json({ error: 'Forbidden' }, 403);

  let body: { image?: unknown; mediaType?: unknown; teams?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { image, mediaType } = body;
  if (typeof image !== 'string' || image.length === 0 || image.length > MAX_IMAGE_BASE64_LENGTH || !/^[A-Za-z0-9+/=]+$/.test(image)) {
    return json({ error: 'image must be base64 data under ~3.7 MB' }, 400);
  }
  if (typeof mediaType !== 'string' || !MEDIA_TYPES.has(mediaType)) {
    return json({ error: 'mediaType must be image/jpeg, image/png or image/webp' }, 400);
  }
  const teams = Array.isArray(body.teams)
    ? body.teams.filter((t): t is string => typeof t === 'string' && t.length > 0 && t.length <= 80).slice(0, 2)
    : [];

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('SCAN_MODEL') || DEFAULT_MODEL,
        max_tokens: 400,
        tools: [REPORT_TOOL],
        tool_choice: { type: 'tool', name: REPORT_TOOL.name },
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: buildPrompt(teams) },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('[scan-match-result] Anthropic API error', response.status, detail.slice(0, 500));
      return json({ error: `Vision model request failed (${response.status})` }, 502);
    }

    const data = await response.json();
    const toolUse = Array.isArray(data.content)
      ? data.content.find((block: { type?: string; name?: string }) => block.type === 'tool_use' && block.name === REPORT_TOOL.name)
      : null;
    if (!toolUse?.input) return json({ error: 'The model returned no reading' }, 502);

    return json({ reading: toolUse.input });
  } catch (err) {
    return json({ error: `Could not reach the vision model: ${err instanceof Error ? err.message : 'unknown error'}` }, 502);
  }
});
