import { Team } from '../types';
import { fetchAllTeams, searchTeams, updateTeam } from '../services/teamService';
import { fetchTeamLogoFromApiSports, resolveTeamLogoFromApiSports } from '../services/apiSportsService';
import { fetchTeamLogoByIdFromTheSportsDb, fetchTeamLogoByNameFromTheSportsDb } from '../services/theSportsDbService';
import { fetchTeamLogoFromWikipedia } from '../services/wikipediaLogoService';
import { RateLimitError } from '../services/rateLimitError';
import { buildWikipediaSearch } from '../utils/wikipediaCrest';
import { clearLogoCache, getBundledLogoUrl } from '../services/logoService';
import { isLogoInStorage } from '../services/logoStorageService';
import { fetchMatchTeamIds } from '../services/matchService';
import { ALL_VERSIONS } from '../utils/versionFilter';
import { normalizeTeamName } from '../utils/normalizeTeamName';
import { LogoCandidateFilter, countTeamUsage, matchesLogoFilter, prioritizeByUsage } from '../utils/logoCandidates';
import { RunStats, ToolContext, delay, emptyStats, errorMessage, summarize } from './toolContext';

export interface ResolveAllOptions extends LogoCandidateFilter {
  /** Re-resolve teams that already have an external resolvedLogoUrl. */
  force?: boolean;
  /** Use API-Sports as the last resort (via the api-sports-logo Edge Function; 100 requests/day). */
  useApiSports?: boolean;
  /** Pause between teams — Wikipedia throttles bursts, ~1 request/s is safe. */
  delayMs?: number;
  /** Hard cap on API-Sports calls per run (free-tier quota is 100/day). */
  maxApiSportsCalls?: number;
  /** Stop using API-Sports after this many misses in a row (quota exhausted / key problem). */
  maxConsecutiveApiMisses?: number;
}

/** TheSportsDB's free key allows ~30 requests/min and a name lookup can take 2 — keep calls 4s apart. */
const THESPORTSDB_SPACING_MS = 4000;

/** A free source that can be rate limited: waits once when it answers 429, then is skipped for the run. */
interface ThrottledSource {
  name: string;
  enabled: boolean;
  /** Minimum time between calls. */
  spacingMs: number;
  lastCallAt: number;
}

async function callSource<T>(ctx: ToolContext, source: ThrottledSource, lookup: () => Promise<T | null>): Promise<T | null> {
  for (let attempt = 0; source.enabled && !ctx.signal.aborted; attempt++) {
    const wait = source.lastCallAt + source.spacingMs - Date.now();
    if (wait > 0) await delay(wait, ctx.signal);
    if (ctx.signal.aborted) return null;
    source.lastCallAt = Date.now();
    try {
      return await lookup();
    } catch (error) {
      if (!(error instanceof RateLimitError)) throw error;
      if (attempt > 0) {
        source.enabled = false;
        ctx.log('warn', `${source.name} is still rate limiting — skipping it for the rest of this run.`);
        return null;
      }
      const seconds = Math.min(error.retryAfterSeconds ?? 60, 120);
      ctx.log('warn', `${source.name} rate limit hit — waiting ${seconds}s…`);
      await delay(seconds * 1000, ctx.signal);
    }
  }
  return null;
}

/**
 * Resolves crests for every team matching the version / minimum-star filter
 * and saves them to teams.resolvedLogoUrl. Sources, cheapest first:
 *
 *   1. Wikipedia — free, no key; the crest of the club / national-team article
 *   2. TheSportsDB — free key, by id then name (throttled to its ~30/min limit)
 *   3. API-Sports — via the Edge Function, 100 requests/day, so last
 *
 * Most-played teams go first. A rate limit (429) is waited out once and then
 * that source is skipped for the run — it never counts as "no logo found".
 *
 * Force mode re-resolves external URLs too, but never touches teams whose
 * crest is already hosted in our Supabase Storage (that would undo the
 * storage migration). If nothing is found, the previous URL is restored.
 */
