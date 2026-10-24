import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './ui';
import { makeTeam } from '../test/fixtures';
import { Team } from '../types';
import type { SourcePage, SourceTeam } from '../admin-tools/fifaIndexParser';

const { searchFifaIndexTeams, updateTeam } = vi.hoisted(() => ({ searchFifaIndexTeams: vi.fn(), updateTeam: vi.fn() }));
vi.mock('../services/fifaIndexService', () => ({ searchFifaIndexTeams }));
vi.mock('../services/teamService', () => ({ updateTeam }));

import TeamDataCheckSheet from './TeamDataCheckSheet';

const arsenal: Team = { ...makeTeam('a', 84), name: 'Arsenal FC', league: 'Premier League', rating: 5, attackRating: 83, midfieldRating: 85, defendRating: 83 };
const result = (teams: Partial<SourceTeam>[], version = 'FC27'): SourcePage => ({
  teams: teams.map((t, i) => ({ teamId: i + 1, name: 'Arsenal FC', league: 'Premier League', overall: 85, attack: 83, midfield: 85, defend: 83, ...t })),
  rowCount: teams.length,
  version,
});

function renderSheet(team: Team = arsenal, starFilter = { minRating: 0, maxRating: 5 }) {
  const onUpdated = vi.fn();
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <TeamDataCheckSheet team={team} onClose={onClose} onUpdated={onUpdated} starFilter={starFilter} />
      </ToastProvider>
    </QueryClientProvider>
  );
  return { onUpdated, onClose };
}

const updateButton = () => screen.getByRole('button', { name: /update team|up to date/i });

