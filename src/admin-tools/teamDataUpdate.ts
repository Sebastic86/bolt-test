import { createTeam, fetchAllTeams, updateTeam } from '../services/teamService';
import { fetchSofifaTeamsPage } from '../services/sofifaService';
import { describeChanges, diffTeamData, newTeamRow, starRatingFor } from '../utils/teamDataDiff';
import { SOFIFA_PAGE_SIZE, SofifaTeam, parseSofifaTeamsPage } from './sofifaParser';
import { RunStats, ToolContext, delay, emptyStats, errorMessage, summarize } from './toolContext';

/** Safety cap: ~13 pages today (735 teams), so 30 leaves plenty of room. */
const MAX_PAGES = 30;

export interface SofifaSnapshot {
  teams: SofifaTeam[];
  version: string;
  rosterId: string | null;
  rosterDate: string | null;
}

/**
 * Downloads every team of SoFIFA's latest roster update, page by page, until
 * a short page. Later pages are pinned to the roster of the first page so a
 * roster update landing mid-run can't mix two datasets. Returns null if
 * cancelled or SoFIFA refused.
 */
export async function fetchSofifaSnapshot(ctx: ToolContext, { delayMs = 1000 } = {}): Promise<SofifaSnapshot | null> {
  const teams = new Map<number, SofifaTeam>();
  let version: string | null = null;
  let rosterId: string | null = null;
  let rosterDate: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    if (ctx.signal.aborted) return null;
    ctx.progress(page, page + 1, `SoFIFA page ${page + 1} (${teams.size} teams so far)`);

    const response = await fetchSofifaTeamsPage(page * SOFIFA_PAGE_SIZE, rosterId);
    if (response.status !== 200) {
      ctx.log('error', `SoFIFA answered HTTP ${response.status} on page ${page + 1} — it is blocking the Edge Function's requests (not a bug in the tool). Try again later.`);
      return null;
    }

    const parsed = parseSofifaTeamsPage(response.html);
    if (page === 0) {
      ({ version, rosterId, rosterDate } = parsed);
      if (!version) {
        ctx.log('error', 'Could not read the game version from SoFIFA — the page layout may have changed.');
        return null;
      }
      ctx.log('info', `SoFIFA: ${version}, roster update ${rosterDate ?? 'unknown date'}${rosterId ? ` (r=${rosterId})` : ''}.`);
    }
    if (parsed.teams.length < parsed.rowCount) {
      ctx.log('warn', `Page ${page + 1}: ${parsed.rowCount - parsed.teams.length} row(s) could not be parsed.`);
    }
    // The list order can shift between requests; dedupe by SoFIFA id.
    parsed.teams.forEach(t => teams.set(t.sofifaId, t));

    if (parsed.rowCount < SOFIFA_PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) ctx.log('warn', `Stopped after ${MAX_PAGES} pages — there may be more teams.`);
    await delay(delayMs, ctx.signal);
  }

  if (ctx.signal.aborted) return null;
  if (teams.size === 0) {
    ctx.log('error', 'SoFIFA returned no teams — the page layout may have changed.');
    return null;
  }
  ctx.log('info', `Fetched ${teams.size} teams from SoFIFA.`);
  return { teams: [...teams.values()], version: version!, rosterId, rosterDate };
}

export interface UpdateTeamDataOptions {
  /** false = preview only (nothing is written). */
  apply?: boolean;
}

/**
 * Brings the teams of the latest game version in line with SoFIFA: updates
 * OVR/ATT/MID/DEF, stars and league of existing teams and adds missing ones.
 * Logos are never touched on existing teams, and nothing is ever deleted.
 */
export async function updateTeamData(ctx: ToolContext, { apply = false }: UpdateTeamDataOptions = {}): Promise<RunStats | null> {
  const snapshot = await fetchSofifaSnapshot(ctx);
  if (!snapshot) {
    if (ctx.signal.aborted) ctx.log('warn', 'Cancelled — nothing was changed.');
    return null;
  }

  const { version } = snapshot;
  const dbTeams = (await fetchAllTeams()).filter(t => t.version === version);
  const diff = diffTeamData(snapshot.teams, dbTeams);

  ctx.log('info', `${version} in the database: ${dbTeams.length} team(s).`);
  ctx.log('info', `${diff.changed.length} to update, ${diff.added.length} new, ${diff.unchanged} unchanged.`);
  diff.changed.forEach(u => ctx.log('info', `~ ${u.team.name}: ${describeChanges(u.changes)}`));
  diff.added.forEach(t =>
    ctx.log('info', `+ ${t.name} (${t.league ?? 'Nation'}) ${t.overall} OVR ${t.attack}/${t.midfield}/${t.defend} ★${starRatingFor(t.overall)}`)
  );
  diff.ambiguous.forEach(name => ctx.log('warn', `! ${name}: more than one ${version} row with this name — skipped, fix by hand.`));
  if (diff.missing.length > 0) {
    ctx.log('warn', `${diff.missing.length} ${version} team(s) not on SoFIFA (left untouched — renamed or removed?): ${diff.missing.map(t => t.name).join(', ')}`);
  }

  if (!apply) {
    ctx.log('success', 'Preview only — nothing was changed. Use "Apply update" to write these changes.');
    return null;
  }

  const work = diff.changed.length + diff.added.length;
  const stats = emptyStats(work);
  for (let i = 0; i < work; i++) {
    if (ctx.signal.aborted) {
      stats.cancelled = true;
      break;
    }
    const update = i < diff.changed.length ? diff.changed[i] : null;
    const added = update ? null : diff.added[i - diff.changed.length];
    const name = update?.team.name ?? added!.name;
    ctx.progress(i, work, name);

    try {
      if (update) await updateTeam(update.team.id, update.updates);
      else await createTeam(newTeamRow(added!, version));
      stats.success++;
    } catch (error) {
      stats.failed++;
      ctx.log('error', `${name} — ${errorMessage(error)}`);
    }
    ctx.progress(i + 1, work, name);
  }

  summarize(ctx, `Update ${version} team data`, stats);
  if (diff.added.length > 0) ctx.log('info', 'New teams have no crest yet — run "Resolve logos" for them.');
  return stats;
}
