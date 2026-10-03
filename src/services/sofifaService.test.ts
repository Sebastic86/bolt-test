import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { functions: { invoke } } }));

import page from '../admin-tools/__fixtures__/sofifa-teams-page.html?raw';
import { fetchSofifaTeamsPage, searchSofifaTeams } from './sofifaService';

/** What supabase-js returns for a non-2xx answer: a FunctionsHttpError with the response as `context`. */
const httpError = (status: number, body: unknown) =>
  Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    context: new Response(JSON.stringify(body), { status }),
  });

describe('fetchSofifaTeamsPage', () => {
  beforeEach(() => invoke.mockReset());

  it('returns the page and pins the roster', async () => {
    invoke.mockResolvedValue({ data: { status: 200, html: '<html>' }, error: null });
    await expect(fetchSofifaTeamsPage(60, '270003')).resolves.toEqual({ status: 200, html: '<html>' });
    expect(invoke).toHaveBeenCalledWith('sofifa-teams', { body: { offset: 60, roster: '270003' } });
  });

  it('says the function is not deployed when the self-hosted runtime cannot find it', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(500, { msg: 'InvalidWorkerCreation: worker boot error: failed to read path: No such file or directory (os error 2)' }),
    });
    await expect(fetchSofifaTeamsPage(0)).rejects.toThrow(/not deployed on the Supabase server/);
  });

  it('says to sign in as admin when the function refuses', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(403, { error: 'Forbidden' }) });
    await expect(fetchSofifaTeamsPage(0)).rejects.toThrow(/HTTP 403: Forbidden\) — sign in as an admin/);
  });

  it('passes other function errors through with their message', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(502, { error: 'Could not reach SoFIFA: timeout' }) });
    await expect(fetchSofifaTeamsPage(0)).rejects.toThrow('The sofifa-teams Edge Function failed (HTTP 502: Could not reach SoFIFA: timeout).');
  });
});

describe('searchSofifaTeams', () => {
  beforeEach(() => invoke.mockReset());

  it('searches by keyword and parses the result page', async () => {
    invoke.mockResolvedValue({ data: { status: 200, html: page, keyword: 'Arsenal' }, error: null });
    const result = await searchSofifaTeams(' Arsenal ');
    expect(invoke).toHaveBeenCalledWith('sofifa-teams', { body: { offset: 0, keyword: 'Arsenal' } });
    expect(result.version).toBe('FC27');
    expect(result.teams.map(t => t.name)).toContain('Arsenal FC');
  });

  it('refuses the answer of an older function that ignores the keyword', async () => {
    invoke.mockResolvedValue({ data: { status: 200, html: page }, error: null });
    await expect(searchSofifaTeams('Arsenal')).rejects.toThrow(/outdated/);
  });

  it('reports SoFIFA blocking the server', async () => {
    invoke.mockResolvedValue({ data: { status: 403, html: '', keyword: 'Arsenal' }, error: null });
    await expect(searchSofifaTeams('Arsenal')).rejects.toThrow(/HTTP 403/);
  });
});
