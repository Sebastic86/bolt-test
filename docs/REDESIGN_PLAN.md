# Redesign & Hardening — Status (2026-10-02)

Branch: `redesign/gamenight-port` (uncommitted). Target: **mobile-first** — the app is used mainly on phones.

## Done
- **Security (code)**: `supabase/migrations/20261002090000_security_hardening.sql` (drops `create_admin_profile`,
  admin-only player/storage writes, match writes require a role, pinned `search_path`);
  `supabase/functions/api-sports-logo` Edge Function — API-Sports key no longer in the browser bundle.
- **Port of gamenight** (design + router + TanStack Query + 76 tests) replacing `src/`; typecheck clean,
  lint 0 errors, `build` now type-checks first. Dockerfile + `docker/nginx.conf` (SPA fallback) added.
- **Mobile fixes on top of gamenight**: viewport-height shell so header/bottom nav stay on screen,
  `viewport-fit=cover` (safe-area insets actually apply on iOS), 16px inputs (no iOS focus zoom),
  theme-color, focus ring on inputs.
- **Parity fixes**: "Save & Next" no longer re-picks the teams just saved; "Save & Rematch" keeps line-ups;
  settings keep the old `fcGenerator*` localStorage keys; duplicate-name error on rename;
  bundled crest fallback for legacy `logoUrl` filenames; link to All Matches.

## Needs you (can't be done from here — self-hosted Supabase)
1. Run the hardening SQL in Studio → SQL editor.
2. Deploy `supabase/functions/api-sports-logo` to the Coolify edge-functions volume; set `API_SPORTS_KEY`.
3. Rotate the API-Sports key (the old one shipped in the public bundle).
4. Disable public sign-up (`GOTRUE_DISABLE_SIGNUP=true`) — the app has no sign-up UI.
5. Check `user_profiles` for unexpected admins.
6. Deploy with an SPA fallback (Dockerfile/nginx provided) so `/admin` and `/matches` survive refresh.

## Remaining gaps vs. old app (not yet restored)
- Version filter on Overall standings and Head-to-Head; H2H shows a pair list instead of the N×N matrix.
- Win/Loss result badges in team/player match-detail sheets.
- Player avatars in match lists/standings (gamenight shows initials); crests in match lists are initials badges.
- Filter warning banners ("only N teams match", "all teams played today").
- TeamCard +/- stat differences; MatchComparison bar animation.
- Admin **Dev Tools** tab (logo resolve/migrate scripts). 147 teams have neither a resolved URL nor a bundled crest.

## Next
- Phase 4/5 from the original plan below: bundle splitting (660 kB main chunk), toasts instead of `alert()`,
  focus trap in BottomSheet, `prefers-reduced-motion`, README rewrite, remove stale logo docs.

---

# Redesign & Hardening Plan — "Scoreboard Mono / Turf Green"

Source design: `C:\Users\SebastienWouters\IdeaProjects\gamenight` (a mobile-first rebuild of this same app:
React 19 + Tailwind v4 + react-router 7 + TanStack Query 5 + hand-rolled `src/components/ui/*`).

Both projects already share React 19, Vite 6, Tailwind v4 (CSS-first `@theme`) and lucide-react, so the
design can be ported file-for-file without a config migration.

Phases are ordered by risk: security first, then the foundation the redesign needs, then visuals, then cleanup.
Each phase should land as its own PR and leave the app working.

---

## Phase 0 — Security fixes (do first, independent of the redesign)

Verify each item against the **live** Supabase project first (the migrations have drifted from prod).

| # | Issue | Fix |
|---|-------|-----|
| 0.1 | `create_admin_profile(user_email)` is `SECURITY DEFINER` with no admin check (`supabase/migrations/create_initial_admin_user.sql:16-35`) → likely any user can make themselves admin via RPC | `DROP FUNCTION` (or add `is_admin()` guard + `REVOKE EXECUTE ... FROM public, anon, authenticated`) |
| 0.2 | API-Sports key shipped in the JS bundle (`VITE_API_SPORTS_KEY`, `services/apiSportsService.ts:12`) | Move API-Sports calls into a Supabase Edge Function (admin-only); rotate the key |
| 0.3 | `players` UPDATE policy `USING(true)` for all authenticated users (`allow_avatar_updates.sql`, `allow_player_updates.sql`) | Drop it; admin-only update (or a narrow avatar-only path via RPC) |
| 0.4 | Any authenticated user can overwrite/delete any object in `avatars` bucket | Restrict write/delete to admins (or path-scoped ownership) |
| 0.5 | `is_admin()` / `admin_list_users()` lack `SET search_path` | Add `SET search_path = public` |
| 0.6 | Migration does `ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY` | Remove from migration |