describe('TeamDataCheckSheet', () => {
  beforeEach(() => {
    searchFifaIndexTeams.mockReset();
    updateTeam.mockReset();
  });

  it('previews the changes and only writes them after Update team', async () => {
    searchFifaIndexTeams.mockResolvedValue(result([{}]));
    updateTeam.mockImplementation(async (id: string, updates: Partial<Team>) => ({ ...arsenal, ...updates, id }));
    const { onUpdated, onClose } = renderSheet();

    const ovrRow = await screen.findByRole('row', { name: /ovr/i });
    expect(within(ovrRow).getByText('84')).toBeInTheDocument();
    expect(within(ovrRow).getByText('85')).toBeInTheDocument();
    expect(searchFifaIndexTeams).toHaveBeenCalledWith('Arsenal FC');
    expect(updateTeam).not.toHaveBeenCalled();

    fireEvent.click(updateButton());
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', overallRating: 85 })));
    expect(updateTeam).toHaveBeenCalledWith('a', { overallRating: 85 });
    expect(onClose).toHaveBeenCalled();
  });

  it('says so and disables the button when the team already matches', async () => {
    searchFifaIndexTeams.mockResolvedValue(result([{ overall: 84 }]));
    renderSheet();
    expect(await screen.findByText(/already matches fifa index/i)).toBeInTheDocument();
    expect(updateButton()).toBeDisabled();
  });

  it('lets the admin pick the team when the name is not an exact match', async () => {
    searchFifaIndexTeams.mockResolvedValue(result([{ name: 'Arsenal FC' }, { name: 'Arsenal Tula', overall: 62 }]));
    renderSheet({ ...arsenal, name: 'Arsenal London' });

    fireEvent.click(await screen.findByRole('button', { name: /arsenal fc/i }));
    expect(screen.getByText(/fifa index: arsenal fc/i)).toBeInTheDocument();
    expect(updateButton()).toBeEnabled();
  });

  it('matches a name that only differs in club affixes', async () => {
    searchFifaIndexTeams.mockResolvedValue(result([{ name: 'Arsenal' }, { name: 'Arsenal Tula', overall: 62 }]));
    renderSheet();
    expect(await screen.findByText(/fifa index: arsenal$/i)).toBeInTheDocument();
    expect(updateButton()).toBeEnabled();
  });

  it('refuses to put the current version\'s ratings on an older team', async () => {
    searchFifaIndexTeams.mockResolvedValue(result([{}]));
    renderSheet({ ...arsenal, version: 'FC26' });
    expect(await screen.findByText(/fifa index only has fc27 data/i)).toBeInTheDocument();
    expect(updateButton()).toBeDisabled();
  });

  it('warns when the new stars leave the star filter', async () => {
    searchFifaIndexTeams.mockResolvedValue(result([{ overall: 83 }]));
    renderSheet({ ...arsenal, overallRating: 82, rating: 4.5 }, { minRating: 3, maxRating: 4.5 });
    expect(await screen.findByText(/outside your star filter/i)).toBeInTheDocument();
  });

  it('falls back to entering the ratings by hand when FIFA Index blocks the lookup', async () => {
    searchFifaIndexTeams.mockRejectedValue(new Error('FIFA Index answered HTTP 403'));
    updateTeam.mockImplementation(async (id: string, updates: Partial<Team>) => ({ ...arsenal, ...updates, id }));
    const { onUpdated, onClose } = renderSheet();

    const ovr = await screen.findByRole('spinbutton', { name: /^ovr$/i });
    expect(screen.getByText(/http 403/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save ratings/i })).toBeDisabled();

    fireEvent.change(ovr, { target: { value: '86' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /^def$/i }), { target: { value: '84' } });
    fireEvent.click(screen.getByRole('button', { name: /save ratings/i }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', overallRating: 86 })));
    expect(updateTeam).toHaveBeenCalledWith('a', { overallRating: 86, defendRating: 84 });
    expect(onClose).toHaveBeenCalled();
  });

  it('derives the stars from a typed OVR unless they were set by hand', async () => {
    searchFifaIndexTeams.mockRejectedValue(new Error('blocked'));
    renderSheet({ ...arsenal, overallRating: 84, rating: 5 }, { minRating: 4.5, maxRating: 5 });

    fireEvent.change(await screen.findByRole('spinbutton', { name: /^ovr$/i }), { target: { value: '78' } });
    const stars = screen.getByRole('spinbutton', { name: /stars/i });
    expect(stars).toHaveValue(4);
    expect(screen.getByText(/outside your star filter/i)).toBeInTheDocument();

    fireEvent.change(stars, { target: { value: '4.5' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /^ovr$/i }), { target: { value: '70' } });
    expect(stars).toHaveValue(4.5);
  });

  it('rejects ratings outside 0-99', async () => {
    searchFifaIndexTeams.mockRejectedValue(new Error('blocked'));
    renderSheet();
    fireEvent.change(await screen.findByRole('spinbutton', { name: /^att$/i }), { target: { value: '120' } });
    expect(screen.getByText(/whole numbers from 0 to 99/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save ratings/i })).toBeDisabled();
  });

  it('offers entering by hand even when the lookup works', async () => {
    searchFifaIndexTeams.mockResolvedValue(result([{}]));
    renderSheet();
    await screen.findByRole('row', { name: /ovr/i });

    fireEvent.click(screen.getByRole('button', { name: /enter ratings by hand/i }));
    expect(screen.getByRole('spinbutton', { name: /^ovr$/i })).toHaveValue(84);
    fireEvent.click(screen.getByRole('button', { name: /back to fifa index/i }));
    expect(screen.getByRole('row', { name: /ovr/i })).toBeInTheDocument();
  });

  it('searches again with another spelling', async () => {
    searchFifaIndexTeams.mockResolvedValueOnce(result([])).mockResolvedValueOnce(result([{}]));
    renderSheet();
    expect(await screen.findByText(/no team found/i)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: /fifa index search/i }), { target: { value: 'Arsenal' } });
    fireEvent.click(screen.getByRole('button', { name: /search fifa index/i }));
    await screen.findByRole('row', { name: /ovr/i });
    expect(searchFifaIndexTeams).toHaveBeenLastCalledWith('Arsenal');
  });
});
