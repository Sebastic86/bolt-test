import React, { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Team } from '../types';
import { useTeamsQuery } from '../queries/teams';
import { TeamLogo } from './TeamLogo';
import EditTeamFullModal from './EditTeamFullModal';
import CreateTeamModal from './CreateTeamModal';
import { Button, ErrorState, Input, LoadingState, Select } from './ui';

type FilterField = 'all' | 'name' | 'league';

const TeamManagement: React.FC = () => {
  const teamsQuery = useTeamsQuery();
  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState<FilterField>('all');
  const [minRating, setMinRating] = useState(0);
  const [selectedVersion, setSelectedVersion] = useState('All');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const availableVersions = useMemo(
    () => Array.from(new Set(teams.map(t => t.version))).sort(),
    [teams]
  );

  const filteredTeams = useMemo(() => {
    let filtered = teams;
    if (selectedVersion !== 'All') filtered = filtered.filter(t => t.version === selectedVersion);
    if (minRating > 0) filtered = filtered.filter(t => t.rating >= minRating);
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => {
        if (filterBy === 'name') return t.name.toLowerCase().includes(q);
        if (filterBy === 'league') return t.league.toLowerCase().includes(q);
        return t.name.toLowerCase().includes(q) || t.league.toLowerCase().includes(q);
      });
    }
    return filtered;
  }, [teams, selectedVersion, minRating, searchQuery, filterBy]);

  const teamsByLeague = useMemo(() => {
    const grouped: Record<string, Team[]> = {};
    filteredTeams.forEach(t => {
      (grouped[t.league] ??= []).push(t);
    });
    return grouped;
  }, [filteredTeams]);
  const leagues = Object.keys(teamsByLeague).sort();

  if (teamsQuery.isLoading) return <LoadingState label="Loading teams..." />;
  if (teamsQuery.error) {
    return <ErrorState message={teamsQuery.error instanceof Error ? teamsQuery.error.message : 'Failed to load teams'} />;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">{filteredTeams.length} of {teams.length} teams</p>
        <Button variant="primary" className="h-9 px-3 text-xs" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Add Team
        </Button>
      </div>

      <div className="mb-4 space-y-2 border-2 border-(--color-ink) bg-gray-50 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search teams..." className="pl-8" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Select value={filterBy} onChange={e => setFilterBy(e.target.value as FilterField)}>
            <option value="all">All fields</option>
            <option value="name">Name</option>
            <option value="league">League</option>
          </Select>
          <Select value={selectedVersion} onChange={e => setSelectedVersion(e.target.value)}>
            <option value="All">All versions</option>
            {availableVersions.map(v => <option key={v} value={v}>{v}</option>)}
          </Select>
          <Select value={minRating} onChange={e => setMinRating(Number(e.target.value))}>
            <option value={0}>All ratings</option>
            <option value={3}>★ &ge;3.0</option>
            <option value={3.5}>★ &ge;3.5</option>
            <option value={4}>★ &ge;4.0</option>
            <option value={4.5}>★ &ge;4.5</option>
            <option value={5}>★ 5.0</option>
          </Select>
        </div>
      </div>

      {filteredTeams.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No teams found. Try adjusting your filters.</p>
      ) : (
        <div className="space-y-5">
          {leagues.map(league => (
            <div key={league}>
              <div className="mb-2 inline-block bg-(--color-ink) px-2.5 py-1 text-xs font-black uppercase tracking-wide text-white">
                {league} ({teamsByLeague[league].length})
              </div>
              <div className="space-y-2">
                {teamsByLeague[league].map(team => (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeam(team)}
                    className="flex w-full items-center gap-3 border-2 border-(--color-ink) bg-white p-3 text-left"
                  >
                    <TeamLogo team={team} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black uppercase text-(--color-ink)">{team.name}</div>
                      <div className="text-xs text-gray-500">
                        {team.version} &middot; ★ {team.rating.toFixed(1)} &middot; OVR {team.overallRating}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <EditTeamFullModal
        isOpen={selectedTeam !== null}
        onClose={() => setSelectedTeam(null)}
        team={selectedTeam}
      />
      <CreateTeamModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
};

export default TeamManagement;
