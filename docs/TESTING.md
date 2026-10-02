# Testing without Supabase or a login

## Mock mode — `npm run dev:mock`

Runs the app against an in-browser fake Supabase (`src/mock/`), already signed in.
Production builds never include it (it is swapped in by `vite --mode mock` only).

- **Data**: 4 fictional players, FC26 + FC27 teams, six past FC26 nights. Stored in
  localStorage, so it survives reloads.
- **Real data instead**: `npm run mock:snapshot` copies teams/players/matches from the
  real database (read-only, anon key) into `src/mock/seed.local.json` (git-ignored);
  then use **Reset data** in the MOCK panel.
- **MOCK panel** (yellow tab on the left): switch role for this tab — Admin, Player,
  No role, Signed out — open a second tab as a player, or reset data.
  URL shortcut: `?mockRole=admin|normal|none|out`. Slow network: `?mockLatency=800`.
- **Two phones**: open two tabs. Writes sync between tabs like realtime does.
- **Emulated server behaviour**: unique constraints, FK cascades, RLS (blocked inserts
  error, blocked updates silently change nothing), the match-nights triggers
  (match → active night, predictions → saved match), `admin_list_users`,
  storage uploads (kept as data URLs). The `api-sports-logo` function returns no logo;
  TheSportsDB lookups still go to the internet.

Not emulated: real Postgres SQL, policies as written in the migrations, Edge Function
code. Check those against a real Supabase before deploying.

## End-to-end tests — `npm run e2e`

Playwright drives mock mode at iPhone 13 size (`e2e/`). Screenshots of every step land
in `e2e/screenshots/` (git-ignored). `npm run e2e:ui` opens the interactive runner.
First run: `npx playwright install chromium`.

## Unit tests — `npm test`

Vitest for the pure logic in `src/utils` and a few components.
