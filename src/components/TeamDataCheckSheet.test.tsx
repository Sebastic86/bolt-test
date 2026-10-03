import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './ui';
import { makeTeam } from '../test/fixtures';
import { Team } from '../types';
import type { SofifaPage, SofifaTeam } from '../admin-tools/sofifaParser';

const { searchSofifaTeams, updateTeam } = vi.hoisted(() => ({ searchSofifaTeams: vi.fn(), updateTeam: vi.fn() }));
vi.mock('../services/sofifaService', () => ({ searchSofifaTeams }));
vi.mock('../services/teamService', () => ({ updateTeam }));

import TeamDataCheckSheet from './TeamDataCheckSheet';

const arsenal: Team = { ...makeTeam('a', 84), name: 'Arsenal FC', league: 'Premier League', rating: 5, attackRating: 83, midfieldRating: 85, defendRating: 83 };
const result = (teams: Partial<SofifaTeam>[], version = 'FC27'): SofifaPage => ({
  teams: teams.map((t, i) => ({ sofifaId: i + 1, name: 'Arsenal FC', league: 'Premier League', overall: 85, attack: 83, midfield: 85, defend: 83, ...t })),
  rowCount: teams.length,
  version,
  rosterId: '270003',
  rosterDate: 'Oct 1, 2026',
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
    searchSofifaTeams.mockReset();
    updateTeam.mockReset();
  });

  it('previews the changes and only writes them after Update team', async () => {
    searchSofifaTeams.mockResolvedValue(result([{}]));
    updateTeam.mockImplementation(async (id: string, updates: Partial<Team>) => ({ ...arsenal, ...updates, id }));
    const { onUpdated, onClose } = renderSheet();

    const ovrRow = await screen.findByRole('row', { name: /ovr/i });
    expect(within(ovrRow).getByText('84')).toBeInTheDocument();
    expect(within(ovrRow).getByText('85')).toBeInTheDocument();
    expect(searchSofifaTeams).toHaveBeenCalledWith('Arsenal FC');
    expect(updateTeam).not.toHaveBeenCalled();

    fireEvent.click(updateButton());
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', overallRating: 85 })));
    expect(updateTeam).toHaveBeenCalledWith('a', { overallRating: 85 });
    expect(onClose).toHaveBeenCalled();
  });

  it('says so and disables the button when the team already matches', async () => {
    searchSofifaTeams.mockResolvedValue(result([{ overall: 84 }]));
    renderSheet();
    expect(await screen.findByText(/already matches sofifa/i)).toBeInTheDocument();
    expect(updateButton()).toBeDisabled();
  });

  it('lets the admin pick the team when the name is not an exact match', async () => {
    searchSofifaTeams.mockResolvedValue(result([{ name: 'Arsenal FC' }, { name: 'Arsenal Tula', overall: 62 }]));
    renderSheet({ ...arsenal, name: 'Arsenal' });

    fireEvent.click(await screen.findByRole('button', { name: /arsenal fc/i }));
    expect(screen.getByText(/sofifa: arsenal fc/i)).toBeInTheDocument();
    expect(updateButton()).toBeEnabled();
  });

  it('refuses to put the current version\'s ratings on an older team', async () => {
    searchSofifaTeams.mockResolvedValue(result([{}]));
    renderSheet({ ...arsenal, version: 'FC26' });
    expect(await screen.findByText(/sofifa only has fc27 data/i)).toBeInTheDocument();
    expect(updateButton()).toBeDisabled();
  });

  it('warns when the new stars leave the star filter', async () => {
    searchSofifaTeams.mockResolvedValue(result([{ overall: 83 }]));
    renderSheet({ ...arsenal, overallRating: 82, rating: 4.5 }, { minRating: 3, maxRating: 4.5 });
    expect(await screen.findByText(/outside your star filter/i)).toBeInTheDocument();
  });

  it('searches again with another spelling', async () => {
    searchSofifaTeams.mockResolvedValueOnce(result([])).mockResolvedValueOnce(result([{}]));
    renderSheet();
    expect(await screen.findByText(/no team found/i)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: /sofifa search/i }), { target: { value: 'Arsenal' } });
    fireEvent.click(screen.getByRole('button', { name: /search sofifa/i }));
    await screen.findByRole('row', { name: /ovr/i });
    expect(searchSofifaTeams).toHaveBeenLastCalledWith('Arsenal');
  });
});
