import { Team } from '../types';
import { updateTeam } from './teamService';
import { uploadTeamLogoBlob } from './teamUploadService';
import { getBundledLogoUrl } from './logoService';

/**
 * Logo Storage Service (admin tooling) — copies team crests into the
 * `team-logos` Supabase Storage bucket and points teams.resolvedLogoUrl at
 * the stored copy, so crests no longer depend on third-party hosts.
 *
 * Sources, in order of preference:
 *   1. teams.resolvedLogoUrl when it's an external URL (API-Sports / TheSportsDB)
 *   2. teams.logoUrl when it's a manually-entered http(s) URL
 *   3. the legacy bundled crest file named by teams.logoUrl (src/assets/logos)
 *
 * External images are fetched directly first; if the host blocks CORS, the
 * download is retried through a binary-capable CORS proxy (configurable via
 * VITE_CORS_PROXY_URL_BINARY, defaulting to AllOrigins as the old app did).
 * Only image bytes go through the proxy — never API keys.
 *
 * Storage writes are admin-only per RLS, so this is only used from the
 * admin Dev Tools panel.
 */

const CORS_PROXY_URL_BINARY: string =
  import.meta.env.VITE_CORS_PROXY_URL_BINARY || 'https://api.allorigins.win/raw?url=';

export type MigrationTeam = Pick<Team, 'id' | 'name' | 'logoUrl' | 'resolvedLogoUrl'>;

export type LogoSourceKind = 'resolved' | 'external' | 'bundled' | 'storage';

export interface LogoSource {
  kind: LogoSourceKind;
  url: string;
}

export interface MigrationResult {
  success: boolean;
  url?: string;
  source?: LogoSourceKind;
  error?: string;
}

export interface StorageStats {
  totalTeams: number;
  teamsInStorage: number;
  teamsNeedingMigration: number;
  /** Subset of teamsNeedingMigration whose only source is a bundled crest file. */
  teamsWithBundledOnly: number;
  teamsWithoutLogos: number;
}

const isHttpUrl = (url?: string | null): url is string =>
  !!url && (url.startsWith('http://') || url.startsWith('https://'));

export function isLogoInStorage(url?: string | null): boolean {
  if (!url) return false;
  return url.includes('/storage/v1/object/public/team-logos/');
}

/** All usable sources for a team, best first. */
export function getLogoSources(team: MigrationTeam): LogoSource[] {
  const sources: LogoSource[] = [];
  if (isHttpUrl(team.resolvedLogoUrl) && !isLogoInStorage(team.resolvedLogoUrl)) {
    sources.push({ kind: 'resolved', url: team.resolvedLogoUrl });
  }
  if (isHttpUrl(team.logoUrl) && !isLogoInStorage(team.logoUrl)) {
    sources.push({ kind: 'external', url: team.logoUrl });
  }
  const bundled = getBundledLogoUrl(team.logoUrl);
  if (bundled) sources.push({ kind: 'bundled', url: bundled });
  // Last resort for forced re-migration: re-upload the copy already in storage.
  if (isLogoInStorage(team.resolvedLogoUrl)) {
    sources.push({ kind: 'storage', url: team.resolvedLogoUrl! });
  }
  return sources;
}

export function needsMigration(team: MigrationTeam): boolean {
  return !isLogoInStorage(team.resolvedLogoUrl) && getLogoSources(team).length > 0;
}

export function getStorageStats(teams: MigrationTeam[]): StorageStats {
  let teamsInStorage = 0;
  let teamsNeedingMigration = 0;
  let teamsWithBundledOnly = 0;
  let teamsWithoutLogos = 0;

  for (const team of teams) {
    if (isLogoInStorage(team.resolvedLogoUrl)) {
      teamsInStorage++;
      continue;
    }
    const sources = getLogoSources(team);
    if (sources.length === 0) {
      teamsWithoutLogos++;
    } else {
      teamsNeedingMigration++;
      if (sources.every(s => s.kind === 'bundled')) teamsWithBundledOnly++;
    }
  }

  return { totalTeams: teams.length, teamsInStorage, teamsNeedingMigration, teamsWithBundledOnly, teamsWithoutLogos };
}

// --- Downloading -----------------------------------------------------------

const EXTENSION_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

/** Content-type from magic bytes (proxies often answer application/octet-stream). */
async function sniffImageType(blob: Blob, url: string): Promise<string | null> {
  const bytes = new Uint8Array(await blob.slice(0, 256).arrayBuffer());
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp';
  const head = new TextDecoder().decode(bytes).trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml';

  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  return (ext && blob.type.startsWith('image/') && EXTENSION_TO_MIME[ext]) || null;
}

async function fetchImage(url: string, signal?: AbortSignal): Promise<{ blob: Blob; contentType: string }> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());

  const blob = await response.blob();
  const declared = blob.type.split(';')[0].trim();
  const contentType = declared.startsWith('image/') ? declared : await sniffImageType(blob, url);
  if (!contentType) throw new Error(`Not an image (${declared || 'unknown type'})`);
  if (contentType === 'image/jpg') return { blob, contentType: 'image/jpeg' };
  return { blob, contentType };
}

/**
 * Downloads an image. Same-origin (bundled) and Supabase URLs are fetched
 * directly; other hosts are tried directly first, then through the CORS proxy.
 */
async function downloadImage(source: LogoSource, signal?: AbortSignal): Promise<{ blob: Blob; contentType: string; viaProxy: boolean }> {
  if (source.kind === 'bundled' || source.kind === 'storage') {
    return { ...(await fetchImage(source.url, signal)), viaProxy: false };
  }
  try {
    return { ...(await fetchImage(source.url, signal)), viaProxy: false };
  } catch (directError) {
    if (signal?.aborted) throw directError;
    try {
      return { ...(await fetchImage(`${CORS_PROXY_URL_BINARY}${encodeURIComponent(source.url)}`, signal)), viaProxy: true };
    } catch (proxyError) {
      const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
      throw new Error(`direct: ${msg(directError)}; proxy: ${msg(proxyError)}`);
    }
  }
}

// --- Migration -------------------------------------------------------------

/**
 * Copies a team's crest into storage and saves the new URL to
 * teams.resolvedLogoUrl. Tries each available source until one works.
 * Without `force`, a team already in storage is left untouched.
 */
export async function migrateTeamLogoToStorage(
  team: MigrationTeam,
  { force = false, signal }: { force?: boolean; signal?: AbortSignal } = {}
): Promise<MigrationResult & { viaProxy?: boolean; skipped?: boolean }> {
  if (!force && isLogoInStorage(team.resolvedLogoUrl)) {
    return { success: true, skipped: true, url: team.resolvedLogoUrl!, source: 'storage' };
  }

  const sources = getLogoSources(team);
  if (sources.length === 0) return { success: false, error: 'No logo source (no resolved URL or bundled crest)' };

  const errors: string[] = [];
  for (const source of sources) {
    if (signal?.aborted) return { success: false, error: 'Cancelled' };
    try {
      const { blob, contentType, viaProxy } = await downloadImage(source, signal);
      const publicUrl = await uploadTeamLogoBlob(team.id, blob, contentType);
      // Version param busts browser/CDN caches when a re-migration overwrites the same path.
      const url = `${publicUrl}?v=${Date.now()}`;
      await updateTeam(team.id, { resolvedLogoUrl: url });
      return { success: true, url, source: source.kind, viaProxy };
    } catch (error) {
      if (signal?.aborted) return { success: false, error: 'Cancelled' };
      errors.push(`${source.kind}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { success: false, error: errors.join(' | ') };
}
