# Project context

**EA FC Match Generator** (repo name `bolt-test`): a mobile-first web app for a group of friends who
play EA FC together. It picks random but fair matchups between real clubs, records results, and keeps
stats, standings and achievements per player and team. It is used mostly **on phones**, so design and
check UI at phone width first.

## Stack

- React 19 + TypeScript, Vite 6, Tailwind v4 (CSS-first `@theme` tokens in `src/index.css`)
- react-router 7, TanStack Query 5, lucide-react icons
- Supabase (auth, Postgres with RLS, realtime, storage, Edge Functions), **self-hosted on Coolify**
- Vitest for unit tests, Playwright for e2e
- Installable as a PWA (`public/manifest.webmanifest`, `public/sw.js`, which caches nothing on purpose)

## Features

- **Match generator** (Dashboard, `/`): filter teams by rating, FC version (FC27 is the default), and
  nations; generate a matchup with a reveal animation; save the score, including penalties.
  The weighting logic in `src/utils/matchupAlgorithm.ts` favors teams and pairings that were played
  less often or less recently. Admins can check a drawn team's ratings against FIFA Index from its card
  (`TeamDataCheckSheet`).
- **Scan the result**: in the score editor, "Scan result screen" takes a photo of the EA FC full-time screen and prefills the score and penalties winner (`src/utils/scanResult.ts` maps the in-game home/away order onto team1/team2). The user always checks and saves.
- **Stats**: player standings, head-to-head win matrix, top teams per player, team leaderboard,
  achievements and milestones (milestones show as toasts).
- **Game nights** (`/night`): a session of matches with a live table, jokers, "Who wins?" predictions
  with a leaderboard, a recap card, past nights, and deleting a night.
- **All matches** (`/matches`) and **Admin** (`/admin`): teams, players and avatars, users and roles,
  bulk team-data sync from FIFA Index, and logo resolution and migration tools.
- **Roles** (`user_profiles.role`): `admin` or `normal`. Normal users can add matches and edit their own.

## Code layout

| Path | What's there |
|------|--------------|
| `src/pages/` | Route pages (`App.tsx` defines the routes; `NightPage` is lazy-loaded) |
| `src/components/` | Feature components; `ui/` holds hand-rolled primitives (Button, Card, BottomSheet, Toast…); `night/`, `stats/`, `install/` group features |
| `src/queries/` | TanStack Query hooks per entity |
| `src/services/` | Supabase data access, FIFA Index team data, and crest providers (API-Sports via an Edge Function, TheSportsDB, Wikipedia) |
| `src/admin-tools/` | Admin tool logic: FIFA Index HTML parser, team-data update, logo resolution, storage migration |
| `src/utils/` | Pure logic (matchups, standings, nights, predictions, milestones…), mostly unit tested next to the source |
| `src/hooks/` | `useMatchGenerator`, realtime match sync, settings (localStorage `fcGenerator*` keys) |
| `src/contexts/AuthContext.tsx` | Session and role (`isAdmin`, `isNormalUser`) |
| `src/mock/` | In-browser fake Supabase used by mock mode |
| `src/assets/logos/` | Bundled club crests, used as a fallback for legacy `logoUrl` filenames |
| `supabase/migrations/` | SQL schema and RLS. Main tables: `teams`, `players`, `matches`, `match_players`, `user_profiles`, `game_nights`, `predictions`, `night_jokers` |
| `supabase/functions/` | Edge Functions: `api-sports-logo` keeps the API-Sports key server-side (`API_SPORTS_KEY` secret), and `fifaindex-teams` fetches FIFA Index list pages, which the browser can't do because of CORS (admins only). SoFIFA was dropped because it blocks visitors with a Cloudflare check. `scan-match-result` reads the final score off a photo of the full-time screen with Claude (`ANTHROPIC_API_KEY` secret, optional `SCAN_MODEL`) |

## Commands

```bash
npm run dev        # needs .env with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev:mock   # no Supabase or login needed: fake backend, seeded data, MOCK panel to switch roles
npm test           # Vitest
npm run e2e        # Playwright against mock mode at iPhone 13 size
npm run typecheck && npm run lint
npm run build      # type-checks first
```

See `docs/TESTING.md` for mock-mode details, such as `?mockRole=`, snapshots of real data, and what it does and doesn't emulate.

## Deployment and gotchas

- The app is deployed with the `Dockerfile` (Vite build served by nginx with an SPA fallback). `VITE_*` vars are build args.
- Supabase is self-hosted, with no linked CLI. **New migrations must be run by hand in Studio's SQL editor.**
  `supabase functions deploy` doesn't work: on each deploy, a helper container in the Coolify compose syncs the
  Edge Functions from GitHub `main`, so a new function has to be added to that sync list.
- The migrations have drifted from production in the past, so check the live schema and policies before relying on them.
- Mock mode emulates RLS and triggers but doesn't run the real SQL, so test SQL and policy changes against real Supabase.
- The visual design ("Scoreboard Mono / Turf Green") was ported from the sibling project `../gamenight`.
  When restyling, reuse that project's tokens and `ui/` primitives instead of inventing new styles.
  `docs/REDESIGN_PLAN.md` has the history and the open to-dos.
- The root-level `*_LOGO*.md`, `CORS_FIX.md`, `CONSOLE_COMMANDS.md` and `SUPABASE_STORAGE_SETUP.md` files describe the
  older pre-redesign app and are mostly stale. Treat the code as the source of truth.

## Conventions

- Work happens on `feature/*` branches with PRs to `main`, and commits use Conventional Commits (`feat(nights): …`, `fix: …`).
- Keep logic pure in `src/utils/` with a `*.test.ts` next to it; components stay thin.
- UI must work on mobile: a single `max-w-md` column, bottom nav, bottom sheets, tap targets of at least 40px,
  safe-area insets, and 16px inputs so iOS doesn't zoom on focus.