## Phase 1 — Supabase baseline & tooling

1. **Re-baseline migrations**: `supabase db pull` from prod into a single timestamped baseline migration; delete
   the 20 unordered scripts (one is wrapped in Markdown fences, `seed_initial_teams.sql` uses an `ON CONFLICT (name)`
   with no unique constraint). Add `team-logos` bucket + its policies to migrations. Add `supabase/config.toml`.
2. **Generated types**: `supabase gen types typescript` → replace hand-written `Database` in `lib/supabaseClient.ts`.
3. **Tooling**: add `typecheck` script, make `build` = `tsc -b && vite build`; fix the 32 tsc + 50 lint errors
   (incl. real bugs: missing `AllMatches` import `App.tsx:431`, rules-of-hooks in `UserManagement.tsx:73`).
   Add `eslint-plugin-jsx-a11y`. Rename package from `vite-react-typescript-starter`.
4. **Vitest** + tests for pure logic: `standingsUtils`, `achievementUtils`, `useMatchGenerator` weighting,
   win/loss %.

## Phase 2 — App architecture (adopt gamenight's structure)

The design relies on gamenight's shell (routes + outlet context + bottom sheets), so this lands before visuals.

1. **react-router 7**: replace `useState<'main'|'allMatches'|'admin'>` with routes `/`, `/matches`, `/admin`
   (deep links, back button, fixes the unreachable/broken All Matches page). `AppLayout` with `<Outlet/>`.
2. **TanStack Query**: `useTeams`, `usePlayers`, `useMatches`, `useVersions` query hooks; mutations for
   score edit / delete / player moves with invalidation. Removes `triggerRefresh` double-fetch, the 7 duplicate
   `select('version')` queries, and direct Supabase calls in ~8 components. Realtime → `invalidateQueries`
   (also subscribe to `match_players`).
3. **Data correctness**:
   - Fetch matches with embedded `match_players` (`select('*, match_players(*)')`) instead of a giant `.in()`
     list — fixes silent 1000-row truncation that would corrupt standings.
   - Derive "today" from `allMatches` (drop the second query); use local-date grouping in `GameSessions`
     (currently UTC).
   - Throw/detect RLS no-op updates (`.select()` after update, check row count) and only show Edit/Delete to
     owner/admin (`MatchHistory.tsx:306`, `AllMatches.tsx:297`).
4. **Auth fixes** (`AuthContext`/`AuthWrapper`): separate `isInitializing` from sign-in pending so login errors
   display; don't flip `isLoading=false` until the profile is loaded (removes "Account Setup Required" flash);
   stop logging user/email.
5. **Split god components**: `App.tsx` (503) → `DashboardPage`; merge `MatchHistory` + `AllMatches` (~85% identical)
   into one `MatchList` with a `scope` prop; merge `TopWin/TopLossPercentageTeams` into `TeamWinRateList`;
   extract `PlayerAchievements` modals; split `SettingsModal` (filters vs admin player management) and move the
   latter into `/admin`.

## Phase 3 — Design system port

1. **Tokens** — replace `src/index.css` with gamenight's: `--color-ink #111`, `--color-green-bright #22c55e`,
   `--color-green-mid #16a34a`, `--color-green-deep #14532d`, radius scale flattened to 0 (keep `--radius-full`),
   `.shadow-hard`, `sheet-up` / `reveal-land` / `reveal-glow` keyframes, `.bottom-nav` safe area.
   Drop `brand-*` colours, the gradient background (`#fafafa` page bg instead), the duplicate `<link>` to
   `index.css` in `index.html`, and the redundant PostCSS Tailwind plugin. Add `prefers-reduced-motion` overrides.
