import { Team } from '../types';
import { fetchAllTeams, searchTeams, updateTeam } from '../services/teamService';
import { fetchTeamLogoFromApiSports, resolveTeamLogoFromApiSports } from '../services/apiSportsService';
import { fetchTeamLogoByIdFromTheSportsDb, fetchTeamLogoByNameFromTheSportsDb } from '../services/theSportsDbService';
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
  /** Use API-Sports (via the api-sports-logo Edge Function; 100 requests/day). */
  useApiSports?: boolean;
  delayMs?: number;
  /** Hard cap on API-Sports calls per run (free-tier quota is 100/day). */
  maxApiSportsCalls?: number;
  /** Stop using API-Sports after this many misses in a row (quota exhausted / key problem). */
  maxConsecutiveApiMisses?: number;
}

/**
 * Resolves crests for every team matching the version / minimum-star filter
 * (API-Sports via the Edge Function first, then TheSportsDB by id / name) and
 * saves them to teams.resolvedLogoUrl. Most-played teams go first so the
 * API-Sports quota is spent where it matters. Sequential with a delay to stay
 * friendly to the API-Sports quota.
 *
 * Force mode re-resolves external URLs too, but never touches teams whose
 * crest is already hosted in our Supabase Storage (that would undo the
 * storage migration). If nothing is found, the previous URL is restored.
 */
export async function resolveAllTeamLogos(ctx: ToolContext, options: ResolveAllOptions = {}): Promise<RunStats> {
  const {
    force = false,
    useApiSports = true,
    delayMs = 400,
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
  if (useApiSports) ctx.log('info', `API-Sports enabled — at most ${maxApiSportsCalls} call(s) this run.`);

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
      // The Edge Function returns an existing resolvedLogoUrl as-is, so clear it first when forcing.
      if (force && previous) await updateTeam(team.id, { resolvedLogoUrl: null });

      let url: string | null = null;
      let source = '';

      if (apiSportsEnabled) {
        apiCalls++;
        url = await resolveTeamLogoFromApiSports(team.id);
        if (url) {
          source = 'API-Sports';
          consecutiveMisses = 0;
        } else if (++consecutiveMisses >= maxConsecutiveApiMisses) {
          apiSportsEnabled = false;
          ctx.log('warn', `API-Sports missed ${consecutiveMisses} times in a row (quota exhausted?) — continuing with TheSportsDB only.`);
        }
        if (apiSportsEnabled && apiCalls >= maxApiSportsCalls) {
          apiSportsEnabled = false;
          ctx.log('warn', `Reached ${maxApiSportsCalls} API-Sports calls — continuing with TheSportsDB only.`);
        }
      }

      if (!url && team.apiTeamId) {
        url = await fetchTeamLogoByIdFromTheSportsDb(team.apiTeamId);
        if (url) source = 'TheSportsDB (id)';
      }
      if (!url) {
        url = await fetchTeamLogoByNameFromTheSportsDb(team.apiTeamName || team.name);
        if (url) source = 'TheSportsDB (name)';
      }

      if (url) {
        // API-Sports results are already persisted by the Edge Function.
        if (source !== 'API-Sports') await updateTeam(team.id, { resolvedLogoUrl: url });
        stats.success++;
        ctx.log('success', `${team.name}${playedSuffix(usage, team)} — ${source}`, url);
      } else {
        if (force && previous) await updateTeam(team.id, { resolvedLogoUrl: previous });
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

  if (team.apiTeamId) {
    const byId = await fetchTeamLogoByIdFromTheSportsDb(team.apiTeamId);
    ctx.log(byId ? 'success' : 'warn', `TheSportsDB by id: ${byId ?? 'no result'}`, byId ?? undefined);
  }

  const byName = await fetchTeamLogoByNameFromTheSportsDb(searchName);
  ctx.log(byName ? 'success' : 'warn', `TheSportsDB "${searchName}": ${byName ?? 'no result'}`, byName ?? undefined);

  if (useApiSports) {
    const apiSports = await fetchTeamLogoFromApiSports(searchName);
    ctx.log(apiSports ? 'success' : 'warn', `API-Sports "${searchName}": ${apiSports ?? 'no result'}`, apiSports ?? undefined);
  } else {
    ctx.log('info', 'API-Sports lookup skipped (enable it to spend 1 request of the daily quota).');
  }
}