export async function resolveAllTeamLogos(ctx: ToolContext, options: ResolveAllOptions = {}): Promise<RunStats> {
  const {
    force = false,
    useApiSports = true,
    delayMs = 1000,
    maxApiSportsCalls = 100,
    maxConsecutiveApiMisses = 5,
    version,
    minRating = 0,
  } = options;

  const [allTeams, matchTeamIds] = await Promise.all([fetchAllTeams(), fetchMatchTeamIds()]);
  const teams = allTeams.filter(t => matchesLogoFilter(t, { version, minRating }));
  const usage = countTeamUsage(matchTeamIds);
  const candidates = prioritizeByUsage(
    teams.filter(t => (force ? !isLogoInStorage(t.resolvedLogoUrl) : !t.resolvedLogoUrl)),
    usage
  );
  const stats = emptyStats(teams.length);
  stats.skipped = teams.length - candidates.length;

  const versionLabel = version && version !== ALL_VERSIONS ? version : 'all versions';
  const ratingLabel = minRating > 0 ? `≥ ${minRating}★` : 'any rating';
  const played = candidates.filter(t => usage.has(t.id)).length;
  ctx.log('info', `${teams.length} team(s) in scope (${versionLabel}, ${ratingLabel}).`);
  ctx.log('info', `${candidates.length} team(s) to resolve (${played} played before — most-played first), ${stats.skipped} skipped (${force ? 'already in storage' : 'already resolved'}).`);
  ctx.log('info', `Sources: Wikipedia → TheSportsDB${useApiSports ? ` → API-Sports (max ${maxApiSportsCalls} calls)` : ''}.`);

  const wikipedia: ThrottledSource = { name: 'Wikipedia', enabled: true, spacingMs: 0, lastCallAt: 0 };
  const theSportsDb: ThrottledSource = { name: 'TheSportsDB', enabled: true, spacingMs: THESPORTSDB_SPACING_MS, lastCallAt: 0 };
  const foundVia: Record<string, number> = {};
  let apiSportsEnabled = useApiSports;
  let apiCalls = 0;
  let consecutiveMisses = 0;

  for (let i = 0; i < candidates.length; i++) {
    if (ctx.signal.aborted) {
      stats.cancelled = true;
      break;
    }
    const team = candidates[i];
    ctx.progress(i, candidates.length, team.name);
    const previous = team.resolvedLogoUrl ?? null;

    try {
      let url: string | null = null;
      let source = '';
      let detail = '';

      try {
        const crest = await callSource(ctx, wikipedia, () =>
          fetchTeamLogoFromWikipedia(team.name, team.league, { signal: ctx.signal })
        );
        if (crest) {
          url = crest.url;
          source = 'Wikipedia';
          detail = ` (${crest.title})`;
        }
      } catch (error) {
        if (!ctx.signal.aborted) ctx.log('warn', `${team.name} — Wikipedia: ${errorMessage(error)}`);
      }

      const apiTeamId = team.apiTeamId;
      if (!url && apiTeamId) {
        url = await callSource(ctx, theSportsDb, () => fetchTeamLogoByIdFromTheSportsDb(apiTeamId, { throwOnRateLimit: true }));
        if (url) source = 'TheSportsDB';
      }
      if (!url) {
        url = await callSource(ctx, theSportsDb, () =>
          fetchTeamLogoByNameFromTheSportsDb(team.apiTeamName || team.name, { throwOnRateLimit: true })
        );
        if (url) source = 'TheSportsDB';
      }

      if (!url && apiSportsEnabled && !ctx.signal.aborted) {
        // The Edge Function returns an existing resolvedLogoUrl as-is, so clear it first when forcing.
        if (force && previous) await updateTeam(team.id, { resolvedLogoUrl: null });
        apiCalls++;
        url = await resolveTeamLogoFromApiSports(team.id);
        if (url) {
          source = 'API-Sports';
          consecutiveMisses = 0;
        } else if (++consecutiveMisses >= maxConsecutiveApiMisses) {
          apiSportsEnabled = false;
          ctx.log('warn', `API-Sports missed ${consecutiveMisses} times in a row (quota exhausted?) — not using it for the rest of this run.`);
        }
        if (apiSportsEnabled && apiCalls >= maxApiSportsCalls) {
          apiSportsEnabled = false;
          ctx.log('warn', `Reached ${maxApiSportsCalls} API-Sports calls — not using it for the rest of this run.`);
        }
      }

      if (url) {
        // API-Sports results are already persisted by the Edge Function.
        if (source !== 'API-Sports') await updateTeam(team.id, { resolvedLogoUrl: url });
        stats.success++;
        foundVia[source] = (foundVia[source] ?? 0) + 1;
        ctx.log('success', `${team.name}${playedSuffix(usage, team)} — ${source}${detail}`, url);
      } else {
        if (force && previous) await updateTeam(team.id, { resolvedLogoUrl: previous });
        // Cancelled mid-lookup: not a miss.
        if (ctx.signal.aborted) {
          stats.cancelled = true;
          break;
        }
        stats.failed++;
        const bundledHint = getBundledLogoUrl(team.logoUrl) ? ' (bundled crest available — run storage migration)' : '';
        ctx.log('warn', `${team.name}${playedSuffix(usage, team)} — no logo found${bundledHint}`);
      }
    } catch (error) {
      stats.failed++;
      ctx.log('error', `${team.name} — ${errorMessage(error)}`);
      if (force && previous) {
        await updateTeam(team.id, { resolvedLogoUrl: previous }).catch(() => undefined);
      }
    }

    ctx.progress(i + 1, candidates.length, team.name);
    if (i < candidates.length - 1) await delay(delayMs, ctx.signal);
  }

  const bySource = Object.entries(foundVia).map(([name, count]) => `${name} ${count}`).join(', ');
  if (bySource) ctx.log('info', `Found via: ${bySource}.`);
  if (useApiSports) ctx.log('info', `API-Sports calls used: ${apiCalls}.`);
  summarize(ctx, 'Resolve logos', stats);
  return stats;
}

