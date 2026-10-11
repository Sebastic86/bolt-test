import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { functions: { invoke } } }));

import page from '../admin-tools/__fixtures__/fifaindex-teams-page.html?raw';
import { fetchFifaIndexPage, searchFifaIndexTeams, searchTermsFor } from './fifaIndexService';

/** What supabase-js returns for a non-2xx answer: a FunctionsHttpError with the response as `context`. */
const httpError = (status: number, body: unknown) =>
  Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    context: new Response(JSON.stringify(body), { status }),
  });

type Body = { page: number; category?: string; q?: string };
const EMPTY = '<html><body><h1>Teams in FC 27</h1><table><tbody></tbody></table></body></html>';
const ok = (html: string) => ({ data: { status: 200, html }, error: null });

describe('fetchFifaIndexPage', () => {
  beforeEach(() => invoke.mockReset());

  it('asks the function for one page of a category', async () => {
    invoke.mockResolvedValue(ok('<html>'));
    await expect(fetchFifaIndexPage(2, { category: 'nations' })).resolves.toEqual({ status: 200, html: '<html>' });
    expect(invoke).toHaveBeenCalledWith('fifaindex-teams', { body: { page: 2, category: 'nations' } });
  });

  it('says the function is not deployed when the self-hosted runtime cannot find it', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(500, { msg: 'InvalidWorkerCreation: worker boot error: failed to read path: No such file or directory (os error 2)' }),
    });
    await expect(fetchFifaIndexPage(1)).rejects.toThrow(/not deployed on the Supabase server/);
  });

  it('says to sign in as admin when the function refuses', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(403, { error: 'Forbidden' }) });
    await expect(fetchFifaIndexPage(1)).rejects.toThrow(/HTTP 403: Forbidden\) — sign in as an admin/);
  });
});

describe('searchTermsFor', () => {
  it('tries the name as typed, then without club affixes', () => {
    expect(searchTermsFor(' Arsenal FC ')).toEqual(['Arsenal FC', 'arsenal']);
    expect(searchTermsFor('PSV')).toEqual(['PSV', 'psv']);
  });
});

describe('searchFifaIndexTeams', () => {
  beforeEach(() => invoke.mockReset());

  it('falls back to the name without affixes and adds matching national teams', async () => {
    invoke.mockImplementation(async (_: string, options?: { body: Body }) => {
      const body = options?.body ?? { page: 1 };
      if (body.category === 'nations') return ok(body.page === 1 ? page : EMPTY);
      return ok(body.q === 'arsenal' ? page : EMPTY);
    });
    const result = await searchFifaIndexTeams('Arsenal FC');
    expect(invoke).toHaveBeenCalledWith('fifaindex-teams', { body: { page: 1, q: 'Arsenal FC' } });
    expect(invoke).toHaveBeenCalledWith('fifaindex-teams', { body: { page: 1, q: 'arsenal' } });
    expect(result.version).toBe('FC27');
    expect(result.teams.map(t => t.name)).toContain('Arsenal');
  });

  it('finds a national team by name', async () => {
    invoke.mockImplementation(async (_: string, options?: { body: Body }) =>
      ok(options?.body.category === 'nations' && options.body.page === 1 ? page : EMPTY)
    );
    const result = await searchFifaIndexTeams('Spain');
    expect(result.teams.map(t => t.name)).toEqual(['Spain']);
  });

  it('reports FIFA Index blocking the server', async () => {
    invoke.mockResolvedValue({ data: { status: 403, html: '' }, error: null });
    await expect(searchFifaIndexTeams('Arsenal')).rejects.toThrow(/FIFA Index answered HTTP 403/);
  });
});
