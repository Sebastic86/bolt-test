/**
 * A small PostgREST-style query builder over the mock tables — just the
 * subset of supabase-js the app uses (see src/services/*). Also emulates RLS
 * the way the real policies behave: blocked inserts error with 42501, blocked
 * updates/deletes silently affect 0 rows.
 */
import { deleteRows, getTable, insertRows, MockDbError, Row, TableName, updateRows } from './db';
import { currentUserId, hasProfile, isAdmin } from './session';

type Filter = (row: Row) => boolean;
type Result = { data: unknown; error: { message: string; code: string; details: null; hint: null } | null; count?: number | null; status: number; statusText: string };

const latency = () => Number(new URLSearchParams(location.search).get('mockLatency') ?? 40);

const like = (pattern: string, caseInsensitive: boolean) => {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${escaped}$`, caseInsensitive ? 'i' : '');
};

const stripQuotes = (column: string) => column.trim().replace(/^"|"$/g, '');

function compare(op: string, value: unknown, target: unknown): boolean {
  switch (op) {
    case 'eq': return value === target || String(value) === String(target);
    case 'neq': return !(value === target || String(value) === String(target));
    case 'gt': return value !== null && (value as never) > (target as never);
    case 'gte': return value !== null && (value as never) >= (target as never);
    case 'lt': return value !== null && (value as never) < (target as never);
    case 'lte': return value !== null && (value as never) <= (target as never);
    case 'is': return target === null || target === 'null' ? value === null || value === undefined : value === target;
    case 'like': return typeof value === 'string' && like(String(target), false).test(value);
    case 'ilike': return typeof value === 'string' && like(String(target), true).test(value);
    case 'in': return (target as unknown[]).some(t => String(t) === String(value));
    default: throw new MockDbError(`mock: unsupported operator "${op}"`, 'PGRST100');
  }
}

// --- RLS ------------------------------------------------------------------------

function canRead(table: TableName, row: Row): boolean {
  if (table === 'user_profiles') return row.id === currentUserId() || isAdmin();
  return true;
}

function canInsert(table: TableName, row: Row): boolean {
  const uid = currentUserId();
  if (!uid) return false;
  switch (table) {
    case 'teams':
    case 'players':
    case 'user_profiles':
      return isAdmin();
    case 'matches':
      return hasProfile() && row.created_by === uid;
    case 'match_players': {
      const match = getTable('matches').find(m => m.id === row.match_id);
      return isAdmin() || (!!match && match.created_by === uid);
    }
    default:
      return hasProfile();
  }
}

function canModify(table: TableName, row: Row, op: 'update' | 'delete'): boolean {
  const uid = currentUserId();
  if (!uid) return false;
  switch (table) {
    case 'teams':
    case 'players':
    case 'user_profiles':
      return isAdmin();
    case 'matches':
      return isAdmin() || (hasProfile() && row.created_by === uid);
    case 'game_nights':
      // 20261004090000_night_delete_policy.sql: admins or the night's starter.
      if (op === 'delete') return isAdmin() || (hasProfile() && row.started_by === uid);
      return hasProfile();
    case 'match_players': {
      if (op === 'delete') return false; // no delete policy — cascade only
      const match = getTable('matches').find(m => m.id === row.match_id);
      return isAdmin() || (!!match && match.created_by === uid);
    }
    default:
      return hasProfile();
  }
}

// --- Builder --------------------------------------------------------------------

export class MockQuery implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: Record<string, unknown>[] | Record<string, unknown> | null = null;
  private filters: Filter[] = [];
  private orders: { column: string; ascending: boolean }[] = [];
  private limitCount: number | null = null;
  private rangeBounds: [number, number] | null = null;
  private columns = '*';
  private returning: string | null = null;
  private mode: 'many' | 'single' | 'maybe' = 'many';
  private countMode: string | null = null;
  private head = false;

  constructor(private table: TableName) {}

  select(columns = '*', options: { count?: string; head?: boolean } = {}) {
    if (this.op === 'select') {
      this.columns = columns;
      this.countMode = options.count ?? null;
      this.head = !!options.head;
    } else {
      this.returning = columns;
    }
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.op = 'insert';
    this.payload = values;
    return this;
  }

  upsert(values: Record<string, unknown> | Record<string, unknown>[]) {
    return this.insert(values);
  }

  update(values: Record<string, unknown>) {
    this.op = 'update';
    this.payload = values;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  private where(column: string, op: string, value: unknown) {
    const key = stripQuotes(column);
    this.filters.push(row => compare(op, row[key], value));
    return this;
  }

  eq(column: string, value: unknown) { return this.where(column, 'eq', value); }
  neq(column: string, value: unknown) { return this.where(column, 'neq', value); }
  gt(column: string, value: unknown) { return this.where(column, 'gt', value); }
  gte(column: string, value: unknown) { return this.where(column, 'gte', value); }
  lt(column: string, value: unknown) { return this.where(column, 'lt', value); }
  lte(column: string, value: unknown) { return this.where(column, 'lte', value); }
  is(column: string, value: unknown) { return this.where(column, 'is', value); }
  like(column: string, pattern: string) { return this.where(column, 'like', pattern); }
  ilike(column: string, pattern: string) { return this.where(column, 'ilike', pattern); }
  in(column: string, values: unknown[]) { return this.where(column, 'in', values); }
  filter(column: string, op: string, value: unknown) { return this.where(column, op, value); }

  match(query: Record<string, unknown>) {
    Object.entries(query).forEach(([column, value]) => this.eq(column, value));
    return this;
  }

  not(column: string, op: string, value: unknown) {
    const key = stripQuotes(column);
    this.filters.push(row => !compare(op, row[key], value));
    return this;
  }

  /** `name.ilike.%x%,league.ilike.%x%` — flat OR groups only. */
  or(expression: string) {
    const clauses = expression.split(',').map(part => {
      const [column, op, ...rest] = part.split('.');
      return { column: stripQuotes(column), op, value: rest.join('.') };
    });
    this.filters.push(row => clauses.some(c => compare(c.op, row[c.column], c.value)));
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orders.push({ column: stripQuotes(column), ascending: options.ascending ?? true });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.rangeBounds = [from, to];
    return this;
  }

  single() {
    this.mode = 'single';
    return this;
  }

  maybeSingle() {
    this.mode = 'maybe';
    return this;
  }

  then<T1 = Result, T2 = never>(
    onFulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
    onRejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return new Promise<Result>(resolve => setTimeout(() => resolve(this.execute()), latency()))
      .then(onFulfilled, onRejected);
  }

  private project(rows: Row[], columns: string): Record<string, unknown>[] {
    const copies = rows.map(r => structuredClone(r) as Record<string, unknown>);
    if (columns.trim() === '*' || columns.trim() === '') return copies;
    const keys = columns.split(',').map(stripQuotes).filter(Boolean);
    return copies.map(r => Object.fromEntries(keys.map(k => [k, r[k] ?? null])));
  }

  private sortAndSlice(rows: Row[]): Row[] {
    const sorted = [...rows];
    for (const { column, ascending } of [...this.orders].reverse()) {
      sorted.sort((a, b) => {
        const [x, y] = [a[column], b[column]];
        if (x === y) return 0;
        // Postgres: ASC NULLS LAST, DESC NULLS FIRST.
        if (x === null || x === undefined) return ascending ? 1 : -1;
        if (y === null || y === undefined) return ascending ? -1 : 1;
        const result = typeof x === 'string' && typeof y === 'string'
          ? x.localeCompare(y, undefined, { sensitivity: 'base' })
          : (x as number) < (y as number) ? -1 : 1;
        return ascending ? result : -result;
      });
    }
    let sliced = sorted;
    if (this.rangeBounds) sliced = sliced.slice(this.rangeBounds[0], this.rangeBounds[1] + 1);
    if (this.limitCount !== null) sliced = sliced.slice(0, this.limitCount);
    return sliced;
  }

  private execute(): Result {
    try {
      const matching = () => getTable(this.table).filter(row => this.filters.every(f => f(row)));
      let rows: Row[];
      let columns = this.returning;

      switch (this.op) {
        case 'select':
          rows = matching().filter(row => canRead(this.table, row));
          columns = this.columns;
          break;
        case 'insert': {
          const input = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
          const uid = currentUserId();
          // created_by defaults to auth.uid() in the real schema.
          const blocked = input.find(values => !canInsert(this.table, { created_by: uid, ...values } as unknown as Row));
          if (blocked) {
            throw new MockDbError(`new row violates row-level security policy for table "${this.table}"`, '42501');
          }
          rows = insertRows(this.table, input, uid);
          break;
        }
        case 'update':
          rows = updateRows(this.table, matching().filter(r => canModify(this.table, r, 'update')), this.payload as Record<string, unknown>);
          break;
        case 'delete':
          rows = deleteRows(this.table, matching().filter(r => canModify(this.table, r, 'delete')));
          break;
      }

      const count = this.countMode ? rows.length : null;
      if (this.op !== 'select' && columns === null) {
        return { data: null, error: null, count, status: this.op === 'insert' ? 201 : 204, statusText: 'OK' };
      }

      const result = this.project(this.op === 'select' ? this.sortAndSlice(rows) : rows, columns ?? '*');
      if (this.head) return { data: null, error: null, count, status: 200, statusText: 'OK' };

      if (this.mode !== 'many') {
        if (result.length > 1 || (result.length === 0 && this.mode === 'single')) {
          return {
            data: null,
            error: {
              message: 'JSON object requested, multiple (or no) rows returned',
              code: 'PGRST116', details: null, hint: null,
            },
            count, status: 406, statusText: 'Not Acceptable',
          };
        }
        return { data: result[0] ?? null, error: null, count, status: 200, statusText: 'OK' };
      }

      return { data: result, error: null, count, status: 200, statusText: 'OK' };
    } catch (error) {
      const err = error instanceof MockDbError ? error : new MockDbError(String(error), 'XX000');
      return { data: null, error: { message: err.message, code: err.code, details: null, hint: null }, status: 400, statusText: 'Bad Request' };
    }
  }
}