/** " (12×)" for teams that have been played, so the log shows why a team came first. */
function playedSuffix(usage: Map<string, number>, team: Team): string {
  const count = usage.get(team.id);
  return count ? ` (${count}×)` : '';
}

export function clearCache(ctx: ToolContext): void {
  clearLogoCache();
  ctx.log('success', 'Browser logo cache cleared.');
}

/** Legacy normalisation from the old populateApiTeamNames script: ASCII-fold + drop club suffixes. */
export function toApiTeamName(name: string): string {
  return normalizeTeamName(name)
    .replace(/\s*FC$/, '')
    .replace(/\s*CF$/, '')
    .replace(/\s*AFC$/, '')
    .replace(/\s*SC$/, '')
    .replace(/\s*AC$/, '')
    .replace(/\s*\d{4}$/, '')
    .replace(/\s*&\s*/g, ' and ')
    .trim();
}

/** Fills teams.apiTeamName (search name for logo APIs) for teams that don't have one yet. */
export async function populateApiTeamNames(ctx: ToolContext): Promise<RunStats> {
  const teams = await fetchAllTeams();
  const candidates = teams.filter(t => !t.apiTeamName);
  const stats = emptyStats(teams.length);
  stats.skipped = teams.length - candidates.length;
  ctx.log('info', `${candidates.length} team(s) without apiTeamName.`);

  for (let i = 0; i < candidates.length; i++) {
    if (ctx.signal.aborted) {
      stats.cancelled = true;
      break;
    }
    const team = candidates[i];
    ctx.progress(i, candidates.length, team.name);
    const apiTeamName = toApiTeamName(team.name);
    try {
      await updateTeam(team.id, { apiTeamName });
      stats.success++;
      ctx.log('success', `${team.name} → ${apiTeamName}`);
    } catch (error) {
      stats.failed++;
      ctx.log('error', `${team.name} — ${errorMessage(error)}`);
    }
    ctx.progress(i + 1, candidates.length, team.name);
  }

  summarize(ctx, 'Populate apiTeamName', stats);
  return stats;
}

