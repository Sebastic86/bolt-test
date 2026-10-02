/**
 * In-memory database for mock mode (`npm run dev:mock`).
 *
 * Tables are plain arrays persisted to localStorage, so data survives reloads.
 * Every write is broadcast to other tabs (BroadcastChannel) — two tabs behave
 * like two phones. Emulates the bits of the real schema the app relies on:
 * defaults, unique constraints (23505), FK cascades and the match_nights
 * triggers (supabase/migrations/20261003090000_match_nights.sql).
 */
import { buildSeed } from './seed';

export type Row = Record<string, unknown> & { id: string };
export type TableName =
  | 'teams' | 'players' | 'matches' | 'match_players' | 'user_profiles'
  | 'game_nights' | 'predictions' | 'night_jokers';

export type Tables = Record<TableName, Row[]>;

export interface ChangeEvent {
  table: TableName;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Row | null;
  old: Row | null;
}

const STORAGE_KEY = 'mockdb.v1';
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('mockdb') : null;

export const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

const now = () => new Date().toISOString();

function load(): Tables {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...emptyTables(), ...JSON.parse(raw) };
  } catch {
    // corrupted — reseed
  }
  return buildSeed();
}

function emptyTables(): Tables {
  return {
    teams: [], players: [], matches: [], match_players: [], user_profiles: [],
    game_nights: [], predictions: [], night_jokers: [],
  };
}

let tables: Tables = load();
const listeners = new Set<(event: ChangeEvent) => void>();

/** Changes waiting to be broadcast — sent only after persist(), so other tabs read fresh data. */
let pendingBroadcasts: ChangeEvent[] = [];

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tables));
  } catch (error) {
    console.warn('[mock] Could not persist mock database:', error);
  }
  const events = pendingBroadcasts;
  pendingBroadcasts = [];
  events.forEach(event => channel?.postMessage(event));
}
persist();

function emit(event: ChangeEvent, broadcast = true) {
  listeners.forEach(listener => listener(event));
  if (broadcast) pendingBroadcasts.push(event);
}

// Another tab wrote: reload from storage, then notify this tab's subscribers.
channel?.addEventListener('message', (message: MessageEvent<ChangeEvent | { type: 'reset' }>) => {
  if ('type' in message.data && message.data.type === 'reset') {
    location.reload();
    return;
  }
  tables = load();
  emit(message.data as ChangeEvent, false);
});

