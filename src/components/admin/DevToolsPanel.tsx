import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Database,
  FlaskConical,
  HardDrive,
  List,
  RefreshCw,
  Search,
  Square,
  Tags,
  Trash2,
  Upload,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Select, Switch } from '../ui';
import { teamKeys, useTeamsQuery } from '../../queries/teams';
import { isLogoInStorage } from '../../services/logoStorageService';
import { ALL_VERSIONS, getAvailableVersions, getLatestVersion } from '../../utils/versionFilter';
import { matchesLogoFilter } from '../../utils/logoCandidates';
import { LogLevel, ToolContext, errorMessage } from '../../admin-tools/toolContext';
import {
  clearCache,
  populateApiTeamNames,
  resolveAllTeamLogos,
  testTeamLogo,
} from '../../admin-tools/logoResolution';
import {
  checkStorageStatus,
  listTeamsNeedingMigration,
  migrateAllLogosToStorage,
  testTeamStorageMigration,
} from '../../admin-tools/storageMigration';

/**
 * Admin Dev Tools — logo resolution, apiTeamName backfill and Supabase
 * Storage migration. Lazy-loaded from AdminPage so none of this ships in the
 * main bundle. Every tool reports into the on-screen log (not the console)
 * and long runs can be cancelled.
 */

interface LogEntry {
  id: number;
  level: LogLevel;
  message: string;
  imageUrl?: string;
  time: string;
}

interface Progress {
  done: number;
  total: number;
  label?: string;
}

const MAX_LOG_ENTRIES = 1000;

/** Minimum-star choices for the resolver filter (0 = any rating). */
const STAR_OPTIONS = [0, 3, 3.5, 4, 4.5, 5];

