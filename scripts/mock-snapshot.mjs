// Copies the real teams / players / matches into src/mock/seed.local.json
// (git-ignored) so mock mode runs on real data. Read-only: uses the public
// anon key from .env, exactly what the browser app reads.
//
//   npm run mock:snapshot      then      npm run dev:mock  (Reset data in the MOCK panel to reseed)
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter(line => line.includes('=') && !line.trim().startsWith('#'))
    .map(line => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
);

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing in .env');
  process.exit(1);
}

async function fetchAll(table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` },
    });
    if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

const snapshot = {};
for (const table of ['teams', 'players', 'matches', 'match_players']) {
  snapshot[table] = await fetchAll(table);
  console.log(`${table}: ${snapshot[table].length}`);
}

writeFileSync(new URL('../src/mock/seed.local.json', import.meta.url), JSON.stringify(snapshot));
console.log('Wrote src/mock/seed.local.json — use "Reset data" in the MOCK panel to load it.');