export function onChange(listener: (event: ChangeEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTable(table: TableName): Row[] {
  if (!tables[table]) throw new MockDbError(`relation "public.${table}" does not exist`, '42P01');
  return tables[table];
}

export function resetDatabase() {
  localStorage.removeItem(STORAGE_KEY);
  channel?.postMessage({ type: 'reset' });
  location.reload();
}

export class MockDbError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

// --- Defaults & constraints --------------------------------------------------

function withDefaults(table: TableName, row: Record<string, unknown>, userId: string | null): Row {
  const base: Row = { created_at: now(), ...row, id: (row.id as string | undefined) ?? uuid() };
  switch (table) {
    case 'matches':
      return {
        team1_score: null, team2_score: null, penalties_winner: null, played_at: now(),
        created_by: userId, game_night_id: null, ...base,
      };
    case 'players':
      return { avatar_url: null, ...base };
    case 'teams':
      return { version: 'FC26', apiTeamId: null, apiTeamName: null, resolvedLogoUrl: null, ...base };
    case 'user_profiles':
      return { updated_at: now(), ...base };
    case 'game_nights':
      return {
        started_at: now(), ended_at: null, started_by: userId, version: null,
        jokers_per_player: 1, player_ids: [], ...base,
      };
    case 'predictions':
      return {
        predicted_team1_score: null, predicted_team2_score: null, match_id: null, created_by: userId, ...base,
      };
    case 'night_jokers':
      return { replaced_team_id: null, chosen_team_id: null, used_at: now(), created_by: userId, ...base };
    default:
      return base;
  }
}

const duplicate = (what: string) =>
  new MockDbError(`duplicate key value violates unique constraint "${what}"`, '23505');

function checkConstraints(table: TableName, row: Row, ignoreId?: string) {
  const others = getTable(table).filter(r => r.id !== ignoreId);
  switch (table) {
    case 'players':
      if (others.some(r => r.name === row.name)) throw duplicate('players_name_key');
      break;
    case 'match_players':
      if (others.some(r => r.match_id === row.match_id && r.player_id === row.player_id)) {
        throw duplicate('match_players_match_id_player_id_key');
      }
      break;
    case 'game_nights':
      if (row.ended_at === null && others.some(r => r.ended_at === null)) throw duplicate('game_nights_one_active_idx');
      break;
    case 'predictions':
      if (row.match_id === null && others.some(r =>
        r.match_id === null && r.game_night_id === row.game_night_id && r.player_id === row.player_id
        && r.team1_id === row.team1_id && r.team2_id === row.team2_id)) {
        throw duplicate('predictions_one_open_pick_idx');
      }
      break;
  }
}

// --- Writes (with trigger emulation) ------------------------------------------

export function insertRows(table: TableName, rows: Record<string, unknown>[], userId: string | null): Row[] {
  const inserted: Row[] = [];
  for (const input of rows) {
    const row = withDefaults(table, input, userId);

    // BEFORE INSERT ON matches: attach the active night.
    if (table === 'matches' && !row.game_night_id) {
      row.game_night_id = getTable('game_nights').find(n => n.ended_at === null)?.id ?? null;
    }

    checkConstraints(table, row);
    getTable(table).push(row);
    inserted.push(row);
    emit({ table, eventType: 'INSERT', new: row, old: null });

    // AFTER INSERT ON matches: link open predictions for this matchup.
    if (table === 'matches' && row.game_night_id) {
      for (const prediction of getTable('predictions')) {
        if (prediction.game_night_id === row.game_night_id && prediction.team1_id === row.team1_id
          && prediction.team2_id === row.team2_id && prediction.match_id === null) {
          const old = { ...prediction };
          prediction.match_id = row.id;
          emit({ table: 'predictions', eventType: 'UPDATE', new: prediction, old });
        }
      }
    }
  }
  persist();
  return inserted;
}

export function updateRows(table: TableName, targets: Row[], patch: Record<string, unknown>): Row[] {
  const updated: Row[] = [];
  for (const target of targets) {
    const old = { ...target };
    const next = { ...target, ...patch } as Row;
    if (table === 'user_profiles') next.updated_at = now();
    checkConstraints(table, next, target.id);
    Object.assign(target, next);
    updated.push(target);
    emit({ table, eventType: 'UPDATE', new: target, old });
  }
  persist();
  return updated;
}

/** FK actions from the real schema: [child table, column, action]. */
const FOREIGN_KEYS: Partial<Record<TableName, [TableName, string, 'cascade' | 'set null'][]>> = {
  matches: [['match_players', 'match_id', 'cascade'], ['predictions', 'match_id', 'set null']],
  players: [['match_players', 'player_id', 'cascade'], ['predictions', 'player_id', 'cascade'], ['night_jokers', 'player_id', 'cascade']],
  game_nights: [['matches', 'game_night_id', 'set null'], ['predictions', 'game_night_id', 'cascade'], ['night_jokers', 'game_night_id', 'cascade']],
};

export function deleteRows(table: TableName, targets: Row[]): Row[] {
  const ids = new Set(targets.map(t => t.id));
  for (const [child, column, action] of FOREIGN_KEYS[table] ?? []) {
    const affected = getTable(child).filter(r => ids.has(r[column] as string));
    if (action === 'cascade') deleteRows(child, affected);
    else updateRows(child, affected, { [column]: null });
  }
  if (table === 'teams') {
    const used = getTable('matches').some(m => ids.has(m.team1_id as string) || ids.has(m.team2_id as string));
    if (used) {
      throw new MockDbError('update or delete on table "teams" violates foreign key constraint on table "matches"', '23503');
    }
  }
  tables[table] = getTable(table).filter(r => !ids.has(r.id));
  targets.forEach(t => emit({ table, eventType: 'DELETE', new: null, old: t }));
  persist();
  return targets;
}