const LEVEL_CLASSES: Record<LogLevel, string> = {
  info: 'text-gray-300',
  success: 'text-(--color-green-bright)',
  warn: 'text-amber-300',
  error: 'text-red-400',
};

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; hint?: string }> = ({ icon, title, hint }) => (
  <div className="mb-3">
    <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-(--color-ink)">
      {icon}
      {title}
    </h2>
    {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
  </div>
);

const ToolButton: React.FC<React.ComponentProps<typeof Button> & { icon: React.ReactNode }> = ({
  icon,
  children,
  className = '',
  ...rest
}) => (
  <Button className={`h-auto min-h-11 w-full justify-start py-2 text-left text-xs ${className}`} {...rest}>
    <span className="flex-none">{icon}</span>
    <span className="min-w-0">{children}</span>
  </Button>
);

const DevToolsPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [useApiSports, setUseApiSports] = useState(true);
  const [teamQuery, setTeamQuery] = useState('');
  // null = follow the current season (newest version) until the admin picks one.
  const [versionChoice, setVersionChoice] = useState<string | null>(null);
  const [minRating, setMinRating] = useState(0);
  const { data: teams = [] } = useTeamsQuery();
  const abortRef = useRef<AbortController | null>(null);
  const nextId = useRef(0);
  const consoleRef = useRef<HTMLDivElement>(null);
  const logBoxRef = useRef<HTMLDivElement>(null);

  // Abort any in-flight run if the admin leaves the tab.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Keep the log box pinned to the newest entry (without scrolling the page).
  useEffect(() => {
    const box = logBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [log]);

  const append = useCallback((level: LogLevel, message: string, imageUrl?: string) => {
    const entry: LogEntry = {
      id: nextId.current++,
      level,
      message,
      imageUrl,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setLog(prev => {
      const next = prev.length >= MAX_LOG_ENTRIES ? prev.slice(prev.length - MAX_LOG_ENTRIES + 1) : prev;
      return [...next, entry];
    });
  }, []);

  const run = useCallback(
    async (label: string, task: (ctx: ToolContext) => Promise<unknown> | void, { mutates = true } = {}) => {
      if (abortRef.current) return;
      const controller = new AbortController();
      abortRef.current = controller;
      setRunning(label);
      setProgress(null);
      append('info', `▶ ${label}`);
      consoleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

      try {
        await task({
          log: append,
          progress: (done, total, current) => setProgress({ done, total, label: current }),
          signal: controller.signal,
        });
      } catch (error) {
        append('error', `${label} failed: ${errorMessage(error)}`);
      } finally {
        abortRef.current = null;
        setRunning(null);
        setProgress(null);
        if (mutates) queryClient.invalidateQueries({ queryKey: teamKeys.all });
      }
    },
    [append, queryClient]
  );

  const cancel = () => {
    if (!abortRef.current) return;
    abortRef.current.abort();
    append('warn', 'Cancelling after the current team…');
  };

  const confirmThen = (message: string, action: () => void) => {
    if (window.confirm(message)) action();
  };

  const versions = useMemo(() => getAvailableVersions(teams), [teams]);
  const version = versionChoice ?? getLatestVersion(versions) ?? ALL_VERSIONS;
  const filter = { version, minRating };
  const scope = useMemo(() => {
    const inScope = teams.filter(t => matchesLogoFilter(t, { version, minRating }));
    return {
      total: inScope.length,
      missing: inScope.filter(t => !t.resolvedLogoUrl).length,
      notInStorage: inScope.filter(t => !isLogoInStorage(t.resolvedLogoUrl)).length,
    };
  }, [teams, version, minRating]);

  const busy = running !== null;
  const query = teamQuery.trim();
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Console: progress + result log */}
      <div ref={consoleRef} className="scroll-mt-4">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b-2 border-(--color-ink) px-3 py-2">
            <span className="truncate text-xs font-black uppercase tracking-wide text-(--color-ink)">
              {running ?? 'Console'}
            </span>
            {busy ? (
              <button
                type="button"
                onClick={cancel}
                className="flex flex-none items-center gap-1 border-2 border-(--color-ink) bg-white px-2 py-1 text-[11px] font-black uppercase tracking-wide text-red-600"
              >
                <Square className="h-3 w-3" /> Cancel
              </button>
            ) : (
              log.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLog([])}
                  className="flex-none text-[11px] font-bold uppercase tracking-wide text-gray-500 underline"
                >
                  Clear log
                </button>
              )
            )}
          </div>

          {busy && (
            <div className="border-b-2 border-(--color-ink) px-3 py-2">
              <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-gray-600">{progress?.label ?? 'Working…'}</span>
                <span className="flex-none font-black tabular-nums text-(--color-ink)">
                  {progress ? `${progress.done}/${progress.total}` : '…'}
                </span>
              </div>
              <div className="h-2 w-full border border-(--color-ink) bg-gray-100">
                <div
                  className={`h-full bg-(--color-green-bright) transition-[width] ${progress ? '' : 'animate-pulse'}`}
                  style={{ width: progress ? `${pct}%` : '100%' }}
                />
              </div>
            </div>
          )}

          <div ref={logBoxRef} className="max-h-72 overflow-y-auto bg-(--color-ink) px-3 py-2 font-mono text-[11px] leading-relaxed">
            {log.length === 0 ? (
              <p className="text-gray-500">Run a tool — results appear here.</p>
            ) : (
              log.map(entry => (
                <div key={entry.id} className={`flex items-start gap-2 ${LEVEL_CLASSES[entry.level]}`}>
                  <span className="flex-none text-gray-500">{entry.time}</span>
                  <span className="min-w-0 flex-1 break-words">{entry.message}</span>
                  {entry.imageUrl && (
                    <img
                      src={entry.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-6 w-6 flex-none bg-white object-contain p-0.5"
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Logo resolution */}
      <Card className="p-3">
        <SectionTitle
          icon={<RefreshCw className="h-4 w-4" />}
          title="Logo resolution"
          hint="Finds crests via Wikipedia, then TheSportsDB, then API-Sports (100 requests/day) as a last resort, and saves them to the team. Most-played teams go first (~1 team/s)."
        />
        <div className="mb-3 grid grid-cols-2 gap-2">
          <label className="text-xs font-bold text-(--color-ink)">
            Version
            <Select value={version} onChange={e => setVersionChoice(e.target.value)} disabled={busy} className="mt-1">
              <option value={ALL_VERSIONS}>All versions</option>
              {versions.map(v => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs font-bold text-(--color-ink)">
            Min. stars
            <Select value={minRating} onChange={e => setMinRating(Number(e.target.value))} disabled={busy} className="mt-1">
              {STAR_OPTIONS.map(r => (
                <option key={r} value={r}>
                  {r === 0 ? 'Any' : `${r.toFixed(1)}★+`}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          <span className="font-black tabular-nums text-(--color-ink)">{scope.total}</span> team(s) in scope ·{' '}
          <span className="font-black tabular-nums text-(--color-ink)">{scope.missing}</span> without a logo
        </p>
        <label className="mb-3 flex items-center justify-between gap-3 border-2 border-gray-200 px-3 py-2">
          <span className="text-xs font-bold text-(--color-ink)">
            Use API-Sports
            <span className="block font-normal text-gray-500">Last resort only. Max 100 calls per run; stops after 5 misses in a row.</span>
          </span>
          <Switch checked={useApiSports} onChange={setUseApiSports} disabled={busy} label="Use API-Sports" />
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ToolButton
            icon={<RefreshCw className={`h-4 w-4 ${running === 'Resolve logos' ? 'animate-spin' : ''}`} />}
            disabled={busy}
            onClick={() => run('Resolve logos', ctx => resolveAllTeamLogos(ctx, { ...filter, useApiSports }))}
          >
            Resolve missing ({scope.missing})
          </ToolButton>
          <ToolButton
            variant="outline"
            icon={<RefreshCw className={`h-4 w-4 ${running === 'Force resolve logos' ? 'animate-spin' : ''}`} />}
            disabled={busy}
            onClick={() =>
              confirmThen(
                `Re-resolve ${scope.notInStorage} team(s) not already in Supabase Storage? This can use a lot of the API-Sports quota.`,
                () => run('Force resolve logos', ctx => resolveAllTeamLogos(ctx, { ...filter, force: true, useApiSports }))
              )
            }
          >
            Force re-resolve ({scope.notInStorage})
          </ToolButton>
          <ToolButton
            variant="outline"
            icon={<Tags className="h-4 w-4" />}
            disabled={busy}
            onClick={() => run('Populate apiTeamName', populateApiTeamNames)}
          >
            Populate apiTeamName
          </ToolButton>
          <ToolButton
            variant="outline"
            icon={<Trash2 className="h-4 w-4" />}
            disabled={busy}
            onClick={() => run('Clear logo cache', clearCache, { mutates: false })}
          >
            Clear logo cache
          </ToolButton>
        </div>
      </Card>

      {/* Storage migration */}
      <Card className="p-3">
        <SectionTitle
          icon={<HardDrive className="h-4 w-4" />}
          title="Storage migration"
          hint="Copies crests (resolved URLs or bundled files) into the team-logos bucket and points the team at the stored copy."
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ToolButton
            icon={<Upload className="h-4 w-4" />}
            disabled={busy}
            onClick={() => run('Migrate to storage', ctx => migrateAllLogosToStorage(ctx))}
          >
            Migrate to storage
          </ToolButton>
          <ToolButton
            variant="outline"
            icon={<Upload className="h-4 w-4" />}
            disabled={busy}
            onClick={() =>
              confirmThen('Re-upload every team logo, including ones already in storage?', () =>
                run('Force migrate all', ctx => migrateAllLogosToStorage(ctx, { force: true }))
              )
            }
          >
            Force migrate all
          </ToolButton>
          <ToolButton
            variant="outline"
            icon={<Database className="h-4 w-4" />}
            disabled={busy}
            onClick={() => run('Migration status', checkStorageStatus, { mutates: false })}
          >
            Migration status
          </ToolButton>
          <ToolButton
            variant="outline"
            icon={<List className="h-4 w-4" />}
            disabled={busy}
            onClick={() => run('Teams needing migration', listTeamsNeedingMigration, { mutates: false })}
          >
            List teams needing migration
          </ToolButton>
        </div>
      </Card>

      {/* Single-team diagnostics */}
      <Card className="p-3">
        <SectionTitle
          icon={<FlaskConical className="h-4 w-4" />}
          title="Test a team"
          hint="Partial names work. Resolution test is read-only; the API-Sports lookup (if enabled above) costs 1 request."
        />
        <Input
          value={teamQuery}
          onChange={e => setTeamQuery(e.target.value)}
          placeholder="Team name, e.g. Arsenal"
          aria-label="Team name"
          disabled={busy}
          className="mb-2"
        />
        <div className="grid grid-cols-2 gap-2">
          <ToolButton
            variant="outline"
            icon={<Search className="h-4 w-4" />}
            disabled={busy || !query}
            onClick={() => run(`Test logo: ${query}`, ctx => testTeamLogo(ctx, query, { useApiSports }), { mutates: false })}
          >
            Test resolution
          </ToolButton>
          <ToolButton
            variant="outline"
            icon={<HardDrive className="h-4 w-4" />}
            disabled={busy || !query}
            onClick={() => run(`Test migration: ${query}`, ctx => testTeamStorageMigration(ctx, query))}
          >
            Test migration
          </ToolButton>
        </div>
      </Card>
    </div>
  );
};

export default DevToolsPanel;
