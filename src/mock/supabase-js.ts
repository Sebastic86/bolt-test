/**
 * Mock replacement for `@supabase/supabase-js`, aliased in by vite.config.ts
 * when running `vite --mode mock` (npm run dev:mock). Never part of a
 * production build.
 *
 * - Data: in-memory tables seeded with synthetic data or a local snapshot (db.ts, seed.ts)
 * - Auth: auto signed-in; switch role in the MOCK panel or with ?mockRole=admin|normal|none|out
 * - Realtime: in-tab and across tabs (two tabs = two phones)
 * - Storage: uploads kept as data URLs; Edge Functions: api-sports-logo returns no logo,
 *   sofifa-teams serves a trimmed real SoFIFA page, or with a keyword a search page built
 *   from the mock teams (src/mock/sofifa.ts)
 */
import { getTable, onChange, TableName } from './db';
import { MockQuery } from './query';
import { currentUser, currentUserId, hasProfile, isAdmin } from './session';
import { MOCK_USERS, setMockRole } from './users';
import { mountMockPanel } from './panel';
import sofifaTeamsPage from '../admin-tools/__fixtures__/sofifa-teams-page.html?raw';
import { mockSofifaSearchPage } from './sofifa';

type AuthCallback = (event: string, session: unknown) => void;
type ChangeCallback = (payload: unknown) => void;

const STORAGE_PREFIX = 'mockstorage:';

function session() {
  const user = currentUser();
  return user ? { user, access_token: 'mock-token', token_type: 'bearer', expires_in: 3600 } : null;
}

function ok<T>(data: T) {
  return Promise.resolve({ data, error: null });
}

function fail(message: string, code = 'P0001') {
  return Promise.resolve({ data: null, error: { message, code, details: null, hint: null } });
}

class MockChannel {
  private bindings: { table: string; event: string; callback: ChangeCallback }[] = [];
  private unsubscribe: (() => void) | null = null;

  constructor(public name: string) {}

  on(_type: string, filter: { event?: string; table?: string }, callback: ChangeCallback) {
    this.bindings.push({ table: filter.table ?? '*', event: filter.event ?? '*', callback });
    return this;
  }

  subscribe(status?: (state: string) => void) {
    this.unsubscribe = onChange(change => {
      for (const binding of this.bindings) {
        if ((binding.table === '*' || binding.table === change.table)
          && (binding.event === '*' || binding.event === change.eventType)) {
          binding.callback({
            schema: 'public', table: change.table, eventType: change.eventType,
            new: change.new ?? {}, old: change.old ?? {}, commit_timestamp: new Date().toISOString(),
          });
        }
      }
    });
    status?.('SUBSCRIBED');
    return this;
  }

  close() {
    this.unsubscribe?.();
  }
}

function readFile(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function createClient() {
  const authCallbacks = new Set<AuthCallback>();
  mountMockPanel();

  return {
    from: (table: string) => new MockQuery(table as TableName),

    rpc(fn: string) {
      if (fn === 'has_profile') return ok(hasProfile());
      if (fn === 'is_admin') return ok(isAdmin());
      if (fn === 'admin_list_users') {
        if (!isAdmin()) return fail('Access denied. Admin privileges required.');
        return ok(Object.values(MOCK_USERS).map(u => ({
          id: u.id, email: u.email, created_at: '2025-01-01T00:00:00.000Z', last_sign_in_at: new Date().toISOString(),
        })));
      }
      return fail(`mock: function public.${fn} does not exist`, '42883');
    },

    auth: {
      getSession: () => ok({ session: session() }),
      getUser: () => ok({ user: currentUser() }),
      onAuthStateChange(callback: AuthCallback) {
        authCallbacks.add(callback);
        queueMicrotask(() => callback('INITIAL_SESSION', session()));
        return { data: { subscription: { unsubscribe: () => authCallbacks.delete(callback) } } };
      },
      async signInWithPassword({ email }: { email: string; password: string }) {
        const match = (Object.keys(MOCK_USERS) as (keyof typeof MOCK_USERS)[])
          .find(role => MOCK_USERS[role].email === email.trim().toLowerCase());
        setMockRole(match ?? 'admin');
        const current = session();
        authCallbacks.forEach(cb => cb('SIGNED_IN', current));
        return { data: { user: current?.user ?? null, session: current }, error: null };
      },
      async signOut() {
        setMockRole('out');
        authCallbacks.forEach(cb => cb('SIGNED_OUT', null));
        return { error: null };
      },
    },

    storage: {
      from(bucket: string) {
        const key = (path: string) => `${STORAGE_PREFIX}${bucket}/${path}`;
        return {
          async upload(path: string, file: Blob) {
            if (!currentUserId()) return { data: null, error: { message: 'Unauthorized', statusCode: '401' } };
            if (!isAdmin()) return { data: null, error: { message: 'new row violates row-level security policy', statusCode: '403' } };
            try {
              localStorage.setItem(key(path), await readFile(file));
            } catch {
              return { data: null, error: { message: 'mock storage full (localStorage quota)', statusCode: '413' } };
            }
            return { data: { path, id: path, fullPath: `${bucket}/${path}` }, error: null };
          },
          getPublicUrl(path: string) {
            return { data: { publicUrl: localStorage.getItem(key(path)) ?? `https://mock.local/storage/v1/object/public/${bucket}/${path}` } };
          },
          async remove(paths: string[]) {
            paths.forEach(path => localStorage.removeItem(key(path)));
            return { data: paths.map(name => ({ name })), error: null };
          },
          async list(prefix = '') {
            const start = `${STORAGE_PREFIX}${bucket}/${prefix}`;
            const names = Object.keys(localStorage).filter(k => k.startsWith(start)).map(k => k.slice(start.length));
            return { data: names.map(name => ({ name, id: name, metadata: {} })), error: null };
          },
        };
      },
    },

    functions: {
      async invoke(name: string, options: { body?: { teamId?: string; offset?: number; keyword?: string } } = {}) {
        if (name === 'api-sports-logo') {
          const team = options.body?.teamId ? getTable('teams').find(t => t.id === options.body?.teamId) : null;
          return { data: { logoUrl: (team?.resolvedLogoUrl as string | null) ?? null }, error: null };
        }
        if (name === 'sofifa-teams') {
          if (!isAdmin()) return { data: null, error: new Error('Forbidden') };
          const keyword = options.body?.keyword?.trim();
          if (keyword) {
            return { data: { status: 200, html: mockSofifaSearchPage(keyword, getTable('teams')), keyword }, error: null };
          }
          return { data: { status: 200, html: options.body?.offset ? '' : sofifaTeamsPage, keyword: null }, error: null };
        }
        return { data: null, error: new Error(`mock: Edge Function "${name}" not found`) };
      },
    },

    channel: (name: string) => new MockChannel(name),
    removeChannel(channel: MockChannel) {
      channel.close();
      return Promise.resolve('ok');
    },
  };
}
