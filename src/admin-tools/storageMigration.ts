import { fetchAllTeams } from '../services/teamService';
import {
  getLogoSources,
  getStorageStats,
  isLogoInStorage,
  migrateTeamLogoToStorage,
  needsMigration,
  StorageStats,
} from '../services/logoStorageService';
import { findTeamByName } from './logoResolution';
import { RunStats, ToolContext, delay, emptyStats, errorMessage, summarize } from './toolContext';

/**
 * Copies every team's crest (external resolved URL, manual URL, or bundled
 * crest file) into the `team-logos` bucket. Force mode re-uploads teams that
 * are already in storage as well.
 */
export async function migrateAllLogosToStorage(
  ctx: ToolContext,
  { force = false, delayMs = 300 }: { force?: boolean; delayMs?: number } = {}
): Promise<RunStats> {
  const teams = await fetchAllTeams();
  const candidates = teams.filter(t => (force ? getLogoSources(t).length > 0 : needsMigration(t)));
  const stats = emptyStats(teams.length);
  stats.skipped = teams.length - candidates.length;

  ctx.log('info', `${candidates.length} team(s) to migrate, ${stats.skipped} skipped (${force ? 'no logo source' : 'already in storage or no logo source'}).`);

  for (let i = 0; i < candidates.length; i++) {
    if (ctx.signal.aborted) {
      stats.cancelled = true;
      break;
    }
    const team = candidates[i];
    ctx.progress(i, candidates.length, team.name);

    try {
      const result = await migrateTeamLogoToStorage(team, { force, signal: ctx.signal });
      if (result.success) {
        stats.success++;
        ctx.log('success', `${team.name} — from ${result.source}${result.viaProxy ? ' (via CORS proxy)' : ''}`, result.url);
      } else if (ctx.signal.aborted) {
        stats.cancelled = true;
        break;
      } else {
        stats.failed++;
        ctx.log('error', `${team.name} — ${result.error}`);
      }
    } catch (error) {
      stats.failed++;
      ctx.log('error', `${team.name} — ${errorMessage(error)}`);
    }

    ctx.progress(i + 1, candidates.length, team.name);
    if (i < candidates.length - 1) await delay(delayMs, ctx.signal);
  }

  summarize(ctx, 'Storage migration', stats);
  return stats;
}

export async function checkStorageStatus(ctx: ToolContext): Promise<StorageStats> {
  const stats = getStorageStats(await fetchAllTeams());
  const pct = stats.totalTeams ? Math.round((stats.teamsInStorage / stats.totalTeams) * 100) : 0;
  ctx.log('info', `Total teams: ${stats.totalTeams}`);
  ctx.log('success', `In Supabase Storage: ${stats.teamsInStorage} (${pct}%)`);
  ctx.log(stats.teamsNeedingMigration ? 'warn' : 'info', `Need migration: ${stats.teamsNeedingMigration} (bundled crest only: ${stats.teamsWithBundledOnly})`);
  ctx.log(stats.teamsWithoutLogos ? 'warn' : 'info', `No logo source at all: ${stats.teamsWithoutLogos}`);
  if (stats.teamsNeedingMigration > 0) ctx.log('info', 'Run "Migrate to storage" to copy the remaining crests.');
  else if (stats.teamsWithoutLogos > 0) ctx.log('info', 'Run "Resolve all logos" first for teams without a source.');
  else ctx.log('success', 'All teams with logos are in Supabase Storage.');
  return stats;
}

export async function listTeamsNeedingMigration(ctx: ToolContext): Promise<void> {
  const teams = (await fetchAllTeams()).filter(needsMigration);
  if (teams.length === 0) {
    ctx.log('success', 'No teams need migration.');
    return;
  }
  ctx.log('info', `${teams.length} team(s) need migration:`);
  teams.forEach((team, i) => {
    const [best] = getLogoSources(team);
    ctx.log('info', `${i + 1}. ${team.name} — ${best.kind}: ${best.kind === 'bundled' ? team.logoUrl : best.url}`);
  });
}

/** Migrates one team (found by name) — handy to check the pipeline before a bulk run. */
export async function testTeamStorageMigration(ctx: ToolContext, query: string, { force = false } = {}): Promise<void> {
  const team = await findTeamByName(ctx, query);
  if (!team) return;

  ctx.log('info', `${team.name} — current resolvedLogoUrl: ${team.resolvedLogoUrl ?? '—'}`);
  if (!force && isLogoInStorage(team.resolvedLogoUrl)) {
    ctx.log('success', 'Already in Supabase Storage.', team.resolvedLogoUrl ?? undefined);
    return;
  }
  const sources = getLogoSources(team);
  if (sources.length === 0) {
    ctx.log('error', 'No logo source — resolve the logo first.');
    return;
  }
  ctx.log('info', `Sources to try: ${sources.map(s => s.kind).join(' → ')}`);

  const result = await migrateTeamLogoToStorage(team, { force, signal: ctx.signal });
  if (result.success) {
    ctx.log('success', `Migrated from ${result.source}${result.viaProxy ? ' (via CORS proxy)' : ''}: ${result.url}`, result.url);
  } else {
    ctx.log('error', `Migration failed: ${result.error}`);
  }
}