/** Finds a team by (partial) name; logs and returns null if there's no match. */
export async function findTeamByName(ctx: ToolContext, query: string): Promise<Team | null> {
  const matches = await searchTeams(query.trim(), 'name');
  if (matches.length === 0) {
    ctx.log('error', `No team matches "${query}".`);
    return null;
  }
  const exact = matches.find(t => t.name.toLowerCase() === query.trim().toLowerCase());
  const team = exact ?? matches[0];
  if (matches.length > 1) {
    const others = matches.filter(t => t !== team).slice(0, 5).map(t => t.name).join(', ');
    ctx.log('info', `${matches.length} matches — using "${team.name}" (also: ${others}${matches.length > 6 ? ', …' : ''}).`);
  }
  return team;
}

/**
 * Read-only diagnostic: shows a team's stored logo fields and what each
 * provider returns for it. Nothing is saved. The API-Sports lookup costs one
 * request of the daily quota, so it's opt-in.
 */
export async function testTeamLogo(ctx: ToolContext, query: string, { useApiSports = false } = {}): Promise<void> {
  const team = await findTeamByName(ctx, query);
  if (!team) return;

  const searchName = team.apiTeamName || team.name;
  ctx.log('info', `${team.name} — apiTeamName: ${team.apiTeamName ?? '—'}, apiTeamId: ${team.apiTeamId ?? '—'}, logoUrl: ${team.logoUrl || '—'}`);

  if (team.resolvedLogoUrl) {
    ctx.log('info', `resolvedLogoUrl${isLogoInStorage(team.resolvedLogoUrl) ? ' (Supabase Storage)' : ''}: ${team.resolvedLogoUrl}`, team.resolvedLogoUrl);
  } else {
    ctx.log('warn', 'resolvedLogoUrl: not set');
  }

  const bundled = getBundledLogoUrl(team.logoUrl);
  if (bundled) ctx.log('info', `Bundled crest: ${team.logoUrl}`, bundled);

  try {
    const crest = await fetchTeamLogoFromWikipedia(team.name, team.league, { signal: ctx.signal });
    const search = buildWikipediaSearch(team.name, team.league);
    if (crest) ctx.log('success', `Wikipedia "${search}" → ${crest.title}: ${crest.url}`, crest.url);
    else ctx.log('warn', `Wikipedia "${search}": no matching article with a crest`);
  } catch (error) {
    ctx.log('warn', `Wikipedia: ${errorMessage(error)}`);
  }

  try {
    if (team.apiTeamId) {
      const byId = await fetchTeamLogoByIdFromTheSportsDb(team.apiTeamId, { throwOnRateLimit: true });
      ctx.log(byId ? 'success' : 'warn', `TheSportsDB by id: ${byId ?? 'no result'}`, byId ?? undefined);
    }

    const byName = await fetchTeamLogoByNameFromTheSportsDb(searchName, { throwOnRateLimit: true });
    ctx.log(byName ? 'success' : 'warn', `TheSportsDB "${searchName}": ${byName ?? 'no result'}`, byName ?? undefined);
  } catch (error) {
    ctx.log('warn', `TheSportsDB: ${errorMessage(error)} — try again in a minute.`);
  }

  if (useApiSports) {
    const apiSports = await fetchTeamLogoFromApiSports(searchName);
    ctx.log(apiSports ? 'success' : 'warn', `API-Sports "${searchName}": ${apiSports ?? 'no result'}`, apiSports ?? undefined);
  } else {
    ctx.log('info', 'API-Sports lookup skipped (enable it to spend 1 request of the daily quota).');
  }
}