2. **UI primitives** — copy `src/components/ui/`: `Button` (primary/secondary/outline), `Card` (`hard`),
   `Input`, `Select`, `Switch`, `BottomSheet` (portal, Esc, focus return), `LoadingState`, `ErrorState`.
   Extend `BottomSheet` with a focus trap and `role="dialog" aria-modal`.
3. **Shell** — `Header` (ink bar, 3px green stripe, square green avatar menu with `aria-expanded`),
   `BottomNav` always visible (mobile-first, `max-w-md` column on all viewports), `AppLayout`.
   Replace the Volleyball icon with a football-appropriate one; unify title ("EA FC Random Match Generator")
   across `index.html` and header; add a real favicon.
4. **Feature components** — restyle to the scoreboard look: `TeamCard` (hard card, OVR pill, tier chips via
   `ratingTier.ts`), VS divider, `MatchComparison` bars, `MatchRevealAnimation` (also fix the leaked
   `slowInterval` timers), `MatchList` scoreboard rows, `PlayerStandings` (segmented tabs, rank squares, stacked
   cards instead of tables), `PlayerWinMatrix` (win % colour scale), `CollapsibleSection`, `TeamBadge`
   (hash-coloured initials) + `TeamLogo` fallback (fixes broken `onError` sibling lookup), `PlayerBadge`,
   `LoginForm`, `ErrorBoundary`.
5. **All 8+ modals → `BottomSheet`** — also fixes Tailwind v4 breakage (`bg-opacity-*` renders solid black
   backdrops; `hover:bg-brand-darker` is undefined; `focus:ring-opacity-50` no-ops).
6. **Feedback** — replace `alert()`/`confirm()` with a small ink/green toast + a confirm sheet (gamenight still
   uses `alert`; this is an improvement over the source design).

## Phase 4 — Cleanup & performance

- Lazy-load `/admin` and exclude `DevToolsPanel` + `scripts/*` from the production bundle (`import.meta.env.DEV`
  or move to a Node script).
- Stop bundling 406 local logos (12 MB): logos come from Storage/`resolvedLogoUrl`; remove the dynamic
  `new URL('../assets/logos/…')` fallback (`logoService.ts:316`, `logoUtils.ts`) once Storage migration is done.
- Logo resolution: only admins/the Edge Function write `resolvedLogoUrl`; clients read only (stops burning the
  100/day API quota from non-admin clients). Pass `id`/`resolvedLogoUrl` through match lists for consistent logos.
- Avatar update without `window.location.reload()`; delete old avatar files.
- Remove dead code (`data/teams.ts`, `logoUtils`, `getTeamLogoSync`, `ConditionalButton`, `NormalUserOnly`,
  `preloadTeamLogos`), the 189 `console.*` calls (keep a tiny dev-only logger), stale `.env.example` CORS vars.
- Consistent version filter (`PlayerAchievements.tsx:345` uses OR, everything else AND).
- Accessibility: keyboard-operable clickable rows → buttons, `aria-label` on icon buttons, unique ids.
- Friendly error screen when env vars are missing (instead of import-time throw → blank page).

## Phase 5 — Docs

- Real `README.md` (setup, env vars, Supabase setup, roles, deploy).
- Consolidate the 7 logo `.md` docs into `docs/logos.md`; delete stale ones (`CORS_FIX.md`).
- Update in-app User Management help text (no sign-up UI; normal users can add matches).

---

## Suggested PR sequence

1. Phase 0 (SQL + edge function) — urgent
2. Phase 1 tooling + lint/tsc to zero
3. Router + AppLayout (old styles still)
4. TanStack Query + data fixes + auth fixes
5. Design tokens + `ui/` primitives + shell
6. Feature component restyle (dashboard → match lists → stats → admin)
7. Cleanup/perf, docs

## Open decisions

- **Desktop layout**: gamenight is a single `max-w-md` column everywhere. Keep that, or add a wider 2-column
  dashboard at `lg:`? (Plan assumes gamenight's single column.)
- **Dark mode**: neither project has it; out of scope unless wanted.
- **Normal-user permissions**: confirm intended rules (add matches + edit/delete own; players/teams admin-only).
