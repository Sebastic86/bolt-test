import { createTeam, fetchAllTeams, updateTeam } from '../services/teamService';
import { FifaIndexCategory, blockedMessage, fetchFifaIndexPage } from '../services/fifaIndexService';
import { describeChanges, diffTeamData, newTeamRow, starRatingFor } from '../utils/teamDataDiff';
import { FIFAINDEX_PAGE_SIZE, SourceTeam, parseFifaIndexTeamsPage } from './fifaIndexParser';
import { RunStats, ToolContext, delay, emptyStats, errorMessage, summarize } from './toolContext';

/** Safety cap per category: ~16 club pages today (775 teams), so 30 leaves plenty of room. */
const MAX_PAGES = 30;

export interface SourceSnapshot {
  teams: SourceTeam[];
  version: string;
}

const LABELS: Record<FifaIndexCategory, string> = { clubs: 'clubs', nations: 'national teams' };

/**
 * Downloads every men's club and national team of FIFA Index's current game
 * version, page by page, until a short page. Returns null if cancelled or
 * FIFA Index refused.
 */
export async function fetchSourceSnapshot(ctx: ToolContext, { delayMs = 1000 } = {}): Promise<SourceSnapshot | null> {
  const teams = new Map<number, SourceTeam>();
  let version: string | null = null;
  let step = 0;

  for (const category of ['clubs', 'nations'] as FifaIndexCategory[]) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (ctx.signal.aborted) return null;
      ctx.progress(step, step + 1, `FIFA Index ${LABELS[category]} page ${page} (${teams.size} teams so far)`);
      step++;

      const response = await fetchFifaIndexPage(page, { category });
      if (response.status !== 200) {
        ctx.log('error', `${blockedMessage(response.status)} (${LABELS[category]} page ${page})`);
        return null;
      }

      const parsed = parseFifaIndexTeamsPage(response.html);
      if (!version) {
        version = parsed.version;
        if (!version) {
          ctx.log('error', 'Could not read the game version from FIFA Index — the page layout may have changed.');
          return null;
        }
        ctx.log('info', `FIFA Index: ${version}.`);
      } else if (parsed.version && parsed.version !== version) {
        ctx.log('error', `FIFA Index switched from ${version} to ${parsed.version} mid-run — run the tool again.`);
        return null;
      }
      // The list order can shift between requests; dedupe by EA team id.
      parsed.teams.forEach(t => teams.set(t.teamId, t));

      if (parsed.rowCount < FIFAINDEX_PAGE_SIZE) break;
      if (page === MAX_PAGES) ctx.log('warn', `Stopped after ${MAX_PAGES} ${LABELS[category]} pages — there may be more teams.`);
      await delay(delayMs, ctx.signal);
    }
  }

  if (ctx.signal.aborted) return null;
  if (teams.size === 0) {
    ctx.log('error', 'FIFA Index returned no teams — the page layout may have changed.');
    return null;
  }
  ctx.log('info', `Fetched ${teams.size} teams from FIFA Index.`);
  return { teams: [...teams.values()], version: version! };
}

export interface UpdateTeamDataOptions {
  /** false = preview only (nothing is written). */
  apply?: boolean;
}

/**
 * Brings the teams of the latest game version in line with FIFA Index: updates
 * OVR/ATT/MID/DEF and stars of existing teams and adds missing ones.
 * Logos are never touched on existing teams, and nothing is ever deleted.
 */
export async function updateTeamData(ctx: ToolContext, { apply = false }: UpdateTeamDataOptions = {}): Promise<RunStats | null> {
  const snapshot = await fetchSourceSnapshot(ctx);
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
    ctx.log('warn', `${diff.missing.length} ${version} team(s) not on FIFA Index (left untouched — renamed or removed?): ${diff.missing.map(t => t.name).join(', ')}`);
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
